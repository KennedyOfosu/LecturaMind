"""
dashboard.py — Analytics and stats routes for the lecturer dashboard.
Includes level-based breakdowns.
"""

import datetime
from flask import Blueprint, jsonify, g
from services.supabase_client import supabase
from middleware.auth_middleware import require_auth, require_role, _retry_transient_supabase_call
from services.lecturer_access import lecturer_managed_student_ids

dashboard_bp = Blueprint("dashboard", __name__)


@dashboard_bp.get("/lecturer/classes")
@require_auth
@require_role("lecturer")
def lecturer_classes():
    """Return only classes explicitly assigned to the signed-in lecturer."""
    unavailable = []
    try:
        rows = _retry_transient_supabase_call(lambda: supabase.table("lecturer_classrooms").select(
            "classroom_id, classrooms(id, name, code, programme, level, room_id, physical_rooms!classrooms_room_id_fkey(id, name, code, building, campus, capacity))"
        ).eq("lecturer_id", g.user_id).execute()).data or []
    except Exception as exc:
        error_text = str(exc).lower()
        if "lecturer_classrooms" in error_text and any(
            marker in error_text for marker in ("pgrst205", "could not find the table", "does not exist")
        ):
            return jsonify({"data": [], "data_warnings": ["lecturer_classrooms"]}), 200
        # Room data is optional. Preserve assigned class groups if the optional
        # physical-room relationship is missing or temporarily unavailable.
        try:
            rows = _retry_transient_supabase_call(lambda: supabase.table("lecturer_classrooms").select(
                "classroom_id, classrooms(id, name, code, programme, level)"
            ).eq("lecturer_id", g.user_id).execute()).data or []
            unavailable.append("physical_rooms")
            print(f"[lecturer_classes] room details unavailable; returned class groups: {exc}")
        except Exception as fallback_exc:
            print(f"[lecturer_classes] class assignments unavailable: {fallback_exc}")
            unavailable.append("lecturer_classrooms")
            rows = []
    classrooms = []
    for row in rows:
        classroom = row.get("classrooms")
        if not classroom:
            continue
        room = classroom.pop("physical_rooms", None)
        classroom["physical_room"] = room
        classroom["class_code"] = classroom.get("code")
        classroom["code"] = room.get("code") if room else None
        try:
            count = _retry_transient_supabase_call(lambda: supabase.table("profiles").select(
                "id", count="exact"
            ).eq("classroom_id", classroom["id"]).eq("role", "student").execute())
            classroom["student_count"] = count.count or 0
        except Exception as exc:
            print(f"[lecturer_classes] student count unavailable: {exc}")
            classroom["student_count"] = 0
            unavailable.append("student_count")
        classrooms.append(classroom)
    return jsonify({
        "data": classrooms,
        "data_warnings": unavailable
    }), 200


@dashboard_bp.get("/lecturer/classes/<classroom_id>/students")
@require_auth
@require_role("lecturer")
def lecturer_class_students(classroom_id):
    """Return students for a class only after checking the lecturer assignment."""
    unavailable = []
    assignment = supabase.table("lecturer_classrooms").select("classroom_id").eq(
        "lecturer_id", g.user_id
    ).eq("classroom_id", classroom_id).limit(1).execute()
    if not assignment.data:
        return jsonify({"error": "You are not assigned to this class"}), 403
    try:
        students = supabase.table("profiles").select(
            "id, full_name, user_id_number, programme, level"
        ).eq("classroom_id", classroom_id).eq("role", "student").order("full_name").execute()
    except Exception as exc:
        print(f"[lecturer_class_students] query failed: {exc}")
        students = type('obj', (object,), {'data': []})()
        unavailable.append("students")
    return jsonify({
        "data": students.data or [],
        "data_warnings": unavailable
    }), 200


