"""
superadmin.py — Superadmin management routes.
Full read/write access over lecturers, students, courses, classrooms,
academic structure, allocations, fees, attendance, and report cards.
All routes require superadmin role.
"""

import datetime
import re
import secrets
import requests as http_requests
from urllib.parse import urlencode
from flask import Blueprint, request, jsonify, g
from services.supabase_client import supabase
from middleware.auth_middleware import require_auth, require_superadmin, _retry_transient_supabase_call
from config import Config
from services.lecturer_activation import create_activation_token
from services.registration_identity import duplicate_identity_errors, normalize_email, unique_constraint_field

superadmin_bp = Blueprint("superadmin", __name__)


# ════════════════════════════════════════════════════════════════
# DASHBOARD STATS
# ════════════════════════════════════════════════════════════════

@superadmin_bp.get("/dashboard")
@require_auth
@require_superadmin
def admin_dashboard():
    unavailable = []

    def read_all(table, columns, warning_key, configure=None):
        rows = []
        try:
            offset = 0
            while True:
                query = supabase.table(table).select(columns)
                if configure:
                    query = configure(query)
                page = query.range(offset, offset + 999).execute().data or []
                rows.extend(page)
                if len(page) < 1000:
                    break
                offset += 1000
            return rows
        except Exception as exc:
            print(f"[admin_dashboard] {warning_key} unavailable: {exc}")
            unavailable.append(warning_key)
            return None

    profiles = read_all("profiles", "id, role, classroom_id, created_at", "profiles")
    profiles_available = profiles is not None
    profiles = profiles or []
    account_states = read_all(
        "profiles", "id, account_status, activated_at", "account_status",
    )
    account_states_available = account_states is not None
    if account_states is not None:
        states_by_id = {row.get("id"): row for row in account_states}
        for profile in profiles:
            state = states_by_id.get(profile.get("id"), {})
            profile["account_status"] = state.get("account_status") or "active"
            profile["activated_at"] = state.get("activated_at")
    for profile in profiles:
        profile.setdefault("account_status", "active")
        profile.setdefault("activated_at", None)

    classrooms = read_all("classrooms", "id, name, code, building", "classrooms")
    classrooms_available = classrooms is not None
    classrooms = classrooms or []
    lecturer_assignments = read_all(
        "lecturer_classrooms", "lecturer_id, classroom_id, assigned_at", "lecturer_classrooms",
    )
    assignment_data_available = lecturer_assignments is not None
    lecturer_assignments = lecturer_assignments or []

    students = [profile for profile in profiles if profile.get("role") == "student"]
    lecturers = [profile for profile in profiles if profile.get("role") == "lecturer"]
    status = lambda profile: profile.get("account_status") or "active"
    active_lecturer_ids = {profile.get("id") for profile in lecturers if status(profile) == "active"}
    lecturer_ids_with_classes = {row.get("lecturer_id") for row in lecturer_assignments} & active_lecturer_ids
    classroom_ids_with_lecturers = {
        row.get("classroom_id") for row in lecturer_assignments
        if row.get("lecturer_id") in active_lecturer_ids
    }

    student_counts = {}
    for student in students:
        classroom_id = student.get("classroom_id")
        if classroom_id:
            student_counts[classroom_id] = student_counts.get(classroom_id, 0) + 1
    lecturer_counts = {}
    for assignment in lecturer_assignments:
        classroom_id = assignment.get("classroom_id")
        if classroom_id and assignment.get("lecturer_id") in active_lecturer_ids:
            lecturer_counts[classroom_id] = lecturer_counts.get(classroom_id, 0) + 1

    course_count = None
    enrolment_count = None
    for table, target, warning_key in (
        ("courses", "course_count", "courses"),
        ("enrolments", "enrolment_count", "enrolments"),
    ):
        try:
            result = supabase.table(table).select("id", count="exact").execute()
            value = result.count if result.count is not None else len(result.data or [])
            if target == "course_count":
                course_count = value
            else:
                enrolment_count = value
        except Exception as exc:
            print(f"[admin_dashboard] {warning_key} count unavailable: {exc}")
            unavailable.append(warning_key)

    academic_year = None
    semester = None
    try:
        year_result = supabase.table("academic_years").select("id, name").eq(
            "is_active", True
        ).limit(1).execute()
        if year_result.data:
            academic_year = year_result.data[0].get("name")
            semester_result = supabase.table("semesters").select("name").eq(
                "academic_year_id", year_result.data[0]["id"]
            ).eq("is_active", True).limit(1).execute()
            if semester_result.data:
                semester = semester_result.data[0].get("name")
    except Exception as exc:
        print(f"[admin_dashboard] academic period unavailable: {exc}")
        unavailable.append("academic_period")

    activity = []
    try:
        events = supabase.table("school_activity_log").select(
            "id, event_type, details, occurred_at"
        ).order("occurred_at", desc=True).limit(12).execute().data or []
        labels = {
            "account_created": "Account created",
            "account_activated": "Account activated",
            "account_deactivated": "Account deactivated",
            "account_reactivated": "Account reactivated",
            "student_class_assigned": "Student assigned to class",
            "student_class_unassigned": "Student removed from class",
            "lecturer_class_assigned": "Lecturer assigned to class",
            "lecturer_class_unassigned": "Lecturer removed from class",
            "announcement_published": "Announcement published",
        }
        for event in events:
            details = event.get("details") or {}
            role = details.get("role")
            class_name = details.get("class_name") or details.get("class_code")
            announcement_title = details.get("announcement_title")
            detail = announcement_title or class_name or (role.replace("_", " ").title() if role else "School operations")
            activity.append({
                "id": event.get("id"),
                "type": event.get("event_type"),
                "title": labels.get(event.get("event_type"), "School activity"),
                "detail": detail,
                "timestamp": event.get("occurred_at"),
            })
    except Exception as exc:
        print(f"[admin_dashboard] activity log unavailable: {exc}")
        unavailable.append("school_activity_log")

    class_distribution = [{
        "id": classroom.get("id"),
        "name": classroom.get("name") or "Unnamed class",
        "code": classroom.get("code") or "",
        "building": classroom.get("building") or "",
        "students": student_counts.get(classroom.get("id"), 0),
        "lecturers": lecturer_counts.get(classroom.get("id"), 0),
    } for classroom in classrooms]
    class_distribution.sort(key=lambda row: (-row["students"], row["name"].lower()))

    if not activity:
        # The log starts collecting events when migration 010 is installed.
        # Until it has entries, use existing timestamps as a historical feed.
        for profile in profiles:
            role = profile.get("role") or "account"
            if profile.get("created_at"):
                activity.append({
                    "id": f"created-{profile.get('id')}",
                    "type": "account_created",
                    "title": "Account created",
                    "detail": role.replace("_", " ").title(),
                    "timestamp": profile.get("created_at"),
                })
            if profile.get("activated_at"):
                activity.append({
                    "id": f"activated-{profile.get('id')}",
                    "type": "account_activated",
                    "title": "Account activated",
                    "detail": role.replace("_", " ").title(),
                    "timestamp": profile.get("activated_at"),
                })
        classroom_by_id = {row.get("id"): row for row in class_distribution}
        for assignment in lecturer_assignments:
            classroom = classroom_by_id.get(assignment.get("classroom_id"), {})
            when = assignment.get("assigned_at")
            if when:
                activity.append({
                    "id": f"lecturer-class-{assignment.get('lecturer_id')}-{assignment.get('classroom_id')}",
                    "type": "lecturer_class_assigned",
                    "title": "Lecturer assigned to class",
                    "detail": classroom.get("name") or classroom.get("code") or "Class assignment",
                    "timestamp": when,
                })
        try:
            published = supabase.table("announcements").select(
                "id, title, posted_at"
            ).eq("status", "published").order("posted_at", desc=True).limit(8).execute().data or []
            activity.extend({
                "id": f"announcement-{row.get('id')}",
                "type": "announcement_published",
                "title": "Announcement published",
                "detail": row.get("title") or "Announcement",
                "timestamp": row.get("posted_at"),
            } for row in published if row.get("posted_at"))
        except Exception as exc:
            print(f"[admin_dashboard] historical announcements unavailable: {exc}")
            unavailable.append("announcements")
        activity.sort(key=lambda item: item.get("timestamp") or "", reverse=True)
        activity = activity[:12]

    attention = [
        {"key": "pending_activations", "label": "Pending account activations", "count": sum(1 for p in profiles if status(p) == "pending_activation") if profiles_available and account_states_available else None, "href": "/superadmin/users?role=lecturer&status=pending_activation"},
        {"key": "students_without_class", "label": "Students without a class", "count": sum(1 for p in students if not p.get("classroom_id")) if profiles_available else None, "href": "/superadmin/users?role=student&unassigned=true"},
        {"key": "lecturers_without_class", "label": "Active lecturers without a class", "count": sum(1 for p in lecturers if status(p) == "active" and p.get("id") not in lecturer_ids_with_classes) if assignment_data_available else None, "href": "/superadmin/users?role=lecturer&status=active&unassigned=true"},
        {"key": "classes_without_lecturers", "label": "Classes without assigned lecturers", "count": sum(1 for c in classrooms if c.get("id") not in classroom_ids_with_lecturers) if assignment_data_available else None, "href": "/superadmin/classrooms?lecturer_assignment=missing"},
        {"key": "deactivated_accounts", "label": "Deactivated accounts", "count": sum(1 for p in profiles if status(p) == "deactivated") if profiles_available and account_states_available else None, "href": "/superadmin/users?status=deactivated"},
    ]
    attention_count = sum(item["count"] or 0 for item in attention)

    return jsonify({
        "total_students": len(students) if profiles_available else None,
        "total_lecturers": len(lecturers) if profiles_available else None,
        "total_classrooms": len(classrooms) if classrooms_available else None,
        "total_courses": course_count,
        "total_course_enrolments": enrolment_count,
        "academic_year": academic_year,
        "active_semester": semester,
        "academic_period": " · ".join(part for part in (academic_year, semester) if part) or None,
        "attention": attention,
        "attention_count": attention_count,
        "class_distribution": class_distribution,
        "coverage": {
            "students_assigned": len(students) - sum(1 for student in students if not student.get("classroom_id")) if profiles_available else None,
            "total_students": len(students) if profiles_available else None,
            "lecturers_assigned": len(lecturer_ids_with_classes) if assignment_data_available else None,
            "total_lecturers": len(active_lecturer_ids) if profiles_available else None,
            "classes_with_lecturers": len(classroom_ids_with_lecturers) if assignment_data_available else None,
            "total_classes": len(classrooms) if classrooms_available else None,
        },
        "recent_activity": activity,
        "generated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "data_warnings": sorted(set(unavailable)),
    }), 200


