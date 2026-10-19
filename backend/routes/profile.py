"""
profile.py — Profile update endpoint.
Students who update programme/level trigger auto-enrolment.
"""

import uuid
from flask import Blueprint, request, jsonify, g
from services.supabase_client import supabase
from middleware.auth_middleware import require_auth

profile_bp = Blueprint("profile", __name__)

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp"}
MAX_IMAGE_SIZE = 2 * 1024 * 1024  # 2 MB

LECTURER_FIELDS = ["full_name", "department", "phone", "bio", "user_id_number", "avatar_url"]
STUDENT_FIELDS  = ["full_name", "phone", "programme", "level", "academic_year", "user_id_number", "avatar_url"]


@profile_bp.put("/update")
@require_auth
def update_profile():
    data    = request.get_json(silent=True) or {}
    user_id = g.user_id
    role    = g.user_role

    allowed = LECTURER_FIELDS if role == "lecturer" else STUDENT_FIELDS
    update_data = {}
    for k in allowed:
        if k in data and data[k] is not None:
            v = data[k]
            if isinstance(v, str):
                v = v.strip()
            update_data[k] = v

    if not update_data:
        return jsonify({"error": "No valid fields to update.", "code": 400}), 400

    # Validate level if provided
    if "level" in update_data:
        try:
            lvl = int(update_data["level"])
        except (TypeError, ValueError):
            lvl = None
        if lvl not in [100, 200, 300, 400]:
            return jsonify({"error": "Level must be 100, 200, 300, or 400.", "code": 400}), 400
        update_data["level"] = lvl

    try:
        supabase.table("profiles").update(update_data).eq("id", user_id).execute()
    except Exception as e:
        return jsonify({"error": f"Update failed: {str(e)}", "code": 500}), 500

    # Trigger auto-enrol if student changed programme or level
    auto_enrolled = 0
    if role == "student" and ("programme" in update_data or "level" in update_data):
        try:
            profile = supabase.table("profiles").select(
                "programme, level"
            ).eq("id", user_id).execute()
            if profile.data:
                p = profile.data[0]
                if p.get("programme") and p.get("level"):
                    from services.enrolment_service import auto_enrol_student_by_programme
                    auto_enrolled = auto_enrol_student_by_programme(
                        user_id, p["programme"], int(p["level"])
                    )
        except Exception as e:
            print(f"[PROFILE] Auto-enrol after update failed: {e}")

    return jsonify({
        "message": "Profile updated successfully.",
        "auto_enrolled": auto_enrolled,
    }), 200


@profile_bp.post("/avatar")
@require_auth
def upload_avatar():
    """Upload a profile avatar image to Supabase Storage."""
    user_id = g.user_id

    if "avatar" not in request.files:
        return jsonify({"error": "No image file provided", "code": 400}), 400

    file = request.files["avatar"]
    if not file or not file.filename:
        return jsonify({"error": "No file selected", "code": 400}), 400

    if file.content_type not in ALLOWED_IMAGE_TYPES:
        return jsonify({"error": "Only JPG, PNG, GIF, and WebP images are allowed", "code": 415}), 415

    file_bytes = file.read()
    if len(file_bytes) > MAX_IMAGE_SIZE:
        return jsonify({"error": "Image must be under 2 MB", "code": 413}), 413
    if len(file_bytes) == 0:
        return jsonify({"error": "The uploaded file is empty", "code": 400}), 400

    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else "png"
    safe_name = f"{uuid.uuid4().hex}.{ext}"
    path = f"{user_id}/{safe_name}"

    try:
        supabase.storage.from_("avatars").upload(
            path,
            file_bytes,
            {"content-type": file.content_type, "x-upsert": "true"},
        )
    except Exception as e:
        return jsonify({"error": f"Storage upload failed: {str(e)}", "code": 500}), 500

    public_url = supabase.storage.from_("avatars").get_public_url(path)

    try:
        supabase.table("profiles").update({"avatar_url": public_url}).eq("id", user_id).execute()
    except Exception as e:
        return jsonify({"error": f"Profile update failed: {str(e)}", "code": 500}), 500

    return jsonify({"avatar_url": public_url}), 200


@profile_bp.get("/")
@require_auth
def get_profile():
    """Return the full profile for the authenticated user."""
    res = supabase.table("profiles").select(
        "*, classrooms!profiles_classroom_id_fkey(id, name, code, programme, level, room_id, physical_rooms!classrooms_room_id_fkey(id, name, code, building, campus, capacity))"
    ).eq("id", g.user_id).execute()
    if not res.data:
        return jsonify({"error": "Profile not found", "code": 404}), 404
    profile = res.data[0]
    classroom = profile.pop("classrooms", None)
    if classroom:
        room = classroom.pop("physical_rooms", None)
        classroom["physical_room"] = room
        classroom["class_code"] = classroom.get("code")
        classroom["code"] = room.get("code") if room else None
    profile["classroom"] = classroom
    profile["email"] = g.user_email
    return jsonify(profile), 200
