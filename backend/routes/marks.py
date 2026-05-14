"""
marks.py — Student performance marks: manual grading + auto quiz scores.
Lecturers can award marks for any assessment type (Midterm, Test,
Presentation, Assignment, etc.). Quiz scores are pulled automatically
from quiz_attempts and merged into the response.
"""

from flask import Blueprint, request, jsonify, g
from services.supabase_client import supabase
from middleware.auth_middleware import require_auth, require_role

marks_bp = Blueprint("marks", __name__)

VALID_TYPES = ["Quiz", "Midterm", "Test", "Assignment", "Presentation", "Other"]


@marks_bp.get("/student/<student_id>/course/<course_id>")
@require_auth
@require_role("lecturer")
def get_student_marks(student_id: str, course_id: str):
    """
    Return all marks for a student in a course.
    Combines manual student_marks rows with auto-graded quiz_attempts.
    """
    results = []

    # ── Manual marks ──────────────────────────────────────────────────────
    try:
        manual = supabase.table("student_marks").select("*").eq(
            "student_id", student_id
        ).eq("course_id", course_id).order("awarded_at", desc=True).execute()
        results.extend(manual.data or [])
    except Exception as e:
        print(f"[marks] student_marks query failed: {e}")

    # ── Auto quiz scores ───────────────────────────────────────────────────
    try:
        attempts = supabase.table("quiz_attempts").select(
            "id, score, completed_at, quizzes(title, course_id)"
        ).eq("student_id", student_id).execute()

        for a in (attempts.data or []):
            quiz = a.get("quizzes") or {}
            if quiz.get("course_id") != course_id:
                continue
            results.append({
                "id":              f"quiz-{a['id']}",
                "student_id":      student_id,
                "course_id":       course_id,
                "assessment_type": "Quiz",
                "title":           quiz.get("title", "Quiz"),
                "score":           a.get("score") or 0,
                "max_score":       100,
                "notes":           None,
                "source":          "auto",
                "awarded_at":      a.get("completed_at"),
            })
    except Exception as e:
        print(f"[marks] quiz_attempts query failed: {e}")

    # Sort by date descending
    results.sort(key=lambda x: x.get("awarded_at") or "", reverse=True)
    return jsonify(results), 200


@marks_bp.post("")
@require_auth
@require_role("lecturer")
def create_mark():
    """Award a manual mark to a student."""
    data = request.get_json(silent=True) or {}
    student_id      = (data.get("student_id") or "").strip()
    course_id       = (data.get("course_id") or "").strip()
    assessment_type = (data.get("assessment_type") or "Other").strip()
    title           = (data.get("title") or "").strip()
    notes           = (data.get("notes") or "").strip() or None

    try:
        score     = float(data.get("score", 0))
        max_score = float(data.get("max_score", 100))
    except (TypeError, ValueError):
        return jsonify({"error": "score and max_score must be numbers.", "code": 400}), 400

    if not student_id or not course_id or not title:
        return jsonify({"error": "student_id, course_id, and title are required.", "code": 400}), 400

    if assessment_type not in VALID_TYPES:
        assessment_type = "Other"

    if score < 0 or max_score <= 0 or score > max_score:
        return jsonify({"error": "score must be between 0 and max_score.", "code": 400}), 400

    try:
        res = supabase.table("student_marks").insert({
            "student_id":      student_id,
            "course_id":       course_id,
            "lecturer_id":     g.user_id,
            "assessment_type": assessment_type,
            "title":           title,
            "score":           score,
            "max_score":       max_score,
            "notes":           notes,
            "source":          "manual",
        }).execute()
        return jsonify(res.data[0]), 201
    except Exception as e:
        return jsonify({"error": f"Could not save mark. Has the student_marks table been created? {e}", "code": 500}), 500


@marks_bp.put("/<mark_id>")
@require_auth
@require_role("lecturer")
def update_mark(mark_id: str):
    """Update an existing manual mark."""
    data    = request.get_json(silent=True) or {}
    updates = {}

    if "title"           in data: updates["title"]           = data["title"].strip()
    if "notes"           in data: updates["notes"]           = (data["notes"] or "").strip() or None
    if "assessment_type" in data:
        at = data["assessment_type"].strip()
        updates["assessment_type"] = at if at in VALID_TYPES else "Other"
    if "score"     in data:
        try: updates["score"]     = float(data["score"])
        except (TypeError, ValueError): pass
    if "max_score" in data:
        try: updates["max_score"] = float(data["max_score"])
        except (TypeError, ValueError): pass

    if not updates:
        return jsonify({"error": "Nothing to update.", "code": 400}), 400

    res = supabase.table("student_marks").update(updates).eq(
        "id", mark_id
    ).eq("lecturer_id", g.user_id).execute()
    if not res.data:
        return jsonify({"error": "Mark not found or not yours.", "code": 404}), 404
    return jsonify(res.data[0]), 200


@marks_bp.delete("/<mark_id>")
@require_auth
@require_role("lecturer")
def delete_mark(mark_id: str):
    """Delete a manual mark."""
    res = supabase.table("student_marks").delete().eq(
        "id", mark_id
    ).eq("lecturer_id", g.user_id).execute()
    if not res.data:
        return jsonify({"error": "Mark not found or not yours.", "code": 404}), 404
    return jsonify({"message": "Mark deleted."}), 200