# ════════════════════════════════════════════════════════════════
# USER MANAGEMENT
# ════════════════════════════════════════════════════════════════

def _attach_lecturer_teaching_data(users):
    lecturer_ids = [user["id"] for user in users if user.get("role") == "lecturer"]
    if not lecturer_ids:
        return users

    assignments_by_lecturer = {lecturer_id: [] for lecturer_id in lecturer_ids}
    assignments = supabase.table("lecturer_assignments").select(
        "id, lecturer_id, course_id, programme, level, semester, academic_year, "
        "courses!lecturer_assignments_course_id_fkey(id, course_name, course_code, lecturer_id, programme, level)"
    ).in_("lecturer_id", lecturer_ids).execute()
    for assignment in assignments.data or []:
        course = assignment.get("courses") or {}
        if not course:
            continue
        assignments_by_lecturer.setdefault(assignment["lecturer_id"], []).append({
            "assignment_id": assignment["id"],
            "id": course.get("id"),
            "course_id": assignment.get("course_id"),
            "course_name": course.get("course_name"),
            "course_code": course.get("course_code"),
            "programme": assignment.get("programme") or course.get("programme"),
            "level": assignment.get("level") or course.get("level"),
            "semester": assignment.get("semester"),
            "academic_year": assignment.get("academic_year"),
            "course_lecturer_id": course.get("lecturer_id"),
        })

    schedules_by_lecturer = {lecturer_id: [] for lecturer_id in lecturer_ids}
    try:
        schedules = supabase.table("course_schedules").select(
            "id, assignment_id, course_id, lecturer_id, classroom_id, physical_room_id, programme, level, "
            "academic_year, semester, session_type, day_of_week, start_time, end_time, "
            "courses!course_schedules_course_id_fkey(course_name, course_code), "
            "classrooms!course_schedules_classroom_id_fkey(id, name, code, programme, level, room_id, physical_rooms!classrooms_room_id_fkey(id, name, code, building, campus, capacity)), "
            "physical_rooms!course_schedules_physical_room_id_fkey(id, name, code, building, campus, capacity)"
        ).in_("lecturer_id", lecturer_ids).execute()
        for schedule in schedules.data or []:
            course = schedule.pop("courses", None) or {}
            classroom = _serialize_classroom(schedule.pop("classrooms", None)) or {}
            scheduled_room = schedule.pop("physical_rooms", None)
            schedule["course_name"] = course.get("course_name")
            schedule["course_code"] = course.get("course_code")
            schedule["classroom_name"] = classroom.get("name")
            schedule["classroom_code"] = classroom.get("code")
            schedule["classroom_programme"] = classroom.get("programme")
            schedule["classroom_level"] = classroom.get("level")
            schedule["physical_room"] = scheduled_room or classroom.get("physical_room")
            schedule["classroom"] = classroom
            schedules_by_lecturer.setdefault(schedule["lecturer_id"], []).append(schedule)
    except Exception as exc:
        error_text = str(exc).lower()
        if "course_schedules" not in error_text or not any(
            marker in error_text for marker in ("pgrst205", "could not find the table", "does not exist")
        ):
            raise
        print("[SUPERADMIN] course_schedules migration is pending; showing assignments without meeting times.")

    for user in users:
        if user.get("role") != "lecturer":
            continue
        teaching_assignments = assignments_by_lecturer.get(user["id"], [])
        # A lecturer may have more than one assignment row for the same course
        # (for example across terms). The Users overview counts distinct courses,
        # while retaining all assignment rows for the details view.
        user["assigned_course_count"] = len({
            assignment.get("course_id") or assignment.get("id")
            for assignment in teaching_assignments
            if assignment.get("course_id") or assignment.get("id")
        })
        schedules = schedules_by_lecturer.get(user["id"], [])
        schedules_by_assignment = {schedule["assignment_id"]: schedule for schedule in schedules}
        for assignment in teaching_assignments:
            assignment["schedule"] = schedules_by_assignment.get(assignment["assignment_id"])
        user["assigned_courses"] = teaching_assignments
        user["assigned_programmes"] = sorted({a["programme"] for a in teaching_assignments if a.get("programme")})
        user["teaching_levels"] = sorted({a["level"] for a in teaching_assignments if a.get("level")})
        user["teaching_schedules"] = sorted(
            schedules,
            key=lambda schedule: (schedule.get("day_of_week", 0), str(schedule.get("start_time", ""))),
        )
    return users


