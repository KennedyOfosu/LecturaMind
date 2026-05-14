"""
assignments.py — Lecturer teaching assignment CRUD.
Each assignment links a course to a programme + level for a semester.
Creating an assignment auto-enrols all matching students.
"""

from flask import Blueprint, request, jsonify, g
from services.supabase_client import supabase
from services.enrolment_service import backfill_student_enrolments
from middleware.auth_middleware import require_auth, require_role

assignments_bp = Blueprint("assignments", __name__)

VALID_LEVELS = [100, 200, 300, 400]


@assignments_bp.get("/my")
@require_auth
@require_role("lecturer")
def get_my_assignments():
    """Return all teaching assignments for the current lecturer."""
    res = supabase.table("lecturer_assignments").select(
        "*, courses(id, course_name, course_code)"
    ).eq("lecturer_id", g.user_id).order("programme").order("level").execute()
    return jsonify(res.data or []), 200


@assignments_bp.post("/create")
@require_auth
@require_role("lecturer")
def create_assignment():
    """
    Create a new teaching assignment.
    Triggers auto-enrolment of all matching students.
    """
    data = request.get_json(silent=True) or {}
    course_id     = (data.get("course_id") or "").strip()
    programme     = (data.get("programme") or "").strip()
    raw_level     = data.get("level")
    semester      = (data.get("semester") or "").strip() or None
    academic_year = (data.get("academic_year") or "").strip() or None

    if not course_id or not programme:
        return jsonify({"error": "course_id and programme are required.", "code": 400}), 400

    try:
        level = int(raw_level)
    except (TypeError, ValueError):
        level = None
    if level not in VALID_LEVELS:
        return jsonify({"error": "Level must be 100, 200, 300, or 400.", "code": 400}), 400

    # Verify the course belongs to this lecturer
    course_check = supabase.table("courses").select("id").eq("id", course_id).eq(
        "lecturer_id", g.user_id
    ).execute()
    if not course_check.data:
        return jsonify({"error": "Course not found or not yours.", "code": 404}), 404

    # Check for duplicate assignment
    existing = supabase.table("lecturer_assignments").select("id").eq(
        "lecturer_id", g.user_id
    ).eq("course_id", course_id).eq("programme", programme).eq("level", level).execute()
    if existing.data:
        return jsonify({"error": "This assignment already exists.", "code": 409}), 409

    # Insert
    try:
        res = supabase.table("lecturer_assignments").insert({
            "lecturer_id":   g.user_id,
            "course_id":     course_id,
            "programme":     programme,
            "level":         level,
            "semester":      semester,
            "academic_year": academic_year,
        }).execute()
    except Exception as e:
        return jsonify({"error": str(e), "code": 500}), 500

    # Backfill enrolments for existing students
    enrolled = backfill_student_enrolments(course_id, programme, level)

    return jsonify({
        "assignment": res.data[0],
        "students_enrolled": enrolled,
        "message": f"Assignment created. {enrolled} matching student(s) auto-enrolled.",
    }), 201


@assignments_bp.delete("/<assignment_id>")
@require_auth
@require_role("lecturer")
def delete_assignment(assignment_id: str):
    """Delete a teaching assignment (does not remove existing enrolments)."""
    res = supabase.table("lecturer_assignments").delete().eq(
        "id", assignment_id
    ).eq("lecturer_id", g.user_id).execute()
    if not res.data:
        return jsonify({"error": "Assignment not found.", "code": 404}), 404
    return jsonify({"message": "Assignment removed."}), 200
