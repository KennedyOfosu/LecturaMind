"""
superadmin.py — Superadmin management routes.
Full read/write access over lecturers, students, courses, classrooms,
academic structure, allocations, fees, attendance, and report cards.
All routes require superadmin role.
"""

import datetime
from flask import Blueprint, request, jsonify, g
from services.supabase_client import supabase
from middleware.auth_middleware import require_auth, require_superadmin

superadmin_bp = Blueprint("superadmin", __name__)


# ════════════════════════════════════════════════════════════════
# DASHBOARD STATS
# ════════════════════════════════════════════════════════════════

@superadmin_bp.get("/dashboard")
@require_auth
@require_superadmin
def admin_dashboard():
    total_lecturers = supabase.table("profiles").select("id", count="exact").eq("role", "lecturer").execute()
    total_students = supabase.table("profiles").select("id", count="exact").eq("role", "student").execute()
    total_courses = supabase.table("courses").select("id", count="exact").execute()
    total_enrolments = supabase.table("enrolments").select("id", count="exact").execute()
    total_classrooms = supabase.table("classrooms").select("id", count="exact").execute()

    today = datetime.date.today().isoformat()
    queries_today = supabase.table("chat_messages").select("id", count="exact").gte(
        "timestamp", f"{today}T00:00:00"
    ).execute()

    flagged_attendance = supabase.table("attendance_records").select("id", count="exact").eq(
        "is_flagged", True
    ).execute()

    active_year = supabase.table("academic_years").select("id").eq("is_active", True).execute()
    active_semester = None
    if active_year.data:
        active_sem = supabase.table("semesters").select("name").eq("academic_year_id", active_year.data[0]["id"]).eq("is_active", True).execute()
        if active_sem.data:
            active_semester = active_sem.data[0]["name"]

    unpaid_fees = supabase.table("fee_records").select("id", count="exact").neq("status", "paid").execute()

    recent_users = supabase.table("profiles").select(
        "id, full_name, email, role, user_id_number, created_at"
    ).order("created_at", desc=True).limit(10).execute()

    return jsonify({
        "total_lecturers": total_lecturers.count or 0,
        "total_students": total_students.count or 0,
        "total_courses": total_courses.count or 0,
        "total_enrolments": total_enrolments.count or 0,
        "total_classrooms": total_classrooms.count or 0,
        "queries_today": queries_today.count or 0,
        "flagged_attendance": flagged_attendance.count or 0,
        "unpaid_fees": unpaid_fees.count or 0,
        "active_semester": active_semester,
        "recent_users": recent_users.data or [],
    }), 200


# ════════════════════════════════════════════════════════════════
# USER MANAGEMENT
# ════════════════════════════════════════════════════════════════

@superadmin_bp.get("/users")
@require_auth
@require_superadmin
def list_users():
    role_filter = request.args.get("role")
    search = request.args.get("search", "").strip()

    query = supabase.table("profiles").select(
        "id, full_name, email, role, user_id_number, programme, level, academic_year, classroom_id, section, avatar_url, created_at"
    ).order("created_at", desc=True)

    if role_filter in ("lecturer", "student", "superadmin"):
        query = query.eq("role", role_filter)

    if search:
        query = query.or_(f"full_name.ilike.%{search}%,user_id_number.ilike.%{search}%,email.ilike.%{search}%")

    res = query.execute()
    return jsonify(res.data or []), 200


@superadmin_bp.get("/users/<user_id>")
@require_auth
@require_superadmin
def get_user(user_id):
    res = supabase.table("profiles").select("*, classrooms!profiles_classroom_id_fkey(name, code)").eq("id", user_id).execute()
    if not res.data:
        return jsonify({"error": "User not found", "code": 404}), 404
    return jsonify(res.data[0]), 200


@superadmin_bp.patch("/users/<user_id>")
@require_auth
@require_superadmin
def update_user(user_id):
    data = request.get_json(silent=True) or {}
    allowed_fields = [
        "full_name", "email", "role", "user_id_number",
        "programme", "level", "academic_year", "avatar_url",
        "classroom_id", "section",
    ]
    updates = {k: v for k, v in data.items() if k in allowed_fields and v is not None}

    if not updates:
        return jsonify({"error": "No valid fields to update", "code": 400}), 400

    res = supabase.table("profiles").update(updates).eq("id", user_id).execute()
    if not res.data:
        return jsonify({"error": "User not found", "code": 404}), 404
    return jsonify(res.data[0]), 200