def _serialize_classroom(classroom):
    if not classroom:
        return None
    result = dict(classroom)
    room = result.pop("physical_rooms", None) or result.pop("physical_room", None)
    result["physical_room"] = room
    result["class_code"] = result.get("code")
    result["code"] = room.get("code") if room else None
    result["room_name"] = room.get("name") if room else None
    result["building"] = room.get("building") if room else result.get("building")
    result["campus"] = room.get("campus") if room else None
    result["capacity"] = room.get("capacity") if room else None
    return result


@superadmin_bp.get("/users")
@require_auth
@require_superadmin
def list_users():
    role_filter = request.args.get("role")
    status_filter = request.args.get("status")
    unassigned_filter = request.args.get("unassigned") == "true"
    search = request.args.get("search", "").strip()

    query = supabase.table("profiles").select(
        "id, full_name, email, role, user_id_number, programme, level, academic_year, classroom_id, section, avatar_url, created_at, account_status, activated_at, classrooms!profiles_classroom_id_fkey(id, name, code, programme, level, room_id, physical_rooms!classrooms_room_id_fkey(id, name, code, building, campus, capacity))"
    ).order("created_at", desc=True)

    if role_filter in ("lecturer", "student", "superadmin"):
        query = query.eq("role", role_filter)

    if search:
        query = query.or_(f"full_name.ilike.%{search}%,user_id_number.ilike.%{search}%,email.ilike.%{search}%")

    try:
        res = query.execute()
    except Exception as exc:
        error_text = str(exc).lower()
        missing_activation_column = (
            "account_status" in error_text
            and ("does not exist" in error_text or "42703" in error_text)
        )
        if not missing_activation_column:
            raise
        print("[SUPERADMIN] account_status migration is pending; returning legacy user fields.")
        query = supabase.table("profiles").select(
            "id, full_name, email, role, user_id_number, programme, level, academic_year, classroom_id, section, avatar_url, created_at, classrooms!profiles_classroom_id_fkey(id, name, code, programme, level, room_id, physical_rooms!classrooms_room_id_fkey(id, name, code, building, campus, capacity))"
        ).order("created_at", desc=True)
        if role_filter in ("lecturer", "student", "superadmin"):
            query = query.eq("role", role_filter)
        if search:
            query = query.or_(f"full_name.ilike.%{search}%,user_id_number.ilike.%{search}%,email.ilike.%{search}%")
        res = query.execute()
    users = res.data or []
    for user in users:
        user.setdefault("account_status", "active")
        user.setdefault("activated_at", None)
        user["assigned_course_count"] = 0
    lecturer_ids = [user["id"] for user in users if user.get("role") == "lecturer"]
    assignments_by_lecturer = {user_id: [] for user_id in lecturer_ids}
    if lecturer_ids:
        try:
            assignments = supabase.table("lecturer_classrooms").select(
                "lecturer_id, classroom_id, classrooms(id, name, code, programme, level, room_id, physical_rooms!classrooms_room_id_fkey(id, name, code, building, campus, capacity))"
            ).in_("lecturer_id", lecturer_ids).execute()
            for assignment in assignments.data or []:
                classroom = _serialize_classroom(assignment.get("classrooms")) or {}
                assignments_by_lecturer.setdefault(assignment["lecturer_id"], []).append(classroom)
        except Exception as exc:
            error_text = str(exc).lower()
            if "lecturer_classrooms" not in error_text or not any(
                marker in error_text for marker in ("pgrst205", "could not find the table", "does not exist")
            ):
                raise
            print("[SUPERADMIN] lecturer_classrooms migration is pending; returning users without lecturer class assignments.")
    for user in users:
        user["classroom"] = _serialize_classroom(user.pop("classrooms", None))
        if user.get("role") == "lecturer":
            user["assigned_classrooms"] = assignments_by_lecturer.get(user["id"], [])
    _attach_lecturer_teaching_data(users)
    # Students' assigned courses are their enrolments. Fetch them in one batch
    # and count distinct course IDs so the table doesn't need per-row requests.
    student_ids = [user["id"] for user in users if user.get("role") == "student"]
    if student_ids:
        enrolments_by_student = {}
        offset = 0
        while True:
            page = supabase.table("enrolments").select("student_id, course_id").in_(
                "student_id", student_ids
            ).range(offset, offset + 999).execute().data or []
            for enrolment in page:
                if enrolment.get("student_id") and enrolment.get("course_id"):
                    enrolments_by_student.setdefault(enrolment["student_id"], set()).add(enrolment["course_id"])
            if len(page) < 1000:
                break
            offset += 1000
        for user in users:
            if user.get("role") == "student":
                user["assigned_course_count"] = len(enrolments_by_student.get(user["id"], set()))
    if status_filter in ("active", "pending_activation", "deactivated"):
        users = [user for user in users if user.get("account_status", "active") == status_filter]
    if unassigned_filter:
        users = [
            user for user in users
            if (user.get("role") == "student" and not user.get("classroom_id"))
            or (user.get("role") == "lecturer" and not user.get("assigned_classrooms"))
        ]
    classroom_filter = request.args.get("classroom_id")
    if classroom_filter:
        users = [
            user for user in users
            if (user.get("role") == "student" and user.get("classroom_id") == classroom_filter)
            or (user.get("role") == "lecturer" and any(
                classroom.get("id") == classroom_filter for classroom in user.get("assigned_classrooms", [])
            ))
        ]
    return jsonify(users), 200


