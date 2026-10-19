"""
quiz.py — Quiz generation, management, attempt submission, and results routes.
"""

import random
import string
from flask import Blueprint, request, jsonify, g
from services.supabase_client import supabase
from services.quiz_service import generate_quiz
from services.socket_service import get_socketio
from middleware.auth_middleware import require_auth, require_role
from services.lecturer_access import lecturer_can_manage_student, lecturer_managed_student_ids, lecturer_owns_course


def _owned_quiz(quiz_id, lecturer_id, columns="id, course_id"):
    result = supabase.table("quizzes").select(columns).eq("id", quiz_id).limit(1).execute()
    if not result.data:
        return None
    quiz = result.data[0]
    return quiz if g.user_role == "superadmin" or lecturer_owns_course(supabase, lecturer_id, quiz.get("course_id")) else None


def _generate_pin() -> str:
    """Generate a random 6-character uppercase alphanumeric PIN."""
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))

quiz_bp = Blueprint("quiz", __name__)


@quiz_bp.post("/generate")
@require_auth
@require_role("lecturer")
def generate():
    """
    Trigger AI quiz generation for a course.

    Body: { course_id, num_questions (default 10), difficulty (default 'medium'), timer_minutes (default 30) }
    Returns: the created quiz record.
    """
    data = request.get_json(silent=True) or {}
    course_id = data.get("course_id", "").strip()
    num_questions = int(data.get("num_questions", 10))
    difficulty = data.get("difficulty", "medium").lower()
    quiz_type = (data.get("quiz_type") or "general").lower()
    material_id = (data.get("material_id") or "").strip() or None
    timer_minutes = int(data.get("timer_minutes", 30))

    if not course_id:
        return jsonify({"error": "course_id is required", "code": 400}), 400
    if g.user_role != "superadmin" and not lecturer_owns_course(supabase, g.user_id, course_id):
        return jsonify({"error": "Course not found or not assigned to you.", "code": 404}), 404
    if num_questions < 5 or num_questions > 20:
        return jsonify({"error": "num_questions must be between 5 and 20", "code": 400}), 400
    if difficulty not in ("easy", "medium", "hard"):
        return jsonify({"error": "difficulty must be easy, medium, or hard", "code": 400}), 400
    if quiz_type not in ("general", "hot"):
        return jsonify({"error": "quiz_type must be 'general' or 'hot'", "code": 400}), 400
    if quiz_type == "hot" and not material_id:
        return jsonify({"error": "Select a lecture material for a hot test", "code": 400}), 400
    if timer_minutes < 5 or timer_minutes > 120:
        return jsonify({"error": "timer_minutes must be between 5 and 120", "code": 400}), 400

    try:
        quiz = generate_quiz(course_id, num_questions, difficulty, quiz_type, material_id, timer_minutes)
    except ValueError as e:
        return jsonify({"error": str(e), "code": 400}), 400
    except Exception as e:
        return jsonify({"error": f"Quiz generation failed: {str(e)}", "code": 500}), 500

    return jsonify(quiz), 201


@quiz_bp.post("/manual")
@require_auth
@require_role("lecturer")
def create_manual():
    """
    Save a manually authored quiz.

    Body: { course_id, title, timer_minutes, questions: [{question, options, correct_answer, explanation}] }
    Returns: the created quiz record.
    """
    data = request.get_json(silent=True) or {}
    course_id  = data.get("course_id", "").strip()
    title      = data.get("title", "").strip()
    timer_minutes = int(data.get("timer_minutes", 30))
    questions  = data.get("questions", [])

    if not course_id:
        return jsonify({"error": "course_id is required", "code": 400}), 400
    if g.user_role != "superadmin" and not lecturer_owns_course(supabase, g.user_id, course_id):
        return jsonify({"error": "Course not found or not assigned to you.", "code": 404}), 404
    if not title:
        return jsonify({"error": "Quiz title is required", "code": 400}), 400
    if not questions:
        return jsonify({"error": "At least one question is required", "code": 400}), 400
    if timer_minutes < 5 or timer_minutes > 120:
        return jsonify({"error": "timer_minutes must be between 5 and 120", "code": 400}), 400

    for i, q in enumerate(questions):
        if not q.get("question", "").strip():
            return jsonify({"error": f"Question {i + 1} text is required", "code": 400}), 400
        options = q.get("options", [])
        if len(options) != 4 or any(not str(o).strip() for o in options):
            return jsonify({"error": f"Question {i + 1} must have 4 non-empty options", "code": 400}), 400
        if not q.get("correct_answer", "").strip():
            return jsonify({"error": f"Question {i + 1} must have a correct answer selected", "code": 400}), 400

    res = supabase.table("quizzes").insert({
        "course_id": course_id,
        "title": title,
        "timer_minutes": timer_minutes,
        "questions": questions,
        "is_active": False,
    }).execute()

    return jsonify(res.data[0]), 201