@superadmin_bp.delete("/users/<user_id>")
@require_auth
@require_superadmin
def delete_user(user_id):
    target = supabase.table("profiles").select("id, role").eq("id", user_id).execute()
    if not target.data:
        return jsonify({"error": "User not found", "code": 404}), 404

    if target.data[0]["role"] == "superadmin":
        return jsonify({"error": "Cannot delete a superadmin", "code": 403}), 403

    supabase.table("profiles").delete().eq("id", user_id).execute()

    try:
        supabase.auth.admin.delete_user(user_id)
    except Exception as e:
        print(f"[SUPERADMIN] Auth user deletion failed (non-fatal): {e}")

    return jsonify({"message": "User deleted successfully"}), 200


# ════════════════════════════════════════════════════════════════
# COURSE MANAGEMENT
# ════════════════════════════════════════════════════════════════

@superadmin_bp.get("/courses")
@require_auth
@require_superadmin
def list_courses():
    search = request.args.get("search", "").strip()
    level_filter = request.args.get("level")

    query = supabase.table("courses").select(
        "*, profiles!courses_lecturer_id_fkey(full_name, email, user_id_number)"
    ).order("created_at", desc=True)

    if level_filter:
        try:
            query = query.eq("level", int(level_filter))
        except ValueError:
            pass

    if search:
        query = query.or_(f"course_name.ilike.%{search}%,course_code.ilike.%{search}%")

    res = query.execute()
    for c in res.data or []:
        c["lecturer_name"] = (c.get("profiles") or {}).get("full_name", "Unknown")
    return jsonify(res.data or []), 200


@superadmin_bp.post("/courses")
@require_auth
@require_superadmin
def create_course():
    data = request.get_json(silent=True) or {}
    required = ["course_name", "course_code"]
    for field in required:
        if not data.get(field):
            return jsonify({"error": f"{field} is required", "code": 400}), 400

    payload = {
        "course_name": data["course_name"],
        "course_code": data["course_code"],
        "description": data.get("description", ""),
        "level": data.get("level"),
        "programme": data.get("programme", ""),
        "lecturer_id": data.get("lecturer_id"),
    }
    res = supabase.table("courses").insert(payload).execute()
    return jsonify(res.data[0]), 201


@superadmin_bp.get("/courses/<course_id>")
@require_auth
@require_superadmin
def get_course(course_id):
    res = supabase.table("courses").select(
        "*, profiles!courses_lecturer_id_fkey(full_name, email, user_id_number)"
    ).eq("id", course_id).execute()
    if not res.data:
        return jsonify({"error": "Course not found", "code": 404}), 404
    course = res.data[0]
    course["lecturer_name"] = (course.get("profiles") or {}).get("full_name", "Unknown")
    return jsonify(course), 200


@superadmin_bp.patch("/courses/<course_id>")
@require_auth
@require_superadmin
def update_course(course_id):
    data = request.get_json(silent=True) or {}
    allowed_fields = ["course_name", "course_code", "description", "level", "programme", "lecturer_id"]
    updates = {k: v for k, v in data.items() if k in allowed_fields and v is not None}

    if not updates:
        return jsonify({"error": "No valid fields to update", "code": 400}), 400

    res = supabase.table("courses").update(updates).eq("id", course_id).execute()
    if not res.data:
        return jsonify({"error": "Course not found", "code": 404}), 404
    return jsonify(res.data[0]), 200


@superadmin_bp.delete("/courses/<course_id>")
@require_auth
@require_superadmin
def delete_course(course_id):
    res = supabase.table("courses").delete().eq("id", course_id).execute()
    if not res.data:
        return jsonify({"error": "Course not found", "code": 404}), 404
    return jsonify({"message": "Course deleted successfully"}), 200


# ════════════════════════════════════════════════════════════════
# USER REGISTRATION (admin creates accounts)
# ════════════════════════════════════════════════════════════════

@superadmin_bp.post("/register-lecturer")
@require_auth
@require_superadmin
def admin_register_lecturer():
    return _admin_create_user("lecturer")


@superadmin_bp.post("/register-student")
@require_auth
@require_superadmin
def admin_register_student():
    return _admin_create_user("student")


