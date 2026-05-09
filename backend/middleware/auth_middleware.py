"""
auth_middleware.py — Verifies Supabase session tokens using supabase.auth.get_user().
This is the same pattern used by ExamsPulse — no custom JWT needed.
Role is read from user_metadata with fallback to the profiles table.
"""

from functools import wraps
from flask import request, jsonify, g
from services.supabase_client import supabase


def require_auth(f):
    """
    Decorator that validates the Supabase access token from the Authorization header.
    Sets g.user_id, g.user_role, and g.user_email for downstream use.
    """
    @wraps(f)
    def decorated(*args, **kwargs):
        # Let CORS preflight pass through without auth
        if request.method == "OPTIONS":
            return f(*args, **kwargs)

        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "Missing or malformed token", "code": 401}), 401

        token = auth_header.split(" ", 1)[1]

        try:
            # Verify token with Supabase — same as ExamsPulse approach
            user_res = supabase.auth.get_user(token)
            user = user_res.user
            if not user:
                raise Exception("No user returned")
        except Exception:
            return jsonify({"error": "Invalid or expired token", "code": 401}), 401

        g.user_id = user.id
        g.user_email = user.email

        # Get role from user_metadata (set during registration)
        meta = user.user_metadata or {}
        g.user_role = meta.get("role")
        g.user_full_name = meta.get("full_name", "")

        # Fallback: read role from profiles table if metadata is missing
        if not g.user_role:
            try:
                profile = supabase.table("profiles").select("role, full_name").eq("id", user.id).execute()
                if profile.data:
                    g.user_role = profile.data[0].get("role")
                    g.user_full_name = profile.data[0].get("full_name", "")
            except Exception:
                pass

        print(f"[AUTH] user_id={g.user_id} role={g.user_role} email={g.user_email}")
        return f(*args, **kwargs)

    return decorated


def require_role(role: str):
    """
    Decorator factory that enforces a specific role.
    Must be used after @require_auth.
    """
    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            current_role = g.get("user_role")
            print(f"[ROLE CHECK] required={role} got={current_role} match={current_role == role}")
            if current_role != role:
                return jsonify({"error": "Access denied: insufficient role", "code": 403}), 403
            return f(*args, **kwargs)
        return decorated
    return decorator