@quiz_bp.get("/course/<course_id>")
@require_auth
def get_course_quizzes(course_id: str):
    """Return all quizzes for a course. Students only see active quizzes."""
    course = supabase.table("courses").select("id, lecturer_id").eq("id", course_id).limit(1).execute()
    if not course.data:
        return jsonify({"error": "Course not found", "code": 404}), 404
    if g.user_role == "lecturer" and course.data[0].get("lecturer_id") != g.user_id:
        return jsonify({"error": "Course not found or not assigned to you.", "code": 404}), 404
    query = supabase.table("quizzes").select("*").eq("course_id", course_id)

    if g.user_role == "student":
        query = query.eq("is_active", True)

    res = query.order("generated_at", desc=True).execute()
    return jsonify(res.data), 200


@quiz_bp.patch("/<quiz_id>/activate")
@require_auth
@require_role("lecturer")
def toggle_activate(quiz_id: str):
    """Toggle quiz active/inactive status to control student visibility."""
    if not _owned_quiz(quiz_id, g.user_id):
        return jsonify({"error": "Quiz not found or not assigned to you.", "code": 404}), 404
    current = supabase.table("quizzes").select("is_active").eq("id", quiz_id).single().execute()
    if not current.data:
        return jsonify({"error": "Quiz not found", "code": 404}), 404

    new_status = not current.data["is_active"]
    res = supabase.table("quizzes").update({"is_active": new_status}).eq("id", quiz_id).execute()
    return jsonify(res.data[0]), 200


@quiz_bp.delete("/<quiz_id>")
@require_auth
@require_role("lecturer")
def delete_quiz(quiz_id: str):
    """Delete a quiz and all associated attempt records."""
    if not _owned_quiz(quiz_id, g.user_id):
        return jsonify({"error": "Quiz not found or not assigned to you.", "code": 404}), 404
    res = supabase.table("quizzes").delete().eq("id", quiz_id).execute()
    if not res.data:
        return jsonify({"error": "Quiz not found", "code": 404}), 404
    return jsonify({"message": "Quiz deleted"}), 200


@quiz_bp.post("/<quiz_id>/attempt")
@require_auth
@require_role("student")
def submit_attempt(quiz_id: str):
    """
    Submit quiz answers and compute score server-side.

    Body: { answers: { question_index: selected_answer } }
    Returns: { score, total, percentage, attempt_id }
    """
    data = request.get_json(silent=True) or {}
    answers = data.get("answers", {})

    quiz_res = supabase.table("quizzes").select("questions").eq("id", quiz_id).single().execute()
    if not quiz_res.data:
        return jsonify({"error": "Quiz not found", "code": 404}), 404

    questions = quiz_res.data["questions"]
    score = 0
    for i, question in enumerate(questions):
        student_answer = answers.get(str(i), "")
        if student_answer == question.get("correct_answer"):
            score += 1

    total = len(questions)
    percentage = round((score / total) * 100) if total > 0 else 0

    res = supabase.table("quiz_attempts").insert({
        "quiz_id": quiz_id,
        "student_id": g.user_id,
        "answers": answers,
        "score": score,
    }).execute()

    attempt = res.data[0]
    attempt["total"] = total
    attempt["percentage"] = percentage
    return jsonify(attempt), 201


@quiz_bp.get("/<quiz_id>/results")
@require_auth
@require_role("lecturer")
def get_results(quiz_id: str):
    """Return all student attempts and scores for a quiz."""
    if not _owned_quiz(quiz_id, g.user_id):
        return jsonify({"error": "Quiz not found or not assigned to you.", "code": 404}), 404
    res = supabase.table("quiz_attempts").select(
        "*, profiles!quiz_attempts_student_id_fkey(full_name, avatar_url, classroom_id)"
    ).eq("quiz_id", quiz_id).order("completed_at", desc=True).execute()
    attempt_rows = res.data or []
    allowed_student_ids = lecturer_managed_student_ids(
        supabase, g.user_id, [row.get("student_id") for row in attempt_rows if row.get("student_id")]
    ) if g.user_role != "superadmin" else set()
    rows = [row for row in attempt_rows if g.user_role == "superadmin" or row.get("student_id") in allowed_student_ids]
    for row in rows:
        if row.get("profiles"):
            row["profiles"].pop("classroom_id", None)
    return jsonify(rows), 200