def _admin_create_user(role):
    data = request.get_json(silent=True) or {}
    full_name = data.get("full_name", "").strip()
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")
    id_number = data.get("id_number", "").strip().upper()

    if not all([full_name, email, password, id_number]):
        return jsonify({"error": "full_name, email, password, and id_number are required", "code": 400}), 400

    if len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters", "code": 400}), 400

    from routes.auth import _create_auth_user
    try:
        user_id = _create_auth_user(email, password, full_name, role)
    except Exception as e:
        err = str(e).lower()
        if "already" in err or "exists" in err:
            return jsonify({"error": "An account with this email already exists", "code": 409}), 409
        return jsonify({"error": f"Account creation failed: {str(e)}", "code": 400}), 400

    profile_payload = {
        "id": user_id,
        "full_name": full_name,
        "role": role,
        "email": email,
        "user_id_number": id_number,
    }

    if role == "student":
        profile_payload["programme"] = data.get("programme", "").strip()
        try:
            profile_payload["level"] = int(data.get("level", 0))
        except (TypeError, ValueError):
            profile_payload["level"] = None
        profile_payload["academic_year"] = data.get("academic_year", "").strip() or None
        profile_payload["classroom_id"] = data.get("classroom_id")
        profile_payload["section"] = data.get("section", "").strip()

    try:
        supabase.table("profiles").insert(profile_payload).execute()
    except Exception as e:
        return jsonify({"error": f"Profile creation failed: {str(e)}", "code": 500}), 500

    if role == "student":
        try:
            from services.enrolment_service import auto_enrol_student_by_programme
            auto_enrol_student_by_programme(user_id, profile_payload.get("programme"), profile_payload.get("level"))
        except Exception as e:
            print(f"[SUPERADMIN] Auto-enrolment failed (non-fatal): {e}")

    return jsonify({"message": f"{role.capitalize()} created successfully", "user_id": user_id}), 201


# ════════════════════════════════════════════════════════════════
# ENROLMENT MANAGEMENT
# ════════════════════════════════════════════════════════════════

@superadmin_bp.get("/enrolments")
@require_auth
@require_superadmin
def list_enrolments():
    course_id = request.args.get("course_id")
    query = supabase.table("enrolments").select(
        "*, profiles!enrolments_student_id_fkey(id, full_name, user_id_number, programme, level), courses!enrolments_course_id_fkey(course_name, course_code)"
    )
    if course_id:
        query = query.eq("course_id", course_id)
    res = query.order("created_at", desc=True).execute()
    return jsonify(res.data or []), 200


@superadmin_bp.post("/enrolments")
@require_auth
@require_superadmin
def create_enrolment():
    data = request.get_json(silent=True) or {}
    student_id = data.get("student_id")
    course_id = data.get("course_id")

    if not student_id or not course_id:
        return jsonify({"error": "student_id and course_id are required", "code": 400}), 400

    existing = supabase.table("enrolments").select("id").eq(
        "student_id", student_id
    ).eq("course_id", course_id).execute()
    if existing.data:
        return jsonify({"error": "Student already enrolled in this course", "code": 409}), 409

    res = supabase.table("enrolments").insert({
        "student_id": student_id,
        "course_id": course_id,
    }).execute()
    return jsonify(res.data[0]), 201


@superadmin_bp.delete("/enrolments/<enrolment_id>")
@require_auth
@require_superadmin
def remove_enrolment(enrolment_id):
    supabase.table("enrolments").delete().eq("id", enrolment_id).execute()
    return jsonify({"message": "Enrolment removed"}), 200


# ════════════════════════════════════════════════════════════════
# CLASSROOM MANAGEMENT
# ════════════════════════════════════════════════════════════════

@superadmin_bp.get("/classrooms")
@require_auth
@require_superadmin
def list_classrooms():
    res = supabase.table("classrooms").select("*").order("name").execute()
    classrooms = res.data or []
    for c in classrooms:
        count = supabase.table("profiles").select("id", count="exact").eq("classroom_id", c["id"]).execute()
        c["student_count"] = count.count or 0
    return jsonify(classrooms), 200


