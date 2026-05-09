"""
auth.py — Authentication using Supabase Auth natively.
Uses admin.create_user() so email confirmation is never required.
Returns Supabase session tokens (not custom JWTs) — same pattern as ExamsPulse.
"""

from flask import Blueprint, request, jsonify, g
from services.supabase_client import supabase
from middleware.auth_middleware import require_auth

auth_bp = Blueprint("auth", __name__)


def _get_or_create_profile(user_id: str, full_name: str, role: str, email: str) -> dict:
    """Fetch profile if it exists, create it if not. Never crashes on duplicate."""
    existing = supabase.table("profiles").select("*").eq("id", user_id).execute()
    if existing.data:
        return existing.data[0]
    res = supabase.table("profiles").insert({
        "id": user_id,
        "full_name": full_name,
        "role": role,
        "email": email,
    }).execute()
    return res.data[0]


@auth_bp.post("/register")
def register():
    """
    Register a new user using Supabase Admin API.
    - Email confirmation is automatically bypassed (email_confirm=True)
    - Role and name are stored in Supabase user_metadata AND profiles table
    - Returns Supabase access_token (not a custom JWT)
    """
    data = request.get_json(silent=True) or {}
    full_name = data.get("full_name", "").strip()
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")
    role = data.get("role", "").strip().lower()

    if not all([full_name, email, password, role]):
        return jsonify({"error": "All fields are required", "code": 400}), 400
    if role not in ("lecturer", "student"):
        return jsonify({"error": "Role must be 'lecturer' or 'student'", "code": 400}), 400
    if len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters", "code": 400}), 400

    # Create user via Admin API — auto-confirms email, no verification needed
    try:
        admin_res = supabase.auth.admin.create_user({
            "email": email,
            "password": password,
            "email_confirm": True,
            "user_metadata": {"full_name": full_name, "role": role},
        })
        user_id = admin_res.user.id
    except Exception as e:
        err = str(e).lower()
        if "already registered" in err or "already exists" in err or "unique" in err:
            return jsonify({
                "error": "This email is already registered. Please log in instead.",
                "code": 409
            }), 409
        return jsonify({"error": f"Registration failed: {str(e)}", "code": 400}), 400

    # Save profile to database
    try:
        _get_or_create_profile(user_id, full_name, role, email)
    except Exception as e:
        return jsonify({"error": f"Profile setup failed: {str(e)}", "code": 500}), 500

    # Sign in immediately to get a session token
    try:
        session_res = supabase.auth.sign_in_with_password({"email": email, "password": password})
        token = session_res.session.access_token
    except Exception as e:
        return jsonify({"error": f"Account created but login failed: {str(e)}", "code": 500}), 500

    return jsonify({
        "token": token,
        "user": {"id": user_id, "full_name": full_name, "email": email, "role": role},
    }), 201


@auth_bp.post("/login")
def login():
    """
    Authenticate using Supabase session. Returns Supabase access_token.
    Role is read from user_metadata (set at registration) with fallback to profiles table.
    """
    data = request.get_json(silent=True) or {}
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    if not email or not password:
        return jsonify({"error": "Email and password are required", "code": 400}), 400

    try:
        res = supabase.auth.sign_in_with_password({"email": email, "password": password})
    except Exception:
        return jsonify({"error": "Incorrect email or password.", "code": 401}), 401

    if not res.user or not res.session:
        return jsonify({"error": "Incorrect email or password.", "code": 401}), 401

    user_id = res.user.id
    token = res.session.access_token

    # Get role — first from user_metadata, fallback to profiles table
    meta = res.user.user_metadata or {}
    role = meta.get("role")
    full_name = meta.get("full_name", "")

    if not role:
        profile_res = supabase.table("profiles").select("role, full_name, email").eq("id", user_id).execute()
        if not profile_res.data:
            return jsonify({
                "error": "Account found but profile is missing. Please register again.",
                "code": 404
            }), 404
        profile = profile_res.data[0]
        role = profile["role"]
        full_name = profile.get("full_name", full_name)

    return jsonify({
        "token": token,
        "user": {
            "id": user_id,
            "full_name": full_name,
            "email": email,
            "role": role,
            "avatar_url": meta.get("avatar_url"),
        },
    }), 200


@auth_bp.post("/logout")
@require_auth
def logout():
    """Sign out and invalidate the Supabase session."""
    try:
        supabase.auth.sign_out()
    except Exception:
        pass
    return jsonify({"message": "Logged out successfully"}), 200


@auth_bp.get("/me")
@require_auth
def me():
    """Return the current user's profile."""
    profile_res = supabase.table("profiles").select("*").eq("id", g.user_id).execute()
    if not profile_res.data:
        return jsonify({"error": "Profile not found", "code": 404}), 404
    profile = profile_res.data[0]
    profile["email"] = g.user_email
    return jsonify(profile), 200