@superadmin_bp.get("/users/<user_id>")
@require_auth
@require_superadmin
def get_user(user_id):
    res = supabase.table("profiles").select(
        "*, classrooms!profiles_classroom_id_fkey(id, name, code, programme, level, room_id, physical_rooms!classrooms_room_id_fkey(id, name, code, building, campus, capacity))"
    ).eq("id", user_id).execute()
    if not res.data:
        return jsonify({"error": "User not found", "code": 404}), 404
    user = res.data[0]
    user["classroom"] = _serialize_classroom(user.pop("classrooms", None))
    if user.get("role") == "lecturer":
        try:
            assignments = supabase.table("lecturer_classrooms").select(
                "classroom_id, classrooms(id, name, code, programme, level, room_id, physical_rooms!classrooms_room_id_fkey(id, name, code, building, campus, capacity))"
            ).eq("lecturer_id", user_id).execute()
            user["assigned_classrooms"] = [_serialize_classroom(row.get("classrooms")) for row in (assignments.data or []) if row.get("classrooms")]
        except Exception as exc:
            error_text = str(exc).lower()
            if "lecturer_classrooms" not in error_text or not any(
                marker in error_text for marker in ("pgrst205", "could not find the table", "does not exist")
            ):
                raise
            user["assigned_classrooms"] = []
            print("[SUPERADMIN] lecturer_classrooms migration is pending; showing lecturer without class assignments.")
        _attach_lecturer_teaching_data([user])
    user.setdefault("account_status", "active")
    user.setdefault("activated_at", None)
    return jsonify(user), 200


@superadmin_bp.patch("/users/<user_id>")
@require_auth
@require_superadmin
def update_user(user_id):
    data = request.get_json(silent=True) or {}
    allowed_fields = [
        "full_name", "email", "role",
        "programme", "level", "academic_year", "avatar_url",
        "classroom_id", "section",
    ]
    updates = {k: v for k, v in data.items() if k in allowed_fields and v is not None}

    if "classroom_id" in data:
        target = supabase.table("profiles").select("id, role").eq("id", user_id).execute()
        if not target.data:
            return jsonify({"error": "User not found", "code": 404}), 404
        if target.data[0].get("role") != "student":
            return jsonify({"error": "Only student accounts can be assigned to a classroom", "field": "classroom_id", "code": 400}), 400
        classroom_id = data.get("classroom_id") or None
        if classroom_id:
            classroom = supabase.table("classrooms").select("id").eq("id", classroom_id).execute()
            if not classroom.data:
                return jsonify({"error": "Selected class does not exist", "field": "classroom_id", "code": 400}), 400
        updates["classroom_id"] = classroom_id

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


@superadmin_bp.get("/activation-mode")
@require_auth
@require_superadmin
def activation_mode():
    return jsonify({"development_links_enabled": Config.dev_activation_links_enabled()}), 200


def _check_id_reservation(role, data):
    prefix = "LEC" if role == "lecturer" else "STU"
    user_id_number = str(data.get("id_number") or "").strip().upper()
    reservation_token = str(data.get("id_reservation_token") or "").strip()
    if not re.fullmatch(rf"{prefix}-\d{{4}}", user_id_number):
        return None, None, (jsonify({
            "error": f"Generate a valid {role} ID before creating the account.",
            "field": "id_number",
        }), 400)
    if not reservation_token:
        return None, None, (jsonify({
            "error": f"Generate a new {role} ID before creating the account.",
            "field": "id_number",
        }), 400)

    try:
        result = supabase.table("account_id_reservations").select(
            "reservation_token"
        ).eq("reservation_token", reservation_token).eq(
            "user_id_number", user_id_number
        ).eq("role", role).gt(
            "expires_at", datetime.datetime.now(datetime.timezone.utc).isoformat()
        ).limit(1).execute()
    except Exception as exc:
        print(f"[SUPERADMIN] ID reservation check failed: {type(exc).__name__}")
        return None, None, (jsonify({
            "error": "Could not verify the generated ID. Please try again.",
            "field": "id_number",
        }), 503)

    if not result.data:
        return None, None, (jsonify({
            "error": "This generated ID expired or was changed. Generate a new ID and try again.",
            "field": "id_number",
        }), 409)
    return user_id_number, reservation_token, None


def _release_id_reservation(reservation_token):
    if not reservation_token:
        return
    try:
        supabase.rpc("release_account_id_reservation", {
            "p_token": reservation_token,
        }).execute()
    except Exception as exc:
        # Expired reservations are cleaned up by the next generator call.
        print(f"[SUPERADMIN] ID reservation cleanup deferred: {type(exc).__name__}")


@superadmin_bp.post("/generate-account-id")
@require_auth
@require_superadmin
def generate_account_id():
    data = request.get_json(silent=True) or {}
    role = str(data.get("role") or "").strip().lower()
    if role not in ("lecturer", "student"):
        return jsonify({"error": "Choose lecturer or student to generate an ID."}), 400

    try:
        result = supabase.rpc("generate_account_id_reservation", {
            "p_role": role,
        }).execute()
        reservation = result.data
        if isinstance(reservation, list):
            reservation = reservation[0] if reservation else None
        if not reservation or not reservation.get("reservation_token"):
            raise RuntimeError("ID reservation was not returned")
        return jsonify(reservation), 200
    except Exception as exc:
        if "ID_EXHAUSTED" in str(exc):
            label = "LEC" if role == "lecturer" else "STU"
            return jsonify({
                "error": f"All {label}-0001 through {label}-9999 IDs have been used. The four-digit ID range is exhausted."
            }), 409
        print(f"[SUPERADMIN] ID generation failed: {type(exc).__name__}")
        return jsonify({
            "error": "Automatic ID generation is not available. Apply database migration 011, then try again."
        }), 503


