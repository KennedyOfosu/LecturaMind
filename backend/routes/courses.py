"""
courses.py — Course CRUD routes and enrolment management.
Lecturers own courses; students are enrolled into them.
Supports level-based filtering (100, 200, 300, 400).
"""

from flask import Blueprint, request, jsonify, g
from services.supabase_client import supabase
from middleware.auth_middleware import require_auth, require_role

courses_bp = Blueprint("courses", __name__)

VALID_LEVELS = [100, 200, 300, 400]


@courses_bp.route("/", methods=["POST"], strict_slashes=False)
@require_auth
@require_role("lecturer")
def create_course():
    data = request.get_json(silent=True) or {}
    course_name = data.get("course_name", "").strip()
    course_code = data.get("course_code", "").strip().upper()
    description = data.get("description", "").strip()
    level       = data.get("level")

    programme   = (data.get("programme") or "").strip() or None

    if not course_name or not course_code:
        return jsonify({"error": "course_name and course_code are required", "code": 400}), 400

    try:
        level = int(level)
    except (TypeError, ValueError):
        level = None

    if level not in VALID_LEVELS:
        return jsonify({"error": "Level must be one of: 100, 200, 300, 400.", "code": 400}), 400

    try:
        res = supabase.table("courses").insert({
            "course_name": course_name,
            "course_code": course_code,
            "description": description,
            "level": level,
            "programme": programme,
            "lecturer_id": g.user_id,
        }).execute()
    except Exception as e:
        return jsonify({"error": str(e), "code": 500}), 500

    return jsonify(res.data[0]), 201


@courses_bp.get("/my")
@require_auth
@require_role("lecturer")
def get_my_courses():
    level_filter = request.args.get("level")
    query = supabase.table("courses").select("*, enrolments(count), materials(count)").eq(
        "lecturer_id", g.user_id
    )
    if level_filter:
        try:
            query = query.eq("level", int(level_filter))
        except ValueError:
            pass
    res = query.order("level").order("created_at", desc=True).execute()
    return jsonify(res.data), 200


@courses_bp.get("/enrolled")
@require_auth
@require_role("student")
def get_enrolled_courses():
    res = supabase.table("enrolments").select(
        "*, courses(*, profiles!courses_lecturer_id_fkey(full_name, avatar_url))"
    ).eq("student_id", g.user_id).execute()
    courses = [row["courses"] for row in res.data if row.get("courses")]
    return jsonify(courses), 200


@courses_bp.get("/<course_id>")
@require_auth
def get_course(course_id: str):
    res = supabase.table("courses").select(
        "*, profiles!courses_lecturer_id_fkey(full_name, avatar_url)"
    ).eq("id", course_id).execute()
    if not res.data:
        return jsonify({"error": "Course not found", "code": 404}), 404
    course = res.data[0]
    # Flatten lecturer name to top-level for easy frontend access
    course["lecturer_name"] = (course.get("profiles") or {}).get("full_name", "Lecturer")
    return jsonify(course), 200


@courses_bp.put("/<course_id>")
@require_auth
@require_role("lecturer")
def update_course(course_id: str):
    data = request.get_json(silent=True) or {}
    updates = {}
    if "course_name" in data:  updates["course_name"] = data["course_name"].strip()
    if "description"  in data: updates["description"]  = data["description"].strip()
    if "course_code"  in data: updates["course_code"]  = data["course_code"].strip().upper()
    if "level"        in data:
        try:
            lvl = int(data["level"])
            if lvl in VALID_LEVELS:
                updates["level"] = lvl
        except (TypeError, ValueError):
            pass

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
    """Enrol a student by their institution Student ID number (e.g. STU-2001)."""
    data = request.get_json(silent=True) or {}
    student_id_number = data.get("student_id_number", "").strip().upper()

    if not student_id_number:
        return jsonify({"error": "Student ID number is required.", "code": 400}), 400

    if not student_id_number.startswith("STU-"):
        return jsonify({
            "error": "Invalid ID. Student IDs must start with STU- (e.g. STU-2001).",
            "code": 400
        }), 400

    profile_res = supabase.table("profiles").select("id, full_name, role").eq(
        "user_id_number", student_id_number
    ).execute()

    if not profile_res.data:
        return jsonify({
            "error": f"No account found with ID {student_id_number}. Ask the student to register first.",
            "code": 404
        }), 404

    student = profile_res.data[0]

    if student["role"] != "student":
        return jsonify({
            "error": f"{student_id_number} belongs to a Lecturer, not a Student.",
            "code": 400
        }), 400

    existing = supabase.table("enrolments").select("id").eq(
        "student_id", student["id"]
    ).eq("course_id", course_id).execute()

    if existing.data:
        return jsonify({
            "error": f"{student['full_name']} is already enrolled in this course.",
            "code": 409
        }), 409

    supabase.table("enrolments").insert({
        "student_id": student["id"],
        "course_id": course_id,
    }).execute()

    return jsonify({
        "message": f"{student['full_name']} has been successfully enrolled.",
        "student": {
            "id": student["id"],
            "full_name": student["full_name"],
            "user_id_number": student_id_number,
        }
    }), 201


@courses_bp.get("/<course_id>/students")
@require_auth
@require_role("lecturer")
def get_course_students(course_id: str):
    res = supabase.table("enrolments").select(
        "*, profiles!enrolments_student_id_fkey(id, full_name, avatar_url, user_id_number)"
    ).eq("course_id", course_id).execute()
    students = [row["profiles"] for row in res.data if row.get("profiles")]
    return jsonify(students), 200