@quiz_bp.get("/<quiz_id>/my-attempt")
@require_auth
@require_role("student")
def get_my_attempt(quiz_id: str):
    """Return the authenticated student's attempt for a quiz, if any."""
    res = supabase.table("quiz_attempts").select("*").eq(
        "quiz_id", quiz_id
    ).eq("student_id", g.user_id).order("completed_at", desc=True).limit(1).execute()

    if not res.data:
        return jsonify(None), 200
    return jsonify(res.data[0]), 200


# ── Live Session ─────────────────────────────────────────────────────────────

@quiz_bp.post("/<quiz_id>/start-live")
@require_auth
@require_role("lecturer")
def start_live_session(quiz_id: str):
    """
    Start a live quiz session. Generates a fresh PIN stored in-memory and
    pushes a real-time notification (carrying the PIN) to every enrolled
    student so they can copy it and join without being told manually.
    No database columns required — the session lives only while the server runs.
    """
    try:
        quiz_res = supabase.table("quizzes").select(
            "id, title, course_id, questions"
        ).eq("id", quiz_id).execute()
    except Exception as e:
        print(f"[start_live] DB error: {e}")
        return jsonify({"error": f"Database error: {str(e)}", "code": 500}), 500

    if not quiz_res.data:
        return jsonify({"error": "Quiz not found", "code": 404}), 404

    quiz          = quiz_res.data[0]
    course_id     = quiz.get("course_id")
    if g.user_role != "superadmin" and not lecturer_owns_course(supabase, g.user_id, course_id):
        return jsonify({"error": "Quiz not found or not assigned to you.", "code": 404}), 404
    title         = quiz.get("title") or "Quiz"
    num_questions = len(quiz.get("questions") or [])

    pin = _generate_pin()

    from sockets.events import live_sessions
    live_sessions[quiz_id] = {"pin": pin, "students": {}}

    # Notify every enrolled student in real time with the PIN
    try:
        course_res = supabase.table("courses").select("course_name").eq(
            "id", course_id
        ).execute()
        course_name = (course_res.data[0].get("course_name") if course_res.data else "") or "your course"

        enrolments = supabase.table("enrolments").select("student_id").eq(
            "course_id", course_id
        ).execute()
        enrolment_rows = enrolments.data or []
        allowed_student_ids = lecturer_managed_student_ids(
            supabase, g.user_id, [row.get("student_id") for row in enrolment_rows if row.get("student_id")]
        ) if g.user_role != "superadmin" else set()
        eligible_enrolments = [row for row in enrolment_rows if g.user_role == "superadmin" or row.get("student_id") in allowed_student_ids]

        sio = get_socketio()
        if sio:
            payload = {
                "quiz_id":       quiz_id,
                "quiz_title":    title,
                "course_id":     course_id,
                "course_name":   course_name,
                "pin":           pin,
                "num_questions": num_questions,
            }
            # Emit to each student's personal room AND the course room so the
            # notification arrives regardless of which room joined first.
            for row in eligible_enrolments:
                sio.emit("live_session_started", payload,
                         room=f"student_{row['student_id']}", namespace="/")
            if len(eligible_enrolments) == len(enrolments.data or []):
                sio.emit("live_session_started", payload,
                         room=f"course_{course_id}", namespace="/")
            print(f"[start_live] Notified {len(eligible_enrolments)} assigned-class student(s)")
    except Exception as e:
        print(f"[start_live] Socket emit failed (non-fatal): {e}")

    print(f"[start_live] Session started for quiz {quiz_id} with PIN {pin}")
    return jsonify({"id": quiz_id, "pin": pin, "live_session_active": True}), 200


@quiz_bp.post("/<quiz_id>/end-live")
@require_auth
@require_role("lecturer")
def end_live_session(quiz_id: str):
    """End a live quiz session and clear the in-memory leaderboard."""
    if not _owned_quiz(quiz_id, g.user_id):
        return jsonify({"error": "Quiz not found or not assigned to you.", "code": 404}), 404
    from sockets.events import live_sessions
    live_sessions.pop(quiz_id, None)
    return jsonify({"id": quiz_id, "live_session_active": False}), 200


