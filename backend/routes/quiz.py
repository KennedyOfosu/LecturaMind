"""
quiz.py — Quiz generation, management, attempt submission, and results routes.
"""

import random
import string
from flask import Blueprint, request, jsonify, g
from services.supabase_client import supabase
from services.quiz_service import generate_quiz
from middleware.auth_middleware import require_auth, require_role


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

    Body: { course_id, num_questions (default 10), difficulty (default 'medium') }
    Returns: the created quiz record.
    """
    data = request.get_json(silent=True) or {}
    course_id = data.get("course_id", "").strip()
    num_questions = int(data.get("num_questions", 10))
    difficulty = data.get("difficulty", "medium").lower()

    if not course_id:
        return jsonify({"error": "course_id is required", "code": 400}), 400
    if num_questions < 5 or num_questions > 20:
        return jsonify({"error": "num_questions must be between 5 and 20", "code": 400}), 400
    if difficulty not in ("easy", "medium", "hard"):
        return jsonify({"error": "difficulty must be easy, medium, or hard", "code": 400}), 400

    try:
        quiz = generate_quiz(course_id, num_questions, difficulty)
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

    Body: { course_id, title, questions: [{question, options, correct_answer, explanation}] }
    Returns: the created quiz record.
    """
    data = request.get_json(silent=True) or {}
    course_id  = data.get("course_id", "").strip()
    title      = data.get("title", "").strip()
    questions  = data.get("questions", [])

    if not course_id:
        return jsonify({"error": "course_id is required", "code": 400}), 400
    if not title:
        return jsonify({"error": "Quiz title is required", "code": 400}), 400
    if not questions:
        return jsonify({"error": "At least one question is required", "code": 400}), 400

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
        "questions": questions,
        "is_active": False,
    }).execute()

    return jsonify(res.data[0]), 201


@quiz_bp.get("/course/<course_id>")
@require_auth
def get_course_quizzes(course_id: str):
    """Return all quizzes for a course. Students only see active quizzes."""
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
    res = supabase.table("quiz_attempts").select(
        "*, profiles!quiz_attempts_student_id_fkey(full_name, avatar_url)"
    ).eq("quiz_id", quiz_id).order("completed_at", desc=True).execute()
    return jsonify(res.data), 200


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
    Start a live quiz session. Generates a fresh PIN stored in-memory.
    No database columns required — the session lives only while the server runs.
    """
    try:
        quiz_res = supabase.table("quizzes").select("id, title").eq("id", quiz_id).execute()
    except Exception as e:
        print(f"[start_live] DB error: {e}")
        return jsonify({"error": f"Database error: {str(e)}", "code": 500}), 500

    if not quiz_res.data:
        return jsonify({"error": "Quiz not found", "code": 404}), 404

    pin = _generate_pin()

    from sockets.events import live_sessions
    live_sessions[quiz_id] = {"pin": pin, "students": {}}

    print(f"[start_live] Session started for quiz {quiz_id} with PIN {pin}")
    return jsonify({"id": quiz_id, "pin": pin, "live_session_active": True}), 200


@quiz_bp.post("/<quiz_id>/end-live")
@require_auth
@require_role("lecturer")
def end_live_session(quiz_id: str):
    """End a live quiz session and clear the in-memory leaderboard."""
    from sockets.events import live_sessions
    live_sessions.pop(quiz_id, None)
    return jsonify({"id": quiz_id, "live_session_active": False}), 200


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

    return jsonify({**res.data, "live_session_active": True, "pin": pin}), 200