@superadmin_bp.post("/classrooms")
@require_auth
@require_superadmin
def create_classroom():
    data = request.get_json(silent=True) or {}
    name = data.get("name", "").strip()
    code = data.get("code", "").strip()

    if not name or not code:
        return jsonify({"error": "name and code are required", "code": 400}), 400

    res = supabase.table("classrooms").insert({
        "name": name,
        "code": code,
        "capacity": data.get("capacity", 0),
        "building": data.get("building", ""),
    }).execute()
    return jsonify(res.data[0]), 201


@superadmin_bp.patch("/classrooms/<classroom_id>")
@require_auth
@require_superadmin
def update_classroom(classroom_id):
    data = request.get_json(silent=True) or {}
    allowed_fields = ["name", "code", "capacity", "building"]
    updates = {k: v for k, v in data.items() if k in allowed_fields and v is not None}
    if not updates:
        return jsonify({"error": "No valid fields", "code": 400}), 400
    res = supabase.table("classrooms").update(updates).eq("id", classroom_id).execute()
    return jsonify(res.data[0] if res.data else {}), 200


@superadmin_bp.delete("/classrooms/<classroom_id>")
@require_auth
@require_superadmin
def delete_classroom(classroom_id):
    supabase.table("classrooms").delete().eq("id", classroom_id).execute()
    return jsonify({"message": "Classroom deleted"}), 200


# ════════════════════════════════════════════════════════════════
# ACADEMIC STRUCTURE
# ════════════════════════════════════════════════════════════════

# ── Academic Years ──

@superadmin_bp.get("/academic-years")
@require_auth
@require_superadmin
def list_academic_years():
    res = supabase.table("academic_years").select("*").order("start_date", desc=True).execute()
    return jsonify(res.data or []), 200


@superadmin_bp.post("/academic-years")
@require_auth
@require_superadmin
def create_academic_year():
    data = request.get_json(silent=True) or {}
    required = ["name", "start_date", "end_date"]
    for f in required:
        if not data.get(f):
            return jsonify({"error": f"{f} is required", "code": 400}), 400

    active = data.get("is_active", False)
    if active:
        supabase.table("academic_years").update({"is_active": False}).eq("is_active", True).execute()

    res = supabase.table("academic_years").insert({
        "name": data["name"],
        "start_date": data["start_date"],
        "end_date": data["end_date"],
        "is_active": active,
    }).execute()
    return jsonify(res.data[0]), 201


@superadmin_bp.patch("/academic-years/<year_id>")
@require_auth
@require_superadmin
def update_academic_year(year_id):
    data = request.get_json(silent=True) or {}
    allowed = ["name", "start_date", "end_date", "is_active"]
    updates = {k: v for k, v in data.items() if k in allowed and v is not None}

    if updates.get("is_active"):
        supabase.table("academic_years").update({"is_active": False}).eq("is_active", True).execute()

    res = supabase.table("academic_years").update(updates).eq("id", year_id).execute()
    return jsonify(res.data[0] if res.data else {}), 200


# ── Semesters ──

@superadmin_bp.get("/semesters")
@require_auth
@require_superadmin
def list_semesters():
    year_id = request.args.get("academic_year_id")
    query = supabase.table("semesters").select("*, academic_years!semesters_academic_year_id_fkey(name)").order("start_date", desc=True)
    if year_id:
        query = query.eq("academic_year_id", year_id)
    res = query.execute()
    for s in res.data or []:
        s["academic_year_name"] = (s.get("academic_years") or {}).get("name", "")
    return jsonify(res.data or []), 200


@superadmin_bp.post("/semesters")
@require_auth
@require_superadmin
def create_semester():
    data = request.get_json(silent=True) or {}
    required = ["academic_year_id", "name", "semester_number", "start_date", "end_date"]
    for f in required:
        if not data.get(f):
            return jsonify({"error": f"{f} is required", "code": 400}), 400

    active = data.get("is_active", False)
    if active:
        supabase.table("semesters").update({"is_active": False}).eq("is_active", True).execute()

    res = supabase.table("semesters").insert({
        "academic_year_id": data["academic_year_id"],
        "name": data["name"],
        "semester_number": data["semester_number"],
        "start_date": data["start_date"],
        "end_date": data["end_date"],
        "is_active": active,
    }).execute()
    return jsonify(res.data[0]), 201


