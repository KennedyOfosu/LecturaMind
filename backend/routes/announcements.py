"""
announcements.py — CRUD routes for course announcements posted by lecturers.
"""

from flask import Blueprint, request, jsonify, g
from services.supabase_client import supabase
from services.socket_service import get_socketio
from middleware.auth_middleware import require_auth, require_role

announcements_bp = Blueprint("announcements", __name__)


@announcements_bp.post("")
@require_auth
@require_role("lecturer")
def create_announcement():
    """
    Post a new announcement to a course.
    After saving, pushes a real-time socket event to every enrolled student.

    Body: { course_id, title, content }
    Returns: the created announcement record.
    """
    data = request.get_json(silent=True) or {}
    course_id = data.get("course_id", "").strip()
    title     = data.get("title", "").strip()
    content   = data.get("content", "").strip()

    if not all([course_id, title, content]):
        return jsonify({"error": "course_id, title, and content are required", "code": 400}), 400

    # Fetch course name + lecturer name for the notification payload
    course_res = supabase.table("courses").select(
        "course_name, profiles!courses_lecturer_id_fkey(full_name)"
    ).eq("id", course_id).execute()
    course_name   = (course_res.data[0].get("course_name") if course_res.data else "") or ""
    lecturer_name = ""
    if course_res.data:
        p = course_res.data[0].get("profiles") or {}
        lecturer_name = p.get("full_name", "")

    # Optional event_date lets the lecturer attach a specific date/time
    event_date = (data.get("event_date") or "").strip() or None

    insert_payload = {"course_id": course_id, "title": title, "content": content}
    if event_date:
        insert_payload["posted_at"] = event_date   # override the DB default

    res = supabase.table("announcements").insert(insert_payload).execute()
    record = res.data[0]

    # Push real-time notification to every enrolled student
    try:
        enrolments = supabase.table("enrolments").select("student_id").eq(
            "course_id", course_id
        ).execute()

        sio = get_socketio()
        if sio and enrolments.data:
            payload = {
                "announcement_id": record["id"],
                "course_id":       course_id,
                "course_name":     course_name,
                "lecturer_name":   lecturer_name,
                "title":           title,
                "content":         content,
                "posted_at":       record.get("posted_at", ""),
            }
            # Emit to each student's personal room AND the course room so
            # the notification arrives regardless of which room the client
            # has joined first.
            for row in enrolments.data:
                sio.emit("new_announcement", payload,
                         room=f"student_{row['student_id']}", namespace="/")
            sio.emit("new_announcement", payload,
                     room=f"course_{course_id}", namespace="/")
            print(f"[announcement] Notified {len(enrolments.data)} student(s) in {course_name}")
    except Exception as e:
        print(f"[announcement] Socket emit failed (non-fatal): {e}")

    return jsonify(record), 201


@announcements_bp.get("/my")
@require_auth
@require_role("lecturer")
def get_my_announcements():
    """Return all announcements across every course owned by the lecturer."""
    courses_res = supabase.table("courses").select("id").eq(
        "lecturer_id", g.user_id
    ).execute()
    if not courses_res.data:
        return jsonify([]), 200
    course_ids = [c["id"] for c in courses_res.data]
    res = supabase.table("announcements").select(
        "*, courses(course_name, course_code)"
    ).in_("course_id", course_ids).order("posted_at", desc=True).execute()
    return jsonify(res.data or []), 200


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
    if "title"      in data: updates["title"]     = data["title"].strip()
    if "content"    in data: updates["content"]   = data["content"].strip()
    if "event_date" in data:
        ed = (data["event_date"] or "").strip()
        if ed:
            updates["posted_at"] = ed

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
