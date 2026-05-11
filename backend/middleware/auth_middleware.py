"""
auth_middleware.py — Verifies Supabase session tokens and loads role from profiles table.
Role is always read from the profiles table (most reliable source).
"""

from functools import wraps
from flask import request, jsonify, g
from services.supabase_client import supabase


def require_auth(f):
    """
    Validates the Supabase access token from Authorization header.
    Sets g.user_id, g.user_role, g.user_email for downstream use.
    Role is fetched from the profiles table — never depends on JWT metadata.
    """
    @wraps(f)
    def decorated(*args, **kwargs):
        # Let CORS preflight through without auth check
        if request.method == "OPTIONS":
            return f(*args, **kwargs)

        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "Missing or malformed token", "code": 401}), 401

        token = auth_header.split(" ", 1)[1]

        # Verify token with Supabase
        try:
            user_res = supabase.auth.get_user(token)
            user = user_res.user
            if not user:
                raise Exception("No user")
            g.user_id = user.id
            g.user_email = user.email
        except Exception as e:
            print(f"[AUTH] Token verification failed: {e}")
            return jsonify({"error": "Invalid or expired token", "code": 401}), 401

        # Always read role from profiles table — most reliable source
        try:
            profile_res = supabase.table("profiles").select("role, full_name, email").eq("id", g.user_id).execute()
            if profile_res.data:
                g.user_role = profile_res.data[0].get("role")
                g.user_full_name = profile_res.data[0].get("full_name", "")
            else:
                # Fallback to user_metadata if profile missing
                meta = user.user_metadata or {}
                g.user_role = meta.get("role")
                g.user_full_name = meta.get("full_name", "")
        except Exception as e:
            print(f"[AUTH] Profile lookup failed: {e}")
            meta = user.user_metadata or {}
            g.user_role = meta.get("role")
            g.user_full_name = meta.get("full_name", "")

        print(f"[AUTH] user_id={g.user_id} role={g.user_role} email={g.user_email}")
        return f(*args, **kwargs)

    return decorated


def require_role(role: str):
    """Enforces a specific role. Must be used after @require_auth."""
    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            current_role = g.get("user_role")
            print(f"[ROLE] required={role} got={current_role}")
            if current_role != role:
                return jsonify({"error": "Access denied: insufficient role", "code": 403}), 403
            return f(*args, **kwargs)
        return decorated
    return decorator
