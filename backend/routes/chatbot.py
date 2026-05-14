"""
chatbot.py — AI chatbot query and chat history routes, plus lecturer log management.
"""

from datetime import datetime, timezone
from flask import Blueprint, request, jsonify, g
from services.supabase_client import supabase
from services.ai_service import process_student_query
from middleware.auth_middleware import require_auth, require_role

chatbot_bp = Blueprint("chatbot", __name__)


@chatbot_bp.post("/query")
@require_auth
@require_role("student")
def query():
    """
    Process a student's AI query for a specific course.

    Body: { course_id, query }
    Returns: { response }
    """
    data = request.get_json(silent=True) or {}
    course_id = data.get("course_id", "").strip()
    student_query = data.get("query", "").strip()

    if not course_id or not student_query:
        return jsonify({"error": "course_id and query are required", "code": 400}), 400

    response_text = process_student_query(course_id, g.user_id, student_query)
    return jsonify({
        "response":  response_text,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }), 200


@chatbot_bp.get("/history/<course_id>")
@require_auth
@require_role("student")
def get_history(course_id: str):
    """Return the authenticated student's full chat history for a course."""
    res = supabase.table("chat_messages").select("*").eq(
        "course_id", course_id
    ).eq("student_id", g.user_id).order("timestamp", desc=False).execute()
    return jsonify(res.data), 200


@chatbot_bp.get("/logs/<course_id>")
@require_auth
@require_role("lecturer")
def get_logs(course_id: str):
    """
    Return all chat messages for a course, joined with student profiles.
    Grouped view for the lecturer's chat log review panel.
    """
    res = supabase.table("chat_messages").select(
        "*, profiles!chat_messages_student_id_fkey(full_name, avatar_url)"
    ).eq("course_id", course_id).order("timestamp", desc=True).execute()
    return jsonify(res.data), 200


@chatbot_bp.patch("/flag/<message_id>")
@require_auth
@require_role("lecturer")
def flag_message(message_id: str):
    """Toggle the flagged boolean on a chat message."""
    current_res = supabase.table("chat_messages").select("flagged").eq("id", message_id).single().execute()
    if not current_res.data:
        return jsonify({"error": "Message not found", "code": 404}), 404

    new_flag = not current_res.data["flagged"]
    res = supabase.table("chat_messages").update({"flagged": new_flag}).eq("id", message_id).execute()
    return jsonify(res.data[0]), 200