@superadmin_bp.post("/users/<user_id>/activation-link")
@require_auth
@require_superadmin
def generate_lecturer_activation_link(user_id):
    if not Config.dev_activation_links_enabled():
        return jsonify({"error": "Development activation links are disabled in this environment."}), 404

    profile_result = supabase.table("profiles").select(
        "id, full_name, email, role, account_status"
    ).eq("id", user_id).limit(1).execute()
    if not profile_result.data or profile_result.data[0].get("role") != "lecturer":
        return jsonify({"error": "Lecturer not found."}), 404
    profile = profile_result.data[0]
    if profile.get("account_status") == "active":
        return jsonify({"error": "This lecturer account is already active."}), 409
    if profile.get("account_status") == "deactivated":
        return jsonify({"error": "This lecturer account is deactivated. Reactivate it before generating a link."}), 409

    token, token_hash, expires_at = create_activation_token()
    try:
        supabase.table("lecturer_activation_tokens").upsert({
            "user_id": user_id,
            "token_hash": token_hash,
            "expires_at": expires_at.isoformat(),
            "used_at": None,
            "claim_id": None,
            "claimed_at": None,
        }, on_conflict="user_id").execute()
    except Exception as e:
        print(f"[ACTIVATION] Could not save activation token for {user_id}: {e}")
        return jsonify({"error": "Could not create an activation link right now."}), 503

    activation_url = f"{Config.FRONTEND_URL.rstrip('/')}/activate-account?{urlencode({'token': token})}"
    response = jsonify({
        "activation_url": activation_url,
        "expires_at": expires_at.isoformat(),
        "lecturer": {"id": profile["id"], "full_name": profile.get("full_name"), "email": profile.get("email")},
    })
    response.headers["Cache-Control"] = "no-store, private"
    return response, 200


@superadmin_bp.patch("/users/<user_id>/classrooms")
@require_auth
@require_superadmin
def update_lecturer_classrooms(user_id):
    data = request.get_json(silent=True) or {}
    classroom_ids = data.get("classroom_ids")
    if not isinstance(classroom_ids, list) or not classroom_ids:
        return jsonify({"error": "Assign at least one class to the lecturer."}), 400
    classroom_ids = list(dict.fromkeys(str(value) for value in classroom_ids if value))
    profile = supabase.table("profiles").select("id, role").eq("id", user_id).limit(1).execute()
    if not profile.data or profile.data[0].get("role") != "lecturer":
        return jsonify({"error": "Lecturer not found."}), 404
    try:
        result = supabase.rpc("set_lecturer_classrooms", {
            "p_lecturer_id": user_id,
            "p_classroom_ids": classroom_ids,
        }).execute()
        if result.data is not True:
            raise RuntimeError("Classroom assignment update was not confirmed")
    except Exception as e:
        print(f"[SUPERADMIN] Lecturer class assignment failed for {user_id}: {e}")
        return jsonify({"error": "Could not update lecturer class assignments. Check the selected classes and try again."}), 400
    return jsonify({"message": "Lecturer class assignments updated."}), 200


@superadmin_bp.patch("/users/<user_id>/status")
@require_auth
@require_superadmin
def update_lecturer_status(user_id):
    data = request.get_json(silent=True) or {}
    new_status = data.get("account_status")
    if new_status not in ("active", "deactivated"):
        return jsonify({"error": "Account status must be active or deactivated."}), 400
    profile_result = supabase.table("profiles").select(
        "id, role, account_status"
    ).eq("id", user_id).limit(1).execute()
    if not profile_result.data or profile_result.data[0].get("role") != "lecturer":
        return jsonify({"error": "Lecturer not found."}), 404
    current_status = profile_result.data[0].get("account_status")
    if current_status == "pending_activation":
        return jsonify({"error": "Pending lecturers must activate through their setup link before they can be marked active."}), 409
    result = supabase.table("profiles").update({"account_status": new_status}).eq(
        "id", user_id
    ).eq("role", "lecturer").execute()
    if not result.data:
        return jsonify({"error": "Lecturer account status was not updated."}), 409
    return jsonify({"account_status": new_status}), 200


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

    lecturer_id = data.get("lecturer_id") or None
    level = data.get("level")
    if level not in (None, ""):
        try:
            level = int(level)
        except (TypeError, ValueError):
            return jsonify({"error": "level must be 100, 200, 300, or 400", "code": 400}), 400
        if level not in (100, 200, 300, 400):
            return jsonify({"error": "level must be 100, 200, 300, or 400", "code": 400}), 400

    if lecturer_id:
        lecturer = supabase.table("profiles").select("id, role").eq("id", lecturer_id).execute()
        if not lecturer.data or lecturer.data[0].get("role") != "lecturer":
            return jsonify({"error": "Select an active lecturer account", "code": 400}), 400

    payload = {
        "course_name": data["course_name"],
        "course_code": data["course_code"],
        "description": data.get("description", ""),
        "level": level,
        "programme": data.get("programme", ""),
        "lecturer_id": lecturer_id,
        "semester": data.get("semester") or "Semester 1",
        "academic_year": data.get("academic_year") or "2026/2027",
    }
    res = supabase.table("courses").insert(payload).execute()
    course = res.data[0]

    if lecturer_id and payload["programme"] and level:
        try:
            assignment = supabase.table("lecturer_assignments").insert({
                "lecturer_id": lecturer_id,
                "course_id": course["id"],
                "programme": payload["programme"],
                "level": level,
                "semester": payload["semester"],
                "academic_year": payload["academic_year"],
            }).execute()
            from services.enrolment_service import backfill_student_enrolments
            enrolled = backfill_student_enrolments(course["id"], payload["programme"], level)
            from services.course_schedule_service import create_course_schedule_for_assignment
            schedule = create_course_schedule_for_assignment(assignment.data[0]) if assignment.data else None
            course["lecturer_assignment"] = assignment.data[0] if assignment.data else None
            course["students_enrolled"] = enrolled
            course["schedule"] = schedule
        except Exception as exc:
            # Do not leave a course that appears assigned in the catalogue but
            # cannot be delivered through lecturer assignments.
            supabase.table("courses").delete().eq("id", course["id"]).execute()
            return jsonify({"error": "Course was not created because lecturer assignment failed", "code": 500}), 500

    return jsonify(course), 201


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
    return _admin_create_pending_lecturer()


