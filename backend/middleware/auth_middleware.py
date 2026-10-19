"""
auth_middleware.py — Verifies Supabase session tokens and loads role from profiles table.
Role is always read from the profiles table (most reliable source).
"""

from functools import wraps
import time
from flask import request, jsonify, g
import httpx
from services.supabase_client import supabase


def _retry_transient_supabase_call(call, attempts=3):
    """Retry short-lived socket failures from the shared Supabase HTTP client."""
    for attempt in range(attempts):
        try:
            return call()
        except Exception as exc:
            detail = f"{type(exc).__name__}: {exc}".lower()
            transient = isinstance(exc, (httpx.TransportError, OSError)) or any(
                marker in detail for marker in (
                    "winerror 10035",
                    "non-blocking socket operation",
                    "temporarily unavailable",
                )
            )
            if not transient or attempt == attempts - 1:
                raise
            time.sleep(0.15 * (attempt + 1))


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
            user_res = _retry_transient_supabase_call(lambda: supabase.auth.get_user(token))
            user = user_res.user
            if not user:
                raise Exception("No user")
            g.user_id = user.id
            g.user_email = user.email
        except Exception as e:
            print(f"[AUTH] Token verification failed: {e}")
            return jsonify({"error": "Invalid or expired token", "code": 401}), 401

        # The profile table is authoritative for both role and account state.
        try:
            try:
                profile_res = _retry_transient_supabase_call(lambda: supabase.table("profiles").select(
                    "role, full_name, email, account_status"
                ).eq("id", g.user_id).limit(1).execute())
            except Exception as e:
                # account_status was introduced by migration 008. Keep existing
                # installations usable until that additive migration is applied;
                # all pre-migration profiles have the legacy active behavior.
                error_text = str(e).lower()
                missing_status = (
                    "account_status" in error_text
                    and ("does not exist" in error_text or "42703" in error_text)
                )
                if not missing_status:
                    raise
                print("[AUTH] profiles.account_status is not migrated yet; using legacy active status.")
                profile_res = _retry_transient_supabase_call(lambda: supabase.table("profiles").select(
                    "role, full_name, email"
                ).eq("id", g.user_id).limit(1).execute())
        except Exception as e:
            print(f"[AUTH] Profile lookup failed: {type(e).__name__}: {e}")
            return jsonify({"error": "Account status could not be verified.", "code": 503}), 503

        if not profile_res.data:
            return jsonify({"error": "No active account profile was found.", "code": 403}), 403

        profile = profile_res.data[0]
        g.user_role = profile.get("role")
        g.user_full_name = profile.get("full_name", "")
        if profile.get("account_status", "active") != "active":
            return jsonify({"error": "This account is not active.", "code": 403}), 403

        print(f"[AUTH] user_id={g.user_id} role={g.user_role} email={g.user_email}")
        return f(*args, **kwargs)

    return decorated


def require_role(*roles: str):
    """
    Enforces one or more allowed roles. Superadmin always passes.
    Must be used after @require_auth.
    Usage: @require_role("lecturer") or @require_role("lecturer", "superadmin")
    """
    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            current_role = g.get("user_role")
            print(f"[ROLE] allowed={roles} got={current_role}")
            if current_role == "superadmin":
                return f(*args, **kwargs)
            if current_role not in roles:
                return jsonify({"error": "Access denied: insufficient role", "code": 403}), 403
            return f(*args, **kwargs)
        return decorated
    return decorator


def require_superadmin(f):
    """Enforces superadmin role. Must be used after @require_auth."""
    @wraps(f)
    def decorated(*args, **kwargs):
        current_role = g.get("user_role")
        print(f"[SUPERADMIN] required=superadmin got={current_role}")
        if current_role != "superadmin":
            return jsonify({"error": "Access denied: superadmin role required", "code": 403}), 403
        return f(*args, **kwargs)
    return decorated
