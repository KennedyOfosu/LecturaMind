"""
auth.py — ID-number based authentication.
Role is automatically detected from the ID prefix (LEC- or STU-).
Login uses ID number + password instead of email + password.
"""

import requests as http_requests
from flask import Blueprint, request, jsonify, g
from services.supabase_client import supabase
from middleware.auth_middleware import require_auth
from config import Config

auth_bp = Blueprint("auth", __name__)


def detect_role_from_id(id_number: str):
    """
    Detects role from ID number prefix.
    Returns 'lecturer', 'student', or None if invalid.
    """
    id_upper = id_number.strip().upper()
    if id_upper.startswith("LEC-") and len(id_upper) == 8:
        return "lecturer"
    elif id_upper.startswith("STU-") and len(id_upper) == 8:
        return "student"
    return None


def _create_auth_user(email: str, password: str, full_name: str, role: str):
    """
    Create Supabase Auth user via Admin REST API (auto-confirms email).
    Falls back to sign_up if admin API fails.
    Returns user_id or raises Exception.
    """
    # Strategy 1: Admin REST API
    try:
        api_url = f"{Config.SUPABASE_URL}/auth/v1/admin/users"
        headers = {
            "apikey": Config.SUPABASE_SERVICE_KEY,
            "Authorization": f"Bearer {Config.SUPABASE_SERVICE_KEY}",
            "Content-Type": "application/json",
        }
        r = http_requests.post(api_url, json={
            "email": email,
            "password": password,
            "email_confirm": True,
            "user_metadata": {"full_name": full_name, "role": role},
        }, headers=headers, timeout=15)
        data = r.json()
        print(f"[REGISTER] Admin API status={r.status_code} id={data.get('id')}")
        if r.status_code in (200, 201) and data.get("id"):
            return data["id"]
    except Exception as e:
        print(f"[REGISTER] Admin API failed: {e}")

    # Strategy 2: sign_up fallback
    try:
        res = supabase.auth.sign_up({
            "email": email,
            "password": password,
            "options": {"data": {"full_name": full_name, "role": role}},
        })
        if res and res.user:
            print(f"[REGISTER] sign_up succeeded: {res.user.id}")
            return res.user.id
    except Exception as e:
        raise Exception(str(e))

    raise Exception("Could not create auth user")


@auth_bp.post("/register")
def register():
    """
    Register with full_name, email, password, id_number.
    Role is detected automatically from the ID prefix.
    """
    data = request.get_json(silent=True) or {}
    full_name = data.get("full_name", "").strip()
    email     = data.get("email", "").strip().lower()
    password  = data.get("password", "")
    id_number = data.get("id_number", "").strip().upper()

    # Step 1: Validate all fields present
    if not all([full_name, email, password, id_number]):
        return jsonify({"error": "All fields are required.", "code": 400}), 400

    if len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters.", "code": 400}), 400

    # Step 2: Detect role from ID — BEFORE creating any account
    role = detect_role_from_id(id_number)
    if not role:
        return jsonify({
            "error": "Invalid ID number format. ID must start with LEC- for lecturers or STU- for students, followed by 4 digits (e.g. LEC-1001).",
            "code": 400
        }), 400

    # Step 3: Check for duplicate ID number
    existing_id = supabase.table("profiles").select("id").eq("user_id_number", id_number).execute()
    if existing_id.data:
        return jsonify({"error": "An account with this ID number already exists.", "code": 409}), 409

    # Step 4: Create Supabase Auth user
    try:
        user_id = _create_auth_user(email, password, full_name, role)
    except Exception as e:
        err = str(e).lower()
        if "already" in err or "exists" in err or "registered" in err:
            return jsonify({"error": "An account with this email address already exists.", "code": 409}), 409
        return jsonify({"error": f"Account creation failed: {str(e)}", "code": 400}), 400

    # Step 5: Insert profile record
    try:
        existing_profile = supabase.table("profiles").select("id").eq("id", user_id).execute()
        if not existing_profile.data:
            supabase.table("profiles").insert({
                "id": user_id,
                "full_name": full_name,
                "role": role,
                "email": email,
                "user_id_number": id_number,
            }).execute()
    except Exception as e:
        return jsonify({"error": f"Profile setup failed: {str(e)}", "code": 500}), 500

    # Step 6: Sign in to get session token
    try:
        session_res = supabase.auth.sign_in_with_password({"email": email, "password": password})
        token = session_res.session.access_token
    except Exception as e:
        return jsonify({"error": f"Account created but sign-in failed: {str(e)}", "code": 500}), 500

    print(f"[REGISTER] Success: {id_number} as {role}")
    return jsonify({
        "token": token,
        "user": {
            "id": user_id,
            "full_name": full_name,
            "email": email,
            "role": role,
            "user_id_number": id_number,
        },
    }), 201


@auth_bp.post("/login")
def login():
    """
    Login with id_number + password.
    Looks up email from profiles table, then authenticates with Supabase.
    """
    data = request.get_json(silent=True) or {}
    id_number = data.get("id_number", "").strip().upper()
    password  = data.get("password", "")

    if not id_number or not password:
        return jsonify({"error": "ID number and password are required.", "code": 400}), 400

    # Look up profile by ID number to get email
    profile_res = supabase.table("profiles").select("*").eq("user_id_number", id_number).execute()
    if not profile_res.data:
        return jsonify({
            "error": "No account found with that ID number. Please check and try again.",
            "code": 404
        }), 404

    profile = profile_res.data[0]
    email   = profile.get("email")

    if not email:
        return jsonify({"error": "Account data is incomplete. Please contact support.", "code": 500}), 500

    # Authenticate with Supabase
    try:
        auth_res = supabase.auth.sign_in_with_password({"email": email, "password": password})
        if not auth_res.session:
            raise Exception("No session")
        token = auth_res.session.access_token
    except Exception:
        return jsonify({"error": "Incorrect password. Please try again.", "code": 401}), 401

    print(f"[LOGIN] Success: {id_number} as {profile['role']}")
    return jsonify({
        "token": token,
        "user": {
            "id": profile["id"],
            "full_name": profile["full_name"],
            "email": email,
            "role": profile["role"],
            "user_id_number": id_number,
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


@auth_bp.post("/seed")
def seed():
    """
    Creates the two default test accounts. Call once after deployment.
    LEC-1001 / lecturer@lecturamind.com / lecturer123
    STU-2001 / student@lecturamind.com  / student123
    """
    accounts = [
        {"full_name": "Dr. Amidini", "email": "lecturer@lecturamind.com",
         "password": "lecturer123", "id_number": "LEC-1001"},
        {"full_name": "Kennedy Ofosu", "email": "student@lecturamind.com",
         "password": "student123", "id_number": "STU-2001"},
    ]
    results = []
    for acc in accounts:
        import requests as req_module
        r = req_module.post(
            f"{request.host_url}api/auth/register",
            json=acc,
            timeout=30
        )
        results.append({"id_number": acc["id_number"], "status": r.status_code, "body": r.json()})
    return jsonify(results), 200
