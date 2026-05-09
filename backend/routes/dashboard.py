"""
dashboard.py — Analytics and stats routes for the lecturer dashboard.
"""

import datetime
from flask import Blueprint, jsonify, g
from services.supabase_client import supabase
from middleware.auth_middleware import require_auth, require_role

dashboard_bp = Blueprint("dashboard", __name__)


@dashboard_bp.get("/lecturer/stats")
@require_auth
@require_role("lecturer")
def lecturer_stats():
    """
    Return aggregate statistics for the lecturer's dashboard overview.

    Returns: {
        total_courses, total_students, queries_today,
        active_quizzes, flagged_messages, recent_activity
    }
    """
    lecturer_id = g.user_id

    # All course IDs owned by this lecturer
    courses_res = supabase.table("courses").select("id").eq("lecturer_id", lecturer_id).execute()
    course_ids = [c["id"] for c in courses_res.data]
    total_courses = len(course_ids)

    total_students = 0
    queries_today = 0
    active_quizzes = 0
    flagged_messages = 0
    recent_activity = []

    if course_ids:
        # Total unique enrolled students across all courses
        enrolled_res = supabase.table("enrolments").select("student_id").in_(
            "course_id", course_ids
        ).execute()
        unique_students = {row["student_id"] for row in enrolled_res.data}
        total_students = len(unique_students)

        # Queries submitted today
        today = datetime.date.today().isoformat()
        queries_res = supabase.table("chat_messages").select("id").in_(
            "course_id", course_ids
        ).gte("timestamp", f"{today}T00:00:00").execute()
        queries_today = len(queries_res.data)

        # Active quizzes
        quizzes_res = supabase.table("quizzes").select("id").in_(
            "course_id", course_ids
        ).eq("is_active", True).execute()
        active_quizzes = len(quizzes_res.data)

        # Flagged messages
        flagged_res = supabase.table("chat_messages").select("id").in_(
            "course_id", course_ids
        ).eq("flagged", True).execute()
        flagged_messages = len(flagged_res.data)

        # Recent activity — last 10 queries with student name and course
        activity_res = supabase.table("chat_messages").select(
            "query, timestamp, course_id, profiles!chat_messages_student_id_fkey(full_name), courses!chat_messages_course_id_fkey(course_name)"
        ).in_("course_id", course_ids).order("timestamp", desc=True).limit(10).execute()
        recent_activity = activity_res.data

    return jsonify({
        "total_courses": total_courses,
        "total_students": total_students,
        "queries_today": queries_today,
        "active_quizzes": active_quizzes,
        "flagged_messages": flagged_messages,
        "recent_activity": recent_activity,
    }), 200
