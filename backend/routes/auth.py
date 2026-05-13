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
    full_name     = data.get("full_name", "").strip()
    email         = data.get("email", "").strip().lower()
    password      = data.get("password", "")
    id_number     = data.get("id_number", "").strip().upper()
    programme     = (data.get("programme") or "").strip()
    raw_level     = data.get("level")
    academic_year = (data.get("academic_year") or "").strip()

    # Validate required fields
    if not all([full_name, email, password, id_number]):
        return jsonify({"error": "Full name, email, password, and ID number are required.", "code": 400}), 400

    if len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters.", "code": 400}), 400

    # Detect role from ID
    role = detect_role_from_id(id_number)
    if not role:
        return jsonify({
            "error": "Invalid ID number format. IDs must start with LEC- or STU- followed by 4 digits (e.g. STU-2001).",
            "code": 400
        }), 400

    # Students MUST provide programme and level
    level = None
    if role == "student":
        if not programme:
            return jsonify({"error": "Programme is required for student registration.", "code": 400}), 400
        try:
            level = int(raw_level)
        except (TypeError, ValueError):
            level = None
        if level not in [100, 200, 300, 400]:
            return jsonify({"error": "Level must be 100, 200, 300, or 400.", "code": 400}), 400

    # Duplicate ID check
    existing_id = supabase.table("profiles").select("id").eq("user_id_number", id_number).execute()
    if existing_id.data:
        return jsonify({"error": "An account with this ID number already exists.", "code": 409}), 409

    # Create auth user
    try:
        user_id = _create_auth_user(email, password, full_name, role)
    except Exception as e:
        err = str(e).lower()
        if "already" in err or "exists" in err or "registered" in err:
            return jsonify({"error": "An account with this email address already exists.", "code": 409}), 409
        return jsonify({"error": f"Account creation failed: {str(e)}", "code": 400}), 400

    # Build profile payload
    profile_payload = {
        "id": user_id,
        "full_name": full_name,
        "role": role,
        "email": email,
        "user_id_number": id_number,
    }
    if role == "student":
        profile_payload["programme"]     = programme
        profile_payload["level"]         = level
        profile_payload["academic_year"] = academic_year or None

    # Insert profile (skip if already exists)
    try:
        existing_profile = supabase.table("profiles").select("id").eq("id", user_id).execute()
        if not existing_profile.data:
            supabase.table("profiles").insert(profile_payload).execute()
        else:
            # Update with new fields if profile already existed
            update_data = {k: v for k, v in profile_payload.items() if k != "id" and v is not None}
            supabase.table("profiles").update(update_data).eq("id", user_id).execute()
    except Exception as e:
        return jsonify({"error": f"Profile setup failed: {str(e)}", "code": 500}), 500

    # Auto-enrol student into matching courses
    if role == "student":
        try:
            from services.enrolment_service import auto_enrol_student_by_programme
            count = auto_enrol_student_by_programme(user_id, programme, level)
            print(f"[REGISTER] Auto-enrolled in {count} course(s)")
        except Exception as e:
            print(f"[REGISTER] Auto-enrolment failed (non-fatal): {e}")

    # Sign in for session token
    try:
        session_res = supabase.auth.sign_in_with_password({"email": email, "password": password})
        token = session_res.session.access_token
    except Exception as e:
        return jsonify({"error": f"Account created but sign-in failed: {str(e)}", "code": 500}), 500

    print(f"[REGISTER] Success: {id_number} as {role}")
    return jsonify({
        "token": token,
        "user": {
            "id":             user_id,
            "full_name":      full_name,
            "email":          email,
            "role":           role,
            "user_id_number": id_number,
            "programme":      programme if role == "student" else None,
            "level":          level if role == "student" else None,
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


@auth_bp.get("/seed")
def seed():
    """
    Creates two default test accounts directly (no HTTP self-call).
    Visit GET /api/auth/seed once after deployment to set up test accounts.
    LEC-1001 / lecturer@lecturamind.com / lecturer123
    STU-2001 / student@lecturamind.com  / student123
    """
    accounts = [
        {"full_name": "Dr. Amidini",   "email": "lecturer@lecturamind.com",
         "password": "lecturer123",    "id_number": "LEC-1001"},
        {"full_name": "Kennedy Ofosu", "email": "student@lecturamind.com",
         "password": "student123",     "id_number": "STU-2001"},
    ]
    results = []
    for acc in accounts:
        id_number = acc["id_number"]
        email     = acc["email"]
        password  = acc["password"]
        full_name = acc["full_name"]
        role      = detect_role_from_id(id_number)

        # Skip if ID already registered
        existing = supabase.table("profiles").select("id").eq("user_id_number", id_number).execute()
        if existing.data:
            results.append({"id_number": id_number, "status": "already exists"})
            continue

        # Create auth user
        try:
            user_id = _create_auth_user(email, password, full_name, role)
        except Exception as e:
            results.append({"id_number": id_number, "status": f"auth failed: {e}"})
            continue

        # Create profile
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
            results.append({"id_number": id_number, "status": "created", "role": role})
        except Exception as e:
            results.append({"id_number": id_number, "status": f"profile failed: {e}"})

    return jsonify({"message": "Seed complete", "results": results}), 200