@superadmin_bp.post("/register-student")
@require_auth
@require_superadmin
def admin_register_student():
    return _admin_create_user("student")


def _admin_create_pending_lecturer():
    if not Config.dev_activation_links_enabled():
        return jsonify({"error": "Lecturer activation delivery is not configured in this environment."}), 503

    data = request.get_json(silent=True) or {}
    full_name = " ".join(str(data.get("full_name") or "").split())
    email = normalize_email(data.get("email"))
    staff_id = str(data.get("id_number") or "").strip().upper()
    staff_id, reservation_token, reservation_error = _check_id_reservation("lecturer", data)
    classroom_ids = data.get("classroom_ids")
    if reservation_error:
        return reservation_error
    if not full_name or not email:
        return jsonify({"error": "Full name and email address are required."}), 400
    if not isinstance(classroom_ids, list) or not classroom_ids:
        return jsonify({"error": "Assign at least one class to the lecturer."}), 400
    classroom_ids = list(dict.fromkeys(str(value) for value in classroom_ids if value))
    if not classroom_ids:
        return jsonify({"error": "Assign at least one class to the lecturer."}), 400

    try:
        identity_errors = duplicate_identity_errors(supabase, full_name, email)
        if identity_errors:
            field, message = next(iter(identity_errors.items()))
            return jsonify({"error": message, "field": field, "errors": identity_errors}), 409
        classroom_result = supabase.table("classrooms").select("id").in_("id", classroom_ids).execute()
        if len(classroom_result.data or []) != len(classroom_ids):
            return jsonify({"error": "One or more selected classes could not be found."}), 400
    except Exception as e:
        print(f"[SUPERADMIN] Lecturer preflight failed: {e}")
        return jsonify({"error": "Could not verify lecturer details. Please try again."}), 503

    # A random one-time bootstrap password is known only to Supabase Auth; the
    # lecturer cannot log in until the activation flow replaces it.
    temporary_password = secrets.token_urlsafe(48)
    try:
        api_url = f"{Config.SUPABASE_URL}/auth/v1/admin/users"
        headers = {
            "apikey": Config.SUPABASE_SERVICE_KEY,
            "Authorization": f"Bearer {Config.SUPABASE_SERVICE_KEY}",
            "Content-Type": "application/json",
        }
        auth_response = http_requests.post(api_url, json={
            "email": email,
            "password": temporary_password,
            "email_confirm": True,
            "user_metadata": {"full_name": full_name, "role": "lecturer"},
        }, headers=headers, timeout=15)
        auth_data = auth_response.json()
        if auth_response.status_code not in (200, 201) or not auth_data.get("id"):
            detail = str(auth_data).lower()
            if any(word in detail for word in ("already", "exists", "registered", "duplicate")):
                return jsonify({"error": "This email address is already in use. Please use a different email address.", "field": "email"}), 409
            print(f"[SUPERADMIN] Supabase Auth lecturer creation failed with status {auth_response.status_code}")
            return jsonify({"error": "Could not create the lecturer account. Please try again."}), 502
        user_id = auth_data["id"]
    except Exception as e:
        print(f"[SUPERADMIN] Supabase Auth lecturer creation failed: {e}")
        return jsonify({"error": "Could not create the lecturer account. Please try again."}), 502

    try:
        result = supabase.rpc("create_pending_lecturer_profile", {
            "p_user_id": user_id,
            "p_full_name": full_name,
            "p_email": email,
            "p_staff_id": staff_id,
            "p_reservation_token": reservation_token,
            "p_classroom_ids": classroom_ids,
        }).execute()
        profile = result.data
        if isinstance(profile, list):
            profile = profile[0] if profile else None
        if not profile:
            raise RuntimeError("Lecturer profile creation returned no profile")
    except Exception as e:
        from routes.auth import _delete_auth_user
        _delete_auth_user(user_id)
        field = unique_constraint_field(e)
        if field == "email":
            return jsonify({"error": "This email address is already in use. Please use a different email address.", "field": "email"}), 409
        if field == "full_name":
            return jsonify({"error": "This full name is already registered. Please use a different name.", "field": "full_name"}), 409
        _release_id_reservation(reservation_token)
        if field == "id_number":
            return jsonify({"error": "This staff ID is already registered. Generate another ID.", "field": "id_number"}), 409
        if "ID_RESERVATION_INVALID" in str(e):
            return jsonify({"error": "The generated Staff ID expired. Generate a new ID and try again.", "field": "id_number"}), 409
        print(f"[SUPERADMIN] Lecturer profile/class assignment failed: {e}")
        return jsonify({"error": "Could not save the lecturer profile and class assignments."}), 400

    return jsonify({"message": "Lecturer account created and is pending activation.", "user": profile}), 201


