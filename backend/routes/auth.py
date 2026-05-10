"""
auth.py — Bulletproof registration and login with three fallback strategies.
Works regardless of Supabase email confirmation settings or admin API availability.
"""

from flask import Blueprint, request, jsonify, g
from services.supabase_client import supabase
from middleware.auth_middleware import require_auth

auth_bp = Blueprint("auth", __name__)


def _upsert_profile(user_id: str, full_name: str, role: str, email: str) -> dict:
    """Create profile if missing, return existing one if already there."""
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


def _sign_in_and_get_token(email: str, password: str):
    """Sign in and return (session_token, user_id) or raise on failure."""
    res = supabase.auth.sign_in_with_password({"email": email, "password": password})
    if not res.user or not res.session:
        raise Exception("Sign in returned no session")
    return res.session.access_token, res.user.id


@auth_bp.post("/register")
def register():
    """
    Three-strategy registration — tries each approach until one works:
    1. Admin API with email_confirm=True (best — no confirmation email)
    2. Regular sign_up (fallback if admin API unavailable)
    3. Sign in (if account already exists with same password)
    """
    data = request.get_json(silent=True) or {}
    full_name = data.get("full_name", "").strip()
    email     = data.get("email", "").strip().lower()
    password  = data.get("password", "")
    role      = data.get("role", "").strip().lower()

    if not all([full_name, email, password, role]):
        return jsonify({"error": "All fields are required", "code": 400}), 400
    if role not in ("lecturer", "student"):
        return jsonify({"error": "Role must be 'lecturer' or 'student'", "code": 400}), 400
    if len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters", "code": 400}), 400

    user_id = None
    last_error = ""

    # ── Strategy 1: Admin API (auto-confirms email, most reliable) ──
    try:
        res = supabase.auth.admin.create_user({
            "email": email,
            "password": password,
            "email_confirm": True,
            "user_metadata": {"full_name": full_name, "role": role},
        })
        if res and res.user:
            user_id = res.user.id
            print(f"[REGISTER] Strategy 1 (admin) succeeded: {user_id}")
    except Exception as e:
        last_error = str(e)
        print(f"[REGISTER] Strategy 1 (admin) failed: {e}")

    # ── Strategy 2: Regular sign_up (works when admin API is restricted) ──
    if not user_id:
        try:
            res = supabase.auth.sign_up({
                "email": email,
                "password": password,
                "options": {
                    "data": {"full_name": full_name, "role": role}
                },
            })
            if res and res.user:
                user_id = res.user.id
                print(f"[REGISTER] Strategy 2 (sign_up) succeeded: {user_id}")
        except Exception as e:
            last_error = str(e)
            print(f"[REGISTER] Strategy 2 (sign_up) failed: {e}")

    # ── Strategy 3: Account already exists — try signing in ──
    if not user_id:
        already_exists = any(
            phrase in last_error.lower()
            for phrase in ["already", "exists", "registered", "unique"]
        )
        if already_exists:
            try:
                token, user_id = _sign_in_and_get_token(email, password)
                print(f"[REGISTER] Strategy 3 (existing account) succeeded: {user_id}")
                profile = _upsert_profile(user_id, full_name, role, email)
                return jsonify({
                    "token": token,
                    "user": {
                        "id": user_id,
                        "full_name": profile["full_name"],
                        "email": email,
                        "role": profile["role"],
                    },
                }), 200
            except Exception:
                return jsonify({
                    "error": "This email is already registered. Please log in with your existing password.",
                    "code": 409
                }), 409
        else:
            return jsonify({
                "error": f"Could not create account: {last_error}",
                "code": 400
            }), 400

    if not user_id:
        return jsonify({"error": "Registration failed. Please try again.", "code": 400}), 400

    # ── Create profile record ──
    try:
        profile = _upsert_profile(user_id, full_name, role, email)
    except Exception as e:
        print(f"[REGISTER] Profile creation failed: {e}")
        return jsonify({"error": f"Account created but profile setup failed: {str(e)}", "code": 500}), 500

    # ── Sign in to get session token ──
    try:
        token, _ = _sign_in_and_get_token(email, password)
    except Exception as e:
        print(f"[REGISTER] Post-registration sign in failed: {e}")
        # Account exists but can't sign in yet (email confirmation pending)
        return jsonify({
            "error": "Account created! If you don't get signed in automatically, please log in manually.",
            "code": 201
        }), 201

    print(f"[REGISTER] Complete success for {email} as {role}")
    return jsonify({
        "token": token,
        "user": {
            "id": user_id,
            "full_name": profile["full_name"],
            "email": email,
            "role": profile["role"],
        },
    }), 201


@auth_bp.post("/login")
def login():
    """Authenticate using Supabase session. Returns Supabase access_token."""
    data = request.get_json(silent=True) or {}
    email    = data.get("email", "").strip().lower()
    password = data.get("password", "")

    if not email or not password:
        return jsonify({"error": "Email and password are required", "code": 400}), 400

    try:
        res = supabase.auth.sign_in_with_password({"email": email, "password": password})
    except Exception as e:
        print(f"[LOGIN] Failed for {email}: {e}")
        return jsonify({"error": "Incorrect email or password.", "code": 401}), 401

    if not res.user or not res.session:
        return jsonify({"error": "Incorrect email or password.", "code": 401}), 401

    user_id = res.user.id
    token   = res.session.access_token

    # Get role from user_metadata first, fallback to profiles table
    meta      = res.user.user_metadata or {}
    role      = meta.get("role")
    full_name = meta.get("full_name", "")

    if not role:
        profile_res = supabase.table("profiles").select("role, full_name, email").eq("id", user_id).execute()
        if not profile_res.data:
            return jsonify({
                "error": "Your account setup is incomplete. Please register again.",
                "code": 404
            }), 404
        profile   = profile_res.data[0]
        role      = profile["role"]
        full_name = profile.get("full_name", full_name)

    print(f"[LOGIN] Success: {email} as {role}")
    return jsonify({
        "token": token,
        "user": {
            "id": user_id,
            "full_name": full_name,
            "email": email,
            "role": role,
        },
    }), 200


@auth_bp.post("/logout")
@require_auth
def logout():
    try:
        supabase.auth.sign_out()
    except Exception:
        pass
    return jsonify({"message": "Logged out successfully"}), 200


@auth_bp.get("/me")
@require_auth
def me():
    profile_res = supabase.table("profiles").select("*").eq("id", g.user_id).execute()
    if not profile_res.data:
        return jsonify({"error": "Profile not found", "code": 404}), 404
    profile = profile_res.data[0]
    profile["email"] = g.user_email
    return jsonify(profile), 200