@dashboard_bp.get("/lecturer/stats")
@require_auth
@require_role("lecturer")
def lecturer_stats():
    lecturer_id = g.user_id
    unavailable = []

    def read(label, query):
        try:
            rows = []
            offset = 0
            while True:
                page = _retry_transient_supabase_call(
                    lambda: query.range(offset, offset + 999).execute()
                ).data or []
                rows.extend(page)
                if len(page) < 1000:
                    return rows
                offset += 1000
        except Exception as exc:
            print(f"[lecturer_stats] {label} unavailable: {exc}")
            unavailable.append(label)
            return None

    owned_courses = read(
        "courses",
        supabase.table("courses").select("id, level").eq("lecturer_id", lecturer_id),
    )
    teaching_assignments = read(
        "lecturer_assignments",
        supabase.table("lecturer_assignments").select("course_id").eq("lecturer_id", lecturer_id),
    )
    if owned_courses is None and teaching_assignments is None:
        courses_data = None
    else:
        course_ids = {
            course["id"] for course in owned_courses or [] if course.get("id")
        }
        course_ids.update(
            row["course_id"] for row in teaching_assignments or [] if row.get("course_id")
        )
        course_ids = list(course_ids)
        if course_ids:
            courses_data = read(
                "course_details",
                supabase.table("courses").select("id, level").in_("id", course_ids),
            )
            if courses_data is not None:
                known_ids = {course.get("id") for course in courses_data}
                courses_data.extend(
                    course for course in owned_courses or []
                    if course.get("id") not in known_ids
                )
        elif owned_courses is None or teaching_assignments is None:
            courses_data = None
        else:
            courses_data = []
    course_ids = [course["id"] for course in courses_data or [] if course.get("id")]
    total_courses = len(course_ids) if courses_data is not None else None

    total_students  = 0
    queries_today   = 0
    active_quizzes  = 0
    flagged_messages = 0
    recent_activity  = []
    level_stats      = {}

    if courses_data is None:
        total_students = queries_today = active_quizzes = flagged_messages = None
        level_stats = None
    elif course_ids:
        enrolled_rows = read(
            "enrolments",
            supabase.table("enrolments").select("course_id, student_id").in_("course_id", course_ids),
        )
        unique_students = set()
        if enrolled_rows is not None:
            unique_students = lecturer_managed_student_ids(
                supabase,
                lecturer_id,
                [row["student_id"] for row in enrolled_rows if row.get("student_id")],
            )
            total_students = len(unique_students)
        else:
            total_students = None

        today = datetime.date.today().isoformat()
        chat_rows = read(
            "chat_messages_scope",
            supabase.table("chat_messages").select("student_id").in_("course_id", course_ids)
            .gte("timestamp", f"{today}T00:00:00"),
        )
        queries_today = (
            sum(1 for row in chat_rows if row.get("student_id") in unique_students)
            if chat_rows is not None and enrolled_rows is not None else None
        )

        quiz_rows = read(
            "quizzes",
            supabase.table("quizzes").select("id").in_("course_id", course_ids).eq("is_active", True),
        )
        active_quizzes = len(quiz_rows) if quiz_rows is not None else None

        flagged_message_rows = read(
            "chat_messages",
            supabase.table("chat_messages").select("student_id").in_("course_id", course_ids).eq("flagged", True),
        )
        flagged_messages = (
            sum(1 for row in flagged_message_rows if row.get("student_id") in unique_students)
            if flagged_message_rows is not None and enrolled_rows is not None else None
        )

        recent_activity = read(
            "recent_activity",
            supabase.table("chat_messages").select(
                "query, timestamp, course_id, "
                "student_id, profiles!chat_messages_student_id_fkey(full_name), "
                "courses!chat_messages_course_id_fkey(course_name)"
            ).in_("course_id", course_ids).order("timestamp", desc=True).limit(10),
        )
        if recent_activity is not None and enrolled_rows is not None:
            recent_activity = [row for row in recent_activity if row.get("student_id") in unique_students]
        elif enrolled_rows is None:
            recent_activity = None

        # Group the already loaded enrolments by course to avoid one query per course.
        # The count remains unknown if the enrolment source could not be read.
        # Level-based breakdown
        for course in courses_data:
            lvl = course.get("level")
            if lvl is None:
                continue
            if lvl not in level_stats:
                level_stats[lvl] = {"courses": 0, "students": 0}
            level_stats[lvl]["courses"] += 1

            if enrolled_rows is None:
                level_stats[lvl]["students"] = None
            elif level_stats[lvl]["students"] is not None:
                level_stats[lvl]["students"] += sum(
                    1 for row in enrolled_rows
                    if row.get("course_id") == course["id"] and row.get("student_id") in unique_students
                )

    return jsonify({
        "total_courses":    total_courses,
        "total_students":   total_students,
        "queries_today":    queries_today,
        "active_quizzes":   active_quizzes,
        "flagged_messages": flagged_messages,
        "recent_activity":  recent_activity,
        "level_stats":      level_stats,
        "data_warnings":    sorted(set(unavailable)),
    }), 200