@superadmin_bp.patch("/semesters/<semester_id>")
@require_auth
@require_superadmin
def update_semester(semester_id):
    data = request.get_json(silent=True) or {}
    allowed = ["name", "semester_number", "start_date", "end_date", "is_active"]
    updates = {k: v for k, v in data.items() if k in allowed and v is not None}

    if updates.get("is_active"):
        supabase.table("semesters").update({"is_active": False}).eq("is_active", True).execute()

    res = supabase.table("semesters").update(updates).eq("id", semester_id).execute()
    return jsonify(res.data[0] if res.data else {}), 200


# ── Grading Scales ──

@superadmin_bp.get("/grading-scales")
@require_auth
@require_superadmin
def list_grading_scales():
    year_id = request.args.get("academic_year_id")
    query = supabase.table("grading_scales").select("*").order("min_score")
    if year_id:
        query = query.eq("academic_year_id", year_id)
    res = query.execute()
    return jsonify(res.data or []), 200


@superadmin_bp.post("/grading-scales")
@require_auth
@require_superadmin
def create_grading_scale():
    data = request.get_json(silent=True) or {}
    required = ["label", "grade_letter", "min_score", "max_score", "grade_point"]
    for f in required:
        if data.get(f) is None:
            return jsonify({"error": f"{f} is required", "code": 400}), 400

    res = supabase.table("grading_scales").insert({
        "label": data["label"],
        "grade_letter": data["grade_letter"],
        "min_score": data["min_score"],
        "max_score": data["max_score"],
        "grade_point": data["grade_point"],
        "academic_year_id": data.get("academic_year_id"),
    }).execute()
    return jsonify(res.data[0]), 201


@superadmin_bp.patch("/grading-scales/<scale_id>")
@require_auth
@require_superadmin
def update_grading_scale(scale_id):
    data = request.get_json(silent=True) or {}
    allowed = ["label", "grade_letter", "min_score", "max_score", "grade_point", "is_active"]
    updates = {k: v for k, v in data.items() if k in allowed and v is not None}
    res = supabase.table("grading_scales").update(updates).eq("id", scale_id).execute()
    return jsonify(res.data[0] if res.data else {}), 200


@superadmin_bp.delete("/grading-scales/<scale_id>")
@require_auth
@require_superadmin
def delete_grading_scale(scale_id):
    supabase.table("grading_scales").delete().eq("id", scale_id).execute()
    return jsonify({"message": "Grading scale deleted"}), 200


# ════════════════════════════════════════════════════════════════
# ALLOCATIONS
# ════════════════════════════════════════════════════════════════

@superadmin_bp.post("/allocate-lecturer")
@require_auth
@require_superadmin
def allocate_lecturer():
    """Map a lecturer to a course via lecturer_assignments."""
    data = request.get_json(silent=True) or {}
    lecturer_id = data.get("lecturer_id")
    course_id = data.get("course_id")

    if not lecturer_id or not course_id:
        return jsonify({"error": "lecturer_id and course_id are required", "code": 400}), 400

    course = supabase.table("courses").select("programme, level").eq("id", course_id).execute()
    if not course.data:
        return jsonify({"error": "Course not found", "code": 404}), 404

    existing = supabase.table("lecturer_assignments").select("id").eq(
        "lecturer_id", lecturer_id
    ).eq("course_id", course_id).execute()
    if existing.data:
        return jsonify({"error": "Lecturer already assigned to this course", "code": 409}), 409

    res = supabase.table("lecturer_assignments").insert({
        "lecturer_id": lecturer_id,
        "course_id": course_id,
        "programme": course.data[0].get("programme", ""),
        "level": course.data[0].get("level"),
        "semester": data.get("semester", "Semester 1"),
        "academic_year": data.get("academic_year", ""),
    }).execute()

    supabase.table("courses").update({"lecturer_id": lecturer_id}).eq("id", course_id).execute()

    return jsonify(res.data[0]), 201


@superadmin_bp.post("/allocate-classroom")
@require_auth
@require_superadmin
def allocate_classroom():
    """Assign a student to a classroom."""
    data = request.get_json(silent=True) or {}
    student_id = data.get("student_id")
    classroom_id = data.get("classroom_id")
    section = data.get("section", "").strip()

    if not student_id or not classroom_id:
        return jsonify({"error": "student_id and classroom_id are required", "code": 400}), 400

    supabase.table("profiles").update({
        "classroom_id": classroom_id,
        "section": section or None,
    }).eq("id", student_id).execute()

    return jsonify({"message": "Student allocated to classroom"}), 200


