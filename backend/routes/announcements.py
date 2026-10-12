"""
announcements.py — CRUD routes for course announcements posted by lecturers.
Supports Kanban statuses: draft, scheduled, published, archived.
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

    Body: { course_id, title, content, event_date?, status?, priority? }
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

    event_date = (data.get("event_date") or "").strip() or None
    status     = data.get("status", "published")
    priority   = data.get("priority", "medium")

    # Normalise event_date / posted_at based on status
    insert_payload = {
        "course_id": course_id,
        "title": title,
        "content": content,
        "status": status,
        "priority": priority,
        "is_archived": False,
    }
    if status == "scheduled" and event_date:
        insert_payload["posted_at"] = event_date
    elif status == "published":
        insert_payload["posted_at"] = event_date if event_date else None
    else:
        insert_payload["posted_at"] = None

    res = supabase.table("announcements").insert(insert_payload).execute()
    record = res.data[0]

    # Push real-time notification to enrolled students (only for published)
    if status == "published":
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
    Update an announcement's title, content, status, priority, or event_date.

    Body: { title?, content?, status?, priority?, event_date? }
    """
    data = request.get_json(silent=True) or {}
    updates = {}
    if "title"      in data: updates["title"]     = data["title"].strip()
    if "content"    in data: updates["content"]   = data["content"].strip()
    if "status"     in data: updates["status"]     = data["status"]
    if "priority"   in data: updates["priority"]   = data["priority"]
    if "is_archived" in data: updates["is_archived"] = data["is_archived"]
    if "event_date" in data:
        ed = (data["event_date"] or "").strip()
        updates["posted_at"] = ed if ed else None
    else:
        # When status changes, posted_at follows
        if data.get("status") == "draft":
            updates["posted_at"] = None
        elif data.get("status") == "scheduled" and data.get("event_date"):
            updates["posted_at"] = data["event_date"]
        elif data.get("status") == "archived":
            updates["is_archived"] = True

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
