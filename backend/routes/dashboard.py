"""
dashboard.py — Analytics and stats routes for the lecturer dashboard.
Includes level-based breakdowns.
"""

import datetime
from flask import Blueprint, jsonify, g
from services.supabase_client import supabase
from middleware.auth_middleware import require_auth, require_role
from services.lecturer_access import lecturer_managed_student_ids

dashboard_bp = Blueprint("dashboard", __name__)


@dashboard_bp.get("/lecturer/classes")
@require_auth
@require_role("lecturer")
def lecturer_classes():
    """Return only classes explicitly assigned to the signed-in lecturer."""
    try:
        rows = supabase.table("lecturer_classrooms").select(
            "classroom_id, classrooms(id, name, code, programme, level, room_id, physical_rooms!classrooms_room_id_fkey(id, name, code, building, campus, capacity))"
        ).eq("lecturer_id", g.user_id).execute().data or []
    except Exception as exc:
        error_text = str(exc).lower()
        if "lecturer_classrooms" in error_text and any(
            marker in error_text for marker in ("pgrst205", "could not find the table", "does not exist")
        ):
            return jsonify([]), 200
        print(f"[lecturer_classes] class assignments unavailable: {exc}")
        return jsonify({"error": "Could not load assigned classes"}), 503
    classrooms = []
    for row in rows:
        classroom = row.get("classrooms")
        if not classroom:
            continue
        room = classroom.pop("physical_rooms", None)
        classroom["physical_room"] = room
        classroom["class_code"] = classroom.get("code")
        classroom["code"] = room.get("code") if room else None
        count = supabase.table("profiles").select("id", count="exact").eq("classroom_id", classroom["id"]).eq("role", "student").execute()
        classroom["student_count"] = count.count or 0
        classrooms.append(classroom)
    return jsonify(classrooms), 200


@dashboard_bp.get("/lecturer/classes/<classroom_id>/students")
@require_auth
@require_role("lecturer")
def lecturer_class_students(classroom_id):
    """Return students for a class only after checking the lecturer assignment."""
    assignment = supabase.table("lecturer_classrooms").select("classroom_id").eq(
        "lecturer_id", g.user_id
    ).eq("classroom_id", classroom_id).limit(1).execute()
    if not assignment.data:
        return jsonify({"error": "You are not assigned to this class"}), 403
    students = supabase.table("profiles").select(
        "id, full_name, user_id_number, programme, level"
    ).eq("classroom_id", classroom_id).eq("role", "student").order("full_name").execute()
    return jsonify(students.data or []), 200


@dashboard_bp.get("/lecturer/stats")
@require_auth
@require_role("lecturer")
def lecturer_stats():
    lecturer_id = g.user_id
    unavailable = []

    def read(label, query):
        try:
            return query.execute().data or []
        except Exception as exc:
            print(f"[lecturer_stats] {label} unavailable: {exc}")
            unavailable.append(label)
            return []

    courses_data = read(
        "courses",
        supabase.table("courses").select("id, level").eq("lecturer_id", lecturer_id),
    )
    course_ids   = [c["id"] for c in courses_data]
    total_courses = len(course_ids)

    total_students  = 0
    queries_today   = 0
    active_quizzes  = 0
    flagged_messages = 0
    recent_activity  = []
    level_stats      = {}

    if course_ids:
        enrolled_rows = read(
            "enrolments",
            supabase.table("enrolments").select("student_id").in_("course_id", course_ids),
        )
        unique_students = lecturer_managed_student_ids(
            supabase,
            lecturer_id,
            [row["student_id"] for row in enrolled_rows if row.get("student_id")],
        )
        total_students  = len(unique_students)

        today = datetime.date.today().isoformat()
        queries_today = sum(1 for row in read(
            "chat_messages_scope",
            supabase.table("chat_messages").select("student_id").in_("course_id", course_ids)
            .gte("timestamp", f"{today}T00:00:00"),
        ) if row.get("student_id") in unique_students)

        active_quizzes = len(read(
            "quizzes",
            supabase.table("quizzes").select("id").in_("course_id", course_ids).eq("is_active", True),
        ))

        flagged_message_rows = read(
            "chat_messages",
            supabase.table("chat_messages").select("student_id").in_("course_id", course_ids).eq("flagged", True),
        )
        flagged_messages = sum(1 for row in flagged_message_rows if row.get("student_id") in unique_students)

        recent_activity = read(
            "recent_activity",
            supabase.table("chat_messages").select(
                "query, timestamp, course_id, "
                "student_id, profiles!chat_messages_student_id_fkey(full_name), "
                "courses!chat_messages_course_id_fkey(course_name)"
            ).in_("course_id", course_ids).order("timestamp", desc=True).limit(10),
        )
        recent_activity = [row for row in recent_activity if row.get("student_id") in unique_students]

        # Level-based breakdown
        for course in courses_data:
            lvl = course.get("level")
            if lvl is None:
                continue
            if lvl not in level_stats:
                level_stats[lvl] = {"courses": 0, "students": 0}
            level_stats[lvl]["courses"] += 1

            enrol_rows = read(
                "enrolments",
                supabase.table("enrolments").select("student_id").eq("course_id", course["id"]),
            )
            level_stats[lvl]["students"] += sum(
                1 for row in enrol_rows if row.get("student_id") in unique_students
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