@superadmin_bp.get("/allocations")
@require_auth
@require_superadmin
def list_allocations():
    """Get all lecturer-course assignments."""
    res = supabase.table("lecturer_assignments").select(
        "*, profiles!lecturer_assignments_lecturer_id_fkey(full_name, user_id_number), "
        "courses!lecturer_assignments_course_id_fkey(course_name, course_code)"
    ).order("created_at", desc=True).execute()

    for a in res.data or []:
        a["lecturer_name"] = (a.get("profiles") or {}).get("full_name", "Unknown")
        a["course_name"] = (a.get("courses") or {}).get("course_name", "Unknown")
        a["course_code"] = (a.get("courses") or {}).get("course_code", "")
    return jsonify(res.data or []), 200


# ════════════════════════════════════════════════════════════════
# FEES & PAYMENTS
# ════════════════════════════════════════════════════════════════

@superadmin_bp.get("/fees")
@require_auth
@require_superadmin
def list_fees():
    status_filter = request.args.get("status")
    query = supabase.table("fee_records").select(
        "*, profiles!fee_records_student_id_fkey(full_name, user_id_number), "
        "fee_types!fee_records_fee_type_id_fkey(name, amount), "
        "academic_years!fee_records_academic_year_id_fkey(name)"
    )
    if status_filter:
        query = query.eq("status", status_filter)
    res = query.order("created_at", desc=True).execute()
    return jsonify(res.data or []), 200


@superadmin_bp.post("/fees")
@require_auth
@require_superadmin
def create_fee_record():
    data = request.get_json(silent=True) or {}
    required = ["student_id", "fee_type_id", "total_amount"]
    for f in required:
        if not data.get(f):
            return jsonify({"error": f"{f} is required", "code": 400}), 400

    res = supabase.table("fee_records").insert({
        "student_id": data["student_id"],
        "fee_type_id": data["fee_type_id"],
        "total_amount": data["total_amount"],
        "amount_paid": data.get("amount_paid", 0),
        "due_date": data.get("due_date"),
        "academic_year_id": data.get("academic_year_id"),
        "semester_id": data.get("semester_id"),
        "status": data.get("status", "unpaid"),
    }).execute()
    return jsonify(res.data[0]), 201


@superadmin_bp.patch("/fees/<fee_id>")
@require_auth
@require_superadmin
def update_fee(fee_id):
    data = request.get_json(silent=True) or {}
    allowed = ["total_amount", "amount_paid", "due_date", "status"]
    updates = {k: v for k, v in data.items() if k in allowed and v is not None}
    if not updates:
        return jsonify({"error": "No valid fields", "code": 400}), 400
    res = supabase.table("fee_records").update(updates).eq("id", fee_id).execute()
    return jsonify(res.data[0] if res.data else {}), 200


@superadmin_bp.get("/fees/types")
@require_auth
@require_superadmin
def list_fee_types():
    res = supabase.table("fee_types").select("*").order("name").execute()
    return jsonify(res.data or []), 200


@superadmin_bp.post("/fees/types")
@require_auth
@require_superadmin
def create_fee_type():
    data = request.get_json(silent=True) or {}
    required = ["name", "amount"]
    for f in required:
        if not data.get(f):
            return jsonify({"error": f"{f} is required", "code": 400}), 400

    res = supabase.table("fee_types").insert({
        "name": data["name"],
        "description": data.get("description", ""),
        "amount": data["amount"],
        "academic_year_id": data.get("academic_year_id"),
        "is_compulsory": data.get("is_compulsory", True),
    }).execute()
    return jsonify(res.data[0]), 201


@superadmin_bp.delete("/fees/types/<type_id>")
@require_auth
@require_superadmin
def delete_fee_type(type_id):
    supabase.table("fee_types").delete().eq("id", type_id).execute()
    return jsonify({"message": "Fee type deleted"}), 200


@superadmin_bp.get("/payments")
@require_auth
@require_superadmin
def list_payments():
    fee_id = request.args.get("fee_record_id")
    query = supabase.table("fee_payments").select(
        "*, profiles!fee_payments_recorded_by_fkey(full_name), "
        "fee_records!fee_payments_fee_record_id_fkey(student_id)"
    ).order("payment_date", desc=True)
    if fee_id:
        query = query.eq("fee_record_id", fee_id)
    res = query.execute()
    return jsonify(res.data or []), 200