def _admin_create_user(role):
    data = request.get_json(silent=True) or {}
    full_name = " ".join(str(data.get("full_name") or "").split())
    email = str(data.get("email") or "").strip().lower()
    password = data.get("password", "")
    id_number, reservation_token, reservation_error = _check_id_reservation(role, data)
    if reservation_error:
        return reservation_error

    if not all([full_name, email, password]):
        return jsonify({"error": "Full name, email, and password are required.", "code": 400}), 400

    if len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters", "code": 400}), 400

    classroom_id = (data.get("classroom_id") or None) if role == "student" else None
    if classroom_id:
        try:
            classroom = supabase.table("classrooms").select("id").eq("id", classroom_id).execute()
        except Exception:
            return jsonify({"error": "Could not verify the selected class right now.", "field": "classroom_id", "code": 503}), 503
        if not classroom.data:
            return jsonify({"error": "Selected class does not exist", "field": "classroom_id", "code": 400}), 400

    from routes.auth import _create_auth_user, _delete_auth_user
    from services.registration_identity import (
        duplicate_identity_errors,
        unique_constraint_field,
    )
    try:
        identity_errors = duplicate_identity_errors(supabase, full_name, email)
    except Exception as e:
        print(f"[SUPERADMIN] Duplicate identity check failed: {e}")
        return jsonify({"error": "Could not verify the name and email right now.", "code": 503}), 503
    if identity_errors:
        field, message = next(iter(identity_errors.items()))
        return jsonify({"error": message, "field": field, "errors": identity_errors, "code": 409}), 409
    try:
        user_id = _create_auth_user(email, password, full_name, role)
    except Exception as e:
        err = str(e).lower()
        if "already" in err or "exists" in err:
            return jsonify({"error": "An account with this email already exists", "code": 409}), 409
        return jsonify({"error": "Account creation failed. Please try again.", "code": 400}), 400

    profile_payload = {
        "id": user_id,
        "full_name": full_name,
        "role": role,
        "email": email,
        "user_id_number": id_number,
    }

    if role == "student":
        profile_payload["programme"] = str(data.get("programme") or "").strip()
        try:
            profile_payload["level"] = int(data.get("level", 0))
        except (TypeError, ValueError):
            profile_payload["level"] = None
        profile_payload["academic_year"] = str(data.get("academic_year") or "").strip() or None
        profile_payload["classroom_id"] = classroom_id
        profile_payload["section"] = str(data.get("section") or "").strip()

    try:
        if role == "student":
            supabase.rpc("create_student_profile_with_id_reservation", {
                "p_user_id": user_id,
                "p_full_name": full_name,
                "p_email": email,
                "p_user_id_number": id_number,
                "p_reservation_token": reservation_token,
                "p_programme": profile_payload.get("programme"),
                "p_level": profile_payload.get("level"),
                "p_academic_year": profile_payload.get("academic_year"),
                "p_classroom_id": classroom_id,
                "p_section": profile_payload.get("section"),
            }).execute()
        else:
            raise ValueError("Unsupported Super-Admin account role")
    except Exception as e:
        _delete_auth_user(user_id)
        field = unique_constraint_field(e)
        if field in ("email", "full_name", "id_number"):
            if field == "id_number":
                _release_id_reservation(reservation_token)
            messages = {
                "email": "This email address is already in use. Please use a different email address.",
                "full_name": "This full name is already registered. Please use a different name.",
                "id_number": "An account with this ID number already exists.",
            }
            return jsonify({"error": messages[field], "field": field, "code": 409}), 409
        _release_id_reservation(reservation_token)
        if "ID_RESERVATION_INVALID" in str(e):
            return jsonify({"error": "The generated Student ID expired. Generate a new ID and try again.", "field": "id_number", "code": 409}), 409
        print(f"[SUPERADMIN] Student profile creation failed: {type(e).__name__}")
        return jsonify({"error": "Could not save the student profile. Please try again.", "code": 500}), 500

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
    try:
        classrooms_response = _retry_transient_supabase_call(
            lambda: supabase.table("classrooms").select(
                "*, physical_rooms!classrooms_room_id_fkey(id, name, code, building, campus, capacity)"
            ).order("programme").order("level").execute()
        )
        classrooms = [_serialize_classroom(row) for row in (classrooms_response.data or [])]

        try:
            lecturer_response = _retry_transient_supabase_call(
                lambda: supabase.table("lecturer_classrooms")
                .select("lecturer_id, classroom_id").execute()
            )
            lecturer_rows = lecturer_response.data or []
        except Exception as exc:
            error_text = str(exc).lower()
            missing_assignment_table = "lecturer_classrooms" in error_text and any(
                marker in error_text for marker in (
                    "pgrst205", "could not find the table", "does not exist", "42p01",
                )
            )
            if not missing_assignment_table:
                raise
            lecturer_rows = []
            print("[classrooms] lecturer_classrooms migration is not applied; returning classes without lecturer counts.")

        lecturer_counts = {}
        for assignment in lecturer_rows:
            class_id = assignment.get("classroom_id")
            if class_id:
                lecturer_counts[class_id] = lecturer_counts.get(class_id, 0) + 1

        student_rows = _retry_transient_supabase_call(
            lambda: supabase.table("profiles").select("classroom_id").eq("role", "student").execute()
        ).data or []
        student_counts = {}
        for student in student_rows:
            class_id = student.get("classroom_id")
            if class_id:
                student_counts[class_id] = student_counts.get(class_id, 0) + 1
        for classroom in classrooms:
            classroom["student_count"] = student_counts.get(classroom["id"], 0)
            classroom["lecturer_count"] = lecturer_counts.get(classroom["id"], 0)
    except Exception as exc:
        # Never turn a database outage into a successful empty list: the client
        # needs to distinguish "no classes exist" from "classes could not load".
        print(f"[classrooms] database read failed: {type(exc).__name__}")
        return jsonify({"error": "Classrooms could not be loaded from the database. Please retry."}), 503

    lecturer_filter = request.args.get("lecturer_assignment")
    if lecturer_filter == "missing":
        classrooms = [classroom for classroom in classrooms if not classroom["lecturer_count"]]
    elif lecturer_filter == "assigned":
        classrooms = [classroom for classroom in classrooms if classroom["lecturer_count"]]
    return jsonify(classrooms), 200


@superadmin_bp.get("/rooms")
@require_auth
@require_superadmin
def list_physical_rooms():
    try:
        result = _retry_transient_supabase_call(
            lambda: supabase.table("physical_rooms").select("*").order("building").order("name").execute()
        )
        return jsonify(result.data or []), 200
    except Exception as exc:
        print(f"[rooms] database read failed: {type(exc).__name__}")
        return jsonify({"error": "Physical rooms could not be loaded from the database."}), 503


@superadmin_bp.get("/classroom-migration-review")
@require_auth
@require_superadmin
def classroom_migration_review():
    try:
        rows = supabase.table("classroom_migration_review").select(
            "classroom_id, original_name, reason, created_at, reviewed_at"
        ).order("created_at").execute()
        return jsonify(rows.data or []), 200
    except Exception as exc:
        print(f"[classroom_review] database read failed: {type(exc).__name__}")
        return jsonify({"error": "Classroom migration review report could not be loaded."}), 503


@superadmin_bp.post("/classrooms")
@require_auth
@require_superadmin
def create_classroom():
    data = request.get_json(silent=True) or {}
    try:
        result = supabase.rpc("save_classroom_with_room", {
            "p_classroom_id": None,
            "p_programme": data.get("programme"),
            "p_level": data.get("level"),
            "p_room_id": data.get("room_id") or None,
            "p_room_name": data.get("room_name"),
            "p_room_code": data.get("room_code"),
            "p_building": data.get("building"),
            "p_campus": data.get("campus"),
            "p_capacity": data.get("capacity"),
        }).execute()
        payload = result.data[0] if isinstance(result.data, list) else result.data
        return jsonify(payload), 201
    except Exception as exc:
        message = str(exc).lower()
        if "duplicate" in message or "unique" in message or "23505" in message:
            return jsonify({"error": "That room code is already in use. Choose the existing room or enter a unique code."}), 409
        if "22023" in message or "required" in message or "invalid" in message:
            return jsonify({"error": str(exc).split(" (", 1)[0]}), 400
        print(f"[classrooms] create failed: {type(exc).__name__}")
        return jsonify({"error": "Classroom could not be saved. Confirm migration 012 is applied and try again."}), 503


