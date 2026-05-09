"""
courses.py — Course CRUD routes and enrolment management.
Lecturers own courses; students are enrolled into them.
"""

from flask import Blueprint, request, jsonify, g
from services.supabase_client import supabase
from middleware.auth_middleware import require_auth, require_role

courses_bp = Blueprint("courses", __name__)


@courses_bp.route("/", methods=["POST"], strict_slashes=False)
@require_auth
@require_role("lecturer")
def create_course():
    """
    Create a new course owned by the authenticated lecturer.

    Body: { course_name, course_code, description }
    Returns: the created course record.
    """
    data = request.get_json(silent=True) or {}
    course_name = data.get("course_name", "").strip()
    course_code = data.get("course_code", "").strip().upper()
    description = data.get("description", "").strip()

    if not course_name or not course_code:
        return jsonify({"error": "course_name and course_code are required", "code": 400}), 400

    try:
        res = supabase.table("courses").insert({
            "course_name": course_name,
            "course_code": course_code,
            "description": description,
            "lecturer_id": g.user_id,
        }).execute()
    except Exception as e:
        return jsonify({"error": str(e), "code": 500}), 500

    return jsonify(res.data[0]), 201


@courses_bp.get("/my")
@require_auth
@require_role("lecturer")
def get_my_courses():
    """Return all courses created by the authenticated lecturer with enrolment and material counts."""
    res = supabase.table("courses").select("*, enrolments(count), materials(count)").eq(
        "lecturer_id", g.user_id
    ).order("created_at", desc=True).execute()
    return jsonify(res.data), 200


@courses_bp.get("/enrolled")
@require_auth
@require_role("student")
def get_enrolled_courses():
    """Return all courses the authenticated student is enrolled in, including lecturer profile."""
    res = supabase.table("enrolments").select(
        "*, courses(*, profiles!courses_lecturer_id_fkey(full_name, avatar_url))"
    ).eq("student_id", g.user_id).execute()

    courses = [row["courses"] for row in res.data if row.get("courses")]
    return jsonify(courses), 200


@courses_bp.get("/<course_id>")
@require_auth
def get_course(course_id: str):
    """Return a single course by ID."""
    res = supabase.table("courses").select(
        "*, profiles!courses_lecturer_id_fkey(full_name, avatar_url)"
    ).eq("id", course_id).single().execute()
    if not res.data:
        return jsonify({"error": "Course not found", "code": 404}), 404
    return jsonify(res.data), 200


@courses_bp.put("/<course_id>")
@require_auth
@require_role("lecturer")
def update_course(course_id: str):
    """
    Update course name or description. Lecturer must own the course.

    Body: { course_name?, description? }
    """
    data = request.get_json(silent=True) or {}
    updates = {}
    if "course_name" in data:
        updates["course_name"] = data["course_name"].strip()
    if "description" in data:
        updates["description"] = data["description"].strip()
    if "course_code" in data:
        updates["course_code"] = data["course_code"].strip().upper()

    if not updates:
        return jsonify({"error": "Nothing to update", "code": 400}), 400

    res = supabase.table("courses").update(updates).eq("id", course_id).eq(
        "lecturer_id", g.user_id
    ).execute()
    if not res.data:
        return jsonify({"error": "Course not found or not authorised", "code": 404}), 404
    return jsonify(res.data[0]), 200


@courses_bp.delete("/<course_id>")
@require_auth
@require_role("lecturer")
def delete_course(course_id: str):
    """Delete a course and all associated data. Lecturer must own the course."""
    res = supabase.table("courses").delete().eq("id", course_id).eq(
        "lecturer_id", g.user_id
    ).execute()
    if not res.data:
        return jsonify({"error": "Course not found or not authorised", "code": 404}), 404
    return jsonify({"message": "Course deleted"}), 200


@courses_bp.post("/<course_id>/enrol")
@require_auth
@require_role("lecturer")
def enrol_student(course_id: str):
    """
    Enrol a student into a course by email address.

    Body: { email }
    """
    data = request.get_json(silent=True) or {}
    email = data.get("email", "").strip().lower()
    if not email:
        return jsonify({"error": "Student email is required", "code": 400}), 400

    # Look up student directly from profiles table by email
    profile_res = supabase.table("profiles").select("id, role, full_name").eq("email", email).execute()

    if not profile_res.data:
        return jsonify({"error": "No account found for that email. Make sure the student has registered first.", "code": 404}), 404

    profile = profile_res.data[0]

    if profile.get("role") != "student":
        return jsonify({"error": "That account is not registered as a student.", "code": 400}), 400

    student_id = profile["id"]

    try:
        res = supabase.table("enrolments").insert({
            "student_id": student_id,
            "course_id": course_id,
        }).execute()
    except Exception as e:
        if "unique" in str(e).lower():
            return jsonify({"error": "Student is already enrolled", "code": 409}), 409
        return jsonify({"error": str(e), "code": 500}), 500

    return jsonify({"message": "Student enrolled successfully"}), 201


@courses_bp.get("/<course_id>/students")
@require_auth
@require_role("lecturer")
def get_course_students(course_id: str):
    """Return all students enrolled in a course."""
    res = supabase.table("enrolments").select(
        "*, profiles!enrolments_student_id_fkey(id, full_name, avatar_url)"
    ).eq("course_id", course_id).execute()
    students = [row["profiles"] for row in res.data if row.get("profiles")]
    return jsonify(students), 200