@superadmin_bp.post("/payments")
@require_auth
@require_superadmin
def record_payment():
    data = request.get_json(silent=True) or {}
    required = ["fee_record_id", "amount"]
    for f in required:
        if not data.get(f):
            return jsonify({"error": f"{f} is required", "code": 400}), 400

    res = supabase.table("fee_payments").insert({
        "fee_record_id": data["fee_record_id"],
        "amount": data["amount"],
        "payment_method": data.get("payment_method", "cash"),
        "reference": data.get("reference", ""),
        "notes": data.get("notes", ""),
        "recorded_by": g.user_id,
    }).execute()

    fee = supabase.table("fee_records").select("total_amount, amount_paid").eq("id", data["fee_record_id"]).execute()
    if fee.data:
        total = fee.data[0]["total_amount"]
        paid = (fee.data[0]["amount_paid"] or 0) + data["amount"]
        if paid >= total:
            new_status = "paid" if paid == total else "overpaid"
        elif paid > 0:
            new_status = "partial"
        else:
            new_status = "unpaid"
        supabase.table("fee_records").update({
            "amount_paid": paid,
            "status": new_status,
        }).eq("id", data["fee_record_id"]).execute()

    return jsonify(res.data[0]), 201


# ════════════════════════════════════════════════════════════════
# ATTENDANCE OVERSIGHT
# ════════════════════════════════════════════════════════════════

@superadmin_bp.get("/attendance")
@require_auth
@require_superadmin
def get_attendance():
    """View attendance records with filters and flagging."""
    course_id = request.args.get("course_id")
    student_id = request.args.get("student_id")
    flagged_only = request.args.get("flagged", "").lower() == "true"
    start_date = request.args.get("start_date")
    end_date = request.args.get("end_date")

    query = supabase.table("attendance_records").select(
        "*, profiles!attendance_records_student_id_fkey(full_name, user_id_number), "
        "courses!attendance_records_course_id_fkey(course_name, course_code)"
    )

    if course_id:
        query = query.eq("course_id", course_id)
    if student_id:
        query = query.eq("student_id", student_id)
    if flagged_only:
        query = query.eq("is_flagged", True)
    if start_date:
        query = query.gte("date", start_date)
    if end_date:
        query = query.lte("date", end_date)

    res = query.order("date", desc=True).limit(200).execute()
    records = res.data or []

    total = len(records)
    present = sum(1 for r in records if r["status"] == "present")
    absent = sum(1 for r in records if r["status"] == "absent")
    late = sum(1 for r in records if r["status"] == "late")
    excused = sum(1 for r in records if r["status"] == "excused")

    return jsonify({
        "records": records,
        "summary": {
            "total": total,
            "present": present,
            "absent": absent,
            "late": late,
            "excused": excused,
            "attendance_rate": round((present / total * 100), 1) if total else 0,
        },
    }), 200


@superadmin_bp.patch("/attendance/<record_id>")
@require_auth
@require_superadmin
def update_attendance(record_id):
    """Override or clear an attendance flag."""
    data = request.get_json(silent=True) or {}
    allowed = ["status", "is_flagged", "flag_reason"]
    updates = {k: v for k, v in data.items() if k in allowed and v is not None}
    if not updates:
        return jsonify({"error": "No valid fields", "code": 400}), 400
    res = supabase.table("attendance_records").update(updates).eq("id", record_id).execute()
    return jsonify(res.data[0] if res.data else {}), 200


# ════════════════════════════════════════════════════════════════
# REPORT CARDS
# ════════════════════════════════════════════════════════════════

@superadmin_bp.post("/report-cards/generate")
@require_auth
@require_superadmin
def generate_report_card():
    """Generate a report card for a single student."""
    data = request.get_json(silent=True) or {}
    student_id = data.get("student_id")
    semester_id = data.get("semester_id")
    academic_year_id = data.get("academic_year_id")

    if not all([student_id, semester_id, academic_year_id]):
        return jsonify({"error": "student_id, semester_id, and academic_year_id are required", "code": 400}), 400

    from services.grade_service import generate_report_card as gen_rc
    result = gen_rc(student_id, semester_id, academic_year_id)
    return jsonify(result), 200


