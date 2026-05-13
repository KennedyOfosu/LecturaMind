"""
profile.py — Profile update endpoint.
Students who update programme/level trigger auto-enrolment.
"""

from flask import Blueprint, request, jsonify, g
from services.supabase_client import supabase
from middleware.auth_middleware import require_auth

profile_bp = Blueprint("profile", __name__)

LECTURER_FIELDS = ["full_name", "department", "phone", "bio"]
STUDENT_FIELDS  = ["full_name", "phone", "programme", "level", "academic_year"]


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


@profile_bp.get("/")
@require_auth
def get_profile():
    """Return the full profile for the authenticated user."""
    res = supabase.table("profiles").select("*").eq("id", g.user_id).execute()
    if not res.data:
        return jsonify({"error": "Profile not found", "code": 404}), 404
    profile = res.data[0]
    profile["email"] = g.user_email
    return jsonify(profile), 200