@quiz_bp.post("/<quiz_id>/deploy-marks")
@require_auth
@require_role("lecturer")
def deploy_live_marks(quiz_id: str):
    """
    Persist the live-session leaderboard into the gradebook (student_marks)
    under the 'Quiz' assessment column. Each participant's mark is their
    percentage correct (answers_correct / total_questions * 100).

    Idempotent: re-deploying replaces marks previously deployed for this quiz.
    """
    from sockets.events import live_sessions

    session = live_sessions.get(quiz_id)
    if not session:
        return jsonify({"error": "No active live session for this quiz.", "code": 404}), 404

    students = session.get("students", {})
    if not students:
        return jsonify({"error": "No students have participated yet.", "code": 400}), 400

    quiz_res = supabase.table("quizzes").select(
        "id, title, course_id, questions"
    ).eq("id", quiz_id).execute()
    if not quiz_res.data:
        return jsonify({"error": "Quiz not found", "code": 404}), 404

    quiz      = quiz_res.data[0]
    course_id = quiz["course_id"]
    if g.user_role != "superadmin" and not lecturer_owns_course(supabase, g.user_id, course_id):
        return jsonify({"error": "Quiz not found or not assigned to you.", "code": 404}), 404
    title     = quiz.get("title") or "Live Quiz"
    total_q   = len(quiz.get("questions") or []) or 1

    rows = []
    for sid, entry in students.items():
        if g.user_role != "superadmin" and not lecturer_can_manage_student(supabase, g.user_id, sid):
            continue
        correct    = entry.get("answers_correct", 0)
        percentage = round(correct / total_q * 100)
        rows.append({
            "student_id":      sid,
            "course_id":       course_id,
            "lecturer_id":     g.user_id,
            "assessment_type": "Quiz",
            "title":           title,
            "score":           percentage,
            "max_score":       100,
            "source":          "live",
        })

    if not rows:
        return jsonify({"error": "No participating students are in your assigned classes.", "code": 403}), 403

    # Re-deploy only replaces marks for students the lecturer may manage.
    student_ids = [row["student_id"] for row in rows]
    try:
        supabase.table("student_marks").delete().eq(
            "course_id", course_id
        ).eq("assessment_type", "Quiz").eq("title", title).eq("source", "live").in_(
            "student_id", student_ids
        ).execute()
    except Exception as e:
        print(f"[deploy_marks] cleanup skipped (non-fatal): {e}")

    try:
        supabase.table("student_marks").insert(rows).execute()
    except Exception as e:
        return jsonify({"error": f"Could not save marks: {e}", "code": 500}), 500

    print(f"[deploy_marks] Deployed {len(rows)} mark(s) for quiz {quiz_id} -> gradebook")
    return jsonify({"deployed": len(rows), "title": title, "course_id": course_id}), 200


@quiz_bp.get("/pin/<pin>")
@require_auth
def get_quiz_by_pin(pin: str):
    """
    Fetch an active quiz by its PIN from the in-memory session store.
    No database columns required.
    """
    from sockets.events import live_sessions
    pin = pin.strip().upper()

    quiz_id = next(
        (qid for qid, session in live_sessions.items() if session.get("pin") == pin),
        None,
    )
    if not quiz_id:
        return jsonify({"error": "No active session found for this PIN.", "code": 404}), 404

    res = supabase.table("quizzes").select(
        "id, title, questions, course_id"
    ).eq("id", quiz_id).single().execute()

    if not res.data:
        return jsonify({"error": "Quiz not found.", "code": 404}), 404

    if g.user_role == "student":
        course_result = supabase.table("courses").select("id, lecturer_id").eq(
            "id", res.data["course_id"]
        ).limit(1).execute()
        if not course_result.data:
            return jsonify({"error": "Course not found.", "code": 404}), 404
        lecturer_id = course_result.data[0].get("lecturer_id")
        enrollment = supabase.table("enrolments").select("id").eq(
            "student_id", g.user_id
        ).eq("course_id", res.data["course_id"]).limit(1).execute()
        if not enrollment.data or not lecturer_id or not lecturer_can_manage_student(supabase, lecturer_id, g.user_id):
            return jsonify({"error": "This live session is outside your assigned classes.", "code": 403}), 403
    elif g.user_role != "superadmin":
        return jsonify({"error": "Only enrolled students can join this live session.", "code": 403}), 403

    return jsonify({**res.data, "live_session_active": True, "pin": pin}), 200


@quiz_bp.get("/course/<course_id>/live")
@require_auth
def get_active_live_session(course_id: str):
    """
    Return the currently active live session for a course, if any.
    Pull-based fallback so students who missed the real-time push still see
    the active session (and its PIN) when they open the Quiz tab.
    """
    from sockets.events import live_sessions

    active_ids = [qid for qid, s in live_sessions.items() if s.get("pin")]
    if not active_ids:
        return jsonify({"active": False}), 200

    res = supabase.table("quizzes").select("id, title").in_(
        "id", active_ids
    ).eq("course_id", course_id).execute()

    if not res.data:
        return jsonify({"active": False}), 200

    quiz = res.data[0]
    return jsonify({
        "active":     True,
        "quiz_id":    quiz["id"],
        "quiz_title": quiz["title"],
        "pin":        live_sessions[quiz["id"]]["pin"],
    }), 200