@superadmin_bp.patch("/classrooms/<classroom_id>")
@require_auth
@require_superadmin
def update_classroom(classroom_id):
    data = request.get_json(silent=True) or {}
    try:
        result = supabase.rpc("save_classroom_with_room", {
            "p_classroom_id": classroom_id,
            "p_programme": data.get("programme"),
            "p_level": data.get("level"),
            "p_room_id": data.get("room_id") or None,
            "p_room_name": data.get("room_name"),
            "p_room_code": data.get("room_code"),
            "p_building": data.get("building"),
            "p_campus": data.get("campus"),
            "p_capacity": data.get("capacity"),
        }).execute()
        payload = result.data[0] if isinstance(result.data, list) else result.data
        return jsonify(payload), 200
    except Exception as exc:
        message = str(exc).lower()
        if "duplicate" in message or "unique" in message or "23505" in message:
            return jsonify({"error": "That room code is already in use. Choose the existing room or enter a unique code."}), 409
        if "22023" in message or "required" in message or "invalid" in message:
            return jsonify({"error": str(exc).split(" (", 1)[0]}), 400
        print(f"[classrooms] update failed: {type(exc).__name__}")
        return jsonify({"error": "Classroom could not be updated. Confirm migration 012 is applied and try again."}), 503


@superadmin_bp.delete("/classrooms/<classroom_id>")
@require_auth
@require_superadmin
def delete_classroom(classroom_id):
    students = supabase.table("profiles").select("id", count="exact").eq("classroom_id", classroom_id).eq("role", "student").execute()
    try:
        lecturers = supabase.table("lecturer_classrooms").select("lecturer_id", count="exact").eq("classroom_id", classroom_id).execute()
        lecturer_count = lecturers.count or 0
    except Exception as exc:
        error_text = str(exc).lower()
        if "lecturer_classrooms" not in error_text or not any(
            marker in error_text for marker in ("pgrst205", "could not find the table", "does not exist")
        ):
            raise
        lecturer_count = 0
    student_count = students.count or 0
    try:
        schedule_count = supabase.table("course_schedules").select(
            "id", count="exact"
        ).eq("classroom_id", classroom_id).execute().count or 0
    except Exception as exc:
        if "course_schedules" not in str(exc).lower():
            raise
        schedule_count = 0
    if student_count or lecturer_count or schedule_count:
        return jsonify({
            "error": f"This class has {student_count} student(s), {lecturer_count} lecturer(s), and {schedule_count} scheduled meeting(s). Reassign them before deleting the class.",
            "code": 409,
        }), 409
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

    lecturer = supabase.table("profiles").select("id, role").eq("id", lecturer_id).execute()
    if not lecturer.data or lecturer.data[0].get("role") != "lecturer":
        return jsonify({"error": "Select a lecturer account", "code": 400}), 400

    course = supabase.table("courses").select("programme, level").eq("id", course_id).execute()
    if not course.data:
        return jsonify({"error": "Course not found", "code": 404}), 404

    course_assignments = supabase.table("lecturer_assignments").select("*").eq("course_id", course_id).execute().data or []
    if any(assignment.get("lecturer_id") == lecturer_id for assignment in course_assignments):
        return jsonify({"error": "Lecturer already assigned to this course", "code": 409}), 409

    if course_assignments:
        # A course has one canonical lecturer in the course catalogue. Update
        # its term assignments together so the Courses and Users pages cannot
        # disagree about who teaches it.
        assignment_rows = []
        for assignment in course_assignments:
            updated = supabase.table("lecturer_assignments").update({"lecturer_id": lecturer_id}).eq(
                "id", assignment["id"]
            ).execute()
            if updated.data:
                assignment_rows.append(updated.data[0])
        try:
            supabase.table("course_schedules").delete().eq("course_id", course_id).execute()
        except Exception as exc:
            error_text = str(exc).lower()
            if "course_schedules" not in error_text or not any(
                marker in error_text for marker in ("pgrst205", "could not find the table", "does not exist")
            ):
                raise
        res_data = assignment_rows
    else:
        created = supabase.table("lecturer_assignments").insert({
            "lecturer_id": lecturer_id,
            "course_id": course_id,
            "programme": course.data[0].get("programme", ""),
            "level": course.data[0].get("level"),
            "semester": data.get("semester", "Semester 1"),
            "academic_year": data.get("academic_year") or "2026/2027",
        }).execute()
        res_data = created.data or []

    supabase.table("courses").update({"lecturer_id": lecturer_id}).eq("id", course_id).execute()
    from services.enrolment_service import backfill_student_enrolments
    enrolled = backfill_student_enrolments(course_id, course.data[0].get("programme", ""), course.data[0].get("level"))
    from services.course_schedule_service import create_course_schedule_for_assignment
    schedules = [create_course_schedule_for_assignment(assignment) for assignment in res_data]

    return jsonify({"assignments": res_data, "students_enrolled": enrolled, "schedules": schedules}), 201


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


@superadmin_bp.get("/course-schedules")
@require_auth
@require_superadmin
def list_course_schedules():
    query = supabase.table("course_schedules").select(
        "*, courses!course_schedules_course_id_fkey(course_name, course_code), "
        "profiles!course_schedules_lecturer_id_fkey(full_name, user_id_number), "
        "classrooms!course_schedules_classroom_id_fkey(id, name, code, programme, level, room_id, physical_rooms!classrooms_room_id_fkey(id, name, code, building, campus, capacity)), "
        "physical_rooms!course_schedules_physical_room_id_fkey(id, name, code, building, campus, capacity)"
    )
    session_type = request.args.get("session_type")
    if session_type in ("weekday", "weekend"):
        query = query.eq("session_type", session_type)
    res = query.order("day_of_week").order("start_time").execute()
    schedules = res.data or []
    for schedule in schedules:
        schedule["course"] = schedule.pop("courses", None)
        schedule["lecturer"] = schedule.pop("profiles", None)
        schedule["classroom"] = _serialize_classroom(schedule.pop("classrooms", None))
        schedule["physical_room"] = schedule.pop("physical_rooms", None) or (schedule["classroom"] or {}).get("physical_room")
    return jsonify(schedules), 200