@superadmin_bp.post("/report-cards/generate-bulk")
@require_auth
@require_superadmin
def generate_bulk_report_cards():
    """Generate report cards for all matching students."""
    data = request.get_json(silent=True) or {}
    semester_id = data.get("semester_id")
    academic_year_id = data.get("academic_year_id")
    programme = data.get("programme")
    level = data.get("level")

    if not all([semester_id, academic_year_id]):
        return jsonify({"error": "semester_id and academic_year_id are required", "code": 400}), 400

    from services.grade_service import generate_bulk_report_cards as bulk_gen
    result = bulk_gen(semester_id, academic_year_id, programme, level)
    return jsonify(result), 200


@superadmin_bp.get("/report-cards")
@require_auth
@require_superadmin
def list_report_cards():
    """List all report cards."""
    student_id = request.args.get("student_id")
    semester_id = request.args.get("semester_id")

    query = supabase.table("report_cards").select(
        "*, profiles!report_cards_student_id_fkey(full_name, user_id_number), "
        "semesters!report_cards_semester_id_fkey(name), "
        "academic_years!report_cards_academic_year_id_fkey(name)"
    ).order("created_at", desc=True)

    if student_id:
        query = query.eq("student_id", student_id)
    if semester_id:
        query = query.eq("semester_id", semester_id)

    res = query.execute()
    for rc in res.data or []:
        rc["student_name"] = (rc.get("profiles") or {}).get("full_name", "Unknown")
        rc["semester_name"] = (rc.get("semesters") or {}).get("name", "")
        rc["academic_year_name"] = (rc.get("academic_years") or {}).get("name", "")

        courses = supabase.table("report_card_courses").select("*").eq("report_card_id", rc["id"]).execute()
        rc["courses"] = courses.data or []

    return jsonify(res.data or []), 200


@superadmin_bp.get("/report-cards/<rc_id>")
@require_auth
@require_superadmin
def get_report_card(rc_id):
    res = supabase.table("report_cards").select(
        "*, profiles!report_cards_student_id_fkey(full_name, user_id_number, programme, level), "
        "semesters!report_cards_semester_id_fkey(name), "
        "academic_years!report_cards_academic_year_id_fkey(name)"
    ).eq("id", rc_id).execute()
    if not res.data:
        return jsonify({"error": "Report card not found", "code": 404}), 404

    rc = res.data[0]
    rc["student_name"] = (rc.get("profiles") or {}).get("full_name", "")
    rc["semester_name"] = (rc.get("semesters") or {}).get("name", "")
    rc["academic_year_name"] = (rc.get("academic_years") or {}).get("name", "")

    courses = supabase.table("report_card_courses").select("*").eq("report_card_id", rc_id).execute()
    rc["courses"] = courses.data or []

    return jsonify(rc), 200


@superadmin_bp.post("/report-cards/<rc_id>/finalize")
@require_auth
@require_superadmin
def finalize_report_card(rc_id):
    from services.grade_service import finalize_report_card as finalize
    result = finalize(rc_id)
    return jsonify(result), 200


# ════════════════════════════════════════════════════════════════
# TIMETABLE SLOTS
# ════════════════════════════════════════════════════════════════

@superadmin_bp.get("/timetable-slots")
@require_auth
@require_superadmin
def list_timetable_slots():
    res = supabase.table("timetable_slots").select("*").order("day_of_week").order("start_time").execute()
    return jsonify(res.data or []), 200


@superadmin_bp.post("/timetable-slots")
@require_auth
@require_superadmin
def create_timetable_slot():
    data = request.get_json(silent=True) or {}
    required = ["day_of_week", "start_time", "end_time"]
    for f in required:
        if not data.get(f):
            return jsonify({"error": f"{f} is required", "code": 400}), 400
    res = supabase.table("timetable_slots").insert({
        "day_of_week": data["day_of_week"],
        "start_time": data["start_time"],
        "end_time": data["end_time"],
    }).execute()
    return jsonify(res.data[0]), 201


@superadmin_bp.delete("/timetable-slots/<slot_id>")
@require_auth
@require_superadmin
def delete_timetable_slot(slot_id):
    supabase.table("timetable_slots").delete().eq("id", slot_id).execute()
    return jsonify({"message": "Slot deleted"}), 200
