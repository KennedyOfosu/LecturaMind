"""
announcements.py — CRUD routes for course announcements posted by lecturers.
"""

from flask import Blueprint, request, jsonify, g
from services.supabase_client import supabase
from middleware.auth_middleware import require_auth, require_role

announcements_bp = Blueprint("announcements", __name__)


@announcements_bp.post("")
@require_auth
@require_role("lecturer")
def create_announcement():
    """
    Post a new announcement to a course.

    Body: { course_id, title, content }
    Returns: the created announcement record.
    """
    data = request.get_json(silent=True) or {}
    course_id = data.get("course_id", "").strip()
    title = data.get("title", "").strip()
    content = data.get("content", "").strip()

    if not all([course_id, title, content]):
        return jsonify({"error": "course_id, title, and content are required", "code": 400}), 400

    res = supabase.table("announcements").insert({
        "course_id": course_id,
        "title": title,
        "content": content,
    }).execute()
    return jsonify(res.data[0]), 201


@announcements_bp.get("/course/<course_id>")
@require_auth
def get_course_announcements(course_id: str):
    """Return all announcements for a course, newest first."""
    res = supabase.table("announcements").select("*").eq(
        "course_id", course_id
    ).order("posted_at", desc=True).execute()
    return jsonify(res.data), 200


@announcements_bp.put("/<announcement_id>")
@require_auth
@require_role("lecturer")
def update_announcement(announcement_id: str):
    """
    Update an announcement's title or content.

    Body: { title?, content? }
    """
    data = request.get_json(silent=True) or {}
    updates = {}
    if "title" in data:
        updates["title"] = data["title"].strip()
    if "content" in data:
        updates["content"] = data["content"].strip()

    if not updates:
        return jsonify({"error": "Nothing to update", "code": 400}), 400

    res = supabase.table("announcements").update(updates).eq("id", announcement_id).execute()
    if not res.data:
        return jsonify({"error": "Announcement not found", "code": 404}), 404
    return jsonify(res.data[0]), 200


@announcements_bp.delete("/<announcement_id>")
@require_auth
@require_role("lecturer")
def delete_announcement(announcement_id: str):
    """Delete an announcement by ID."""
    res = supabase.table("announcements").delete().eq("id", announcement_id).execute()
    if not res.data:
        return jsonify({"error": "Announcement not found", "code": 404}), 404
    return jsonify({"message": "Announcement deleted"}), 200
