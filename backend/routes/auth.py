"""
auth.py — ID-number based authentication.
Role is automatically detected from the ID prefix (LEC- or STU-).
Login uses ID number + password instead of email + password.
"""

import requests as http_requests
import uuid
from datetime import datetime, timezone
from flask import Blueprint, request, jsonify, g
from services.supabase_client import supabase
from middleware.auth_middleware import require_auth
from config import Config
from services.registration_identity import (
    EMAIL_DUPLICATE_MESSAGE,
    FULL_NAME_DUPLICATE_MESSAGE,
    duplicate_identity_errors,
    normalize_email,
    unique_constraint_field,
)
from services.lecturer_activation import hash_activation_token, password_policy_error

auth_bp = Blueprint("auth", __name__)


def detect_role_from_id(id_number: str):
    """
    Detects role from ID number prefix.
    Returns 'superadmin', 'lecturer', 'student', or None if invalid.
    """
    id_upper = id_number.strip().upper()
    if id_upper.startswith("SUP-") and len(id_upper) == 8:
        return "superadmin"
    elif id_upper.startswith("LEC-") and len(id_upper) == 8:
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


def _delete_auth_user(user_id):
    """Best-effort rollback if profile creation loses a uniqueness race."""
    try:
        api_url = f"{Config.SUPABASE_URL}/auth/v1/admin/users/{user_id}"
        headers = {
            "apikey": Config.SUPABASE_SERVICE_KEY,
            "Authorization": f"Bearer {Config.SUPABASE_SERVICE_KEY}",
        }
        http_requests.delete(api_url, headers=headers, timeout=10)
    except Exception as e:
        print(f"[REGISTER] Auth rollback failed for {user_id}: {e}")


def _duplicate_response(errors):
    return jsonify({"error": next(iter(errors.values())), "field": next(iter(errors)), "errors": errors, "code": 409}), 409


@auth_bp.post("/validate-registration")
def validate_registration():
    """Check submitted name/email values against current database records."""
    data = request.get_json(silent=True) or {}
    full_name = " ".join(str(data.get("full_name") or "").split())
    email = normalize_email(data.get("email"))
    try:
        errors = duplicate_identity_errors(supabase, full_name, email)
    except Exception as e:
        print(f"[REGISTER] Identity validation query failed: {e}")
        return jsonify({"error": "We couldn't verify these details right now. Please try again.", "code": 503}), 503
    return jsonify({"errors": errors}), 200


@auth_bp.post("/register")
def register():
    """
    Register with full_name, email, password, id_number.
    Role is detected automatically from the ID prefix.
    """
    data = request.get_json(silent=True) or {}
    full_name     = " ".join(str(data.get("full_name") or "").split())
    email         = normalize_email(data.get("email"))
    password      = data.get("password", "")
    id_number     = data.get("id_number", "").strip().upper()
    programme     = (data.get("programme") or "").strip()
    raw_level     = data.get("level")
    academic_year = (data.get("academic_year") or "").strip()

    # Validate required fields
    if not all([full_name, email, password, id_number]):
        return jsonify({"error": "Full name, email, password, and ID number are required.", "code": 400}), 400

    # This query uses the real profile table; the unique indexes below remain the
    # final authority if another request registers the same identity concurrently.
    try:
        identity_errors = duplicate_identity_errors(supabase, full_name, email)
    except Exception as e:
        print(f"[REGISTER] Duplicate identity check failed: {e}")
        return jsonify({"error": "We couldn't verify these details right now. Please try again.", "code": 503}), 503
    if identity_errors:
        return _duplicate_response(identity_errors)

    if len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters.", "code": 400}), 400

    # Detect role from ID
    role = detect_role_from_id(id_number)
    if not role:
        return jsonify({
            "error": "Invalid ID number format. IDs must start with LEC- or STU- followed by 4 digits (e.g. STU-2001).",
            "code": 400
        }), 400
    if role in ("lecturer", "superadmin"):
        return jsonify({
            "error": "Lecturer and Super-Admin accounts must be created by an administrator.",
            "code": 403,
        }), 403

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
            return _duplicate_response({"email": EMAIL_DUPLICATE_MESSAGE})
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
        conflict_field = unique_constraint_field(e)
        if conflict_field == "email":
            _delete_auth_user(user_id)
            return _duplicate_response({"email": EMAIL_DUPLICATE_MESSAGE})
        if conflict_field == "full_name":
            _delete_auth_user(user_id)
            return _duplicate_response({"full_name": FULL_NAME_DUPLICATE_MESSAGE})
        if conflict_field == "id_number":
            _delete_auth_user(user_id)
            return jsonify({"error": "An account with this ID number already exists.", "field": "id_number", "code": 409}), 409
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
    account_status = profile.get("account_status", "active")
    if account_status == "pending_activation":
        return jsonify({"error": "Your account is waiting for password activation. Open the setup link provided by your administrator.", "code": 403}), 403
    if account_status == "deactivated":
        return jsonify({"error": "This account has been deactivated. Contact your administrator.", "code": 403}), 403

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


def _activation_state(token):
    token_hash = hash_activation_token(token)
    if not token_hash:
        return None, "This activation link is invalid. Request a new link from your administrator."
    result = supabase.table("lecturer_activation_tokens").select(
        "user_id, expires_at, used_at"
    ).eq("token_hash", token_hash).limit(1).execute()
    if not result.data:
        return None, "This activation link is invalid. Request a new link from your administrator."

    activation = result.data[0]
    if activation.get("used_at"):
        return None, "This activation link has already been used. Contact your administrator for a new link."
    expires_at = datetime.fromisoformat(activation["expires_at"].replace("Z", "+00:00"))
    if expires_at <= datetime.now(timezone.utc):
        return None, "This activation link has expired. Contact your administrator for a new link."

    profile_result = supabase.table("profiles").select(
        "id, full_name, email, role, account_status"
    ).eq("id", activation["user_id"]).limit(1).execute()
    if not profile_result.data:
        return None, "The account for this activation link is unavailable. Contact your administrator."
    profile = profile_result.data[0]
    if profile.get("role") != "lecturer":
        return None, "This activation link is not valid for a lecturer account."
    if profile.get("account_status") == "active":
        return None, "This lecturer account has already been activated."
    if profile.get("account_status") == "deactivated":
        return None, "This lecturer account has been deactivated. Contact your administrator."
    if profile.get("account_status") != "pending_activation":
        return None, "This lecturer account is not eligible for activation."
    return profile, None


@auth_bp.post("/activation/validate")
def validate_lecturer_activation():
    data = request.get_json(silent=True) or {}
    try:
        profile, error = _activation_state(data.get("token"))
    except Exception as e:
        print(f"[ACTIVATION] Token validation query failed: {e}")
        return jsonify({"error": "We could not verify this activation link. Please try again."}), 503
    if error:
        return jsonify({"error": error}), 400
    return jsonify({"lecturer": {"full_name": profile.get("full_name"), "email": profile.get("email")}}), 200


@auth_bp.post("/activation/complete")
def complete_lecturer_activation():
    data = request.get_json(silent=True) or {}
    token = data.get("token")
    password = data.get("password")
    policy_error = password_policy_error(password)
    if policy_error:
        return jsonify({"error": policy_error, "field": "password"}), 400

    try:
        profile, error = _activation_state(token)
    except Exception as e:
        print(f"[ACTIVATION] Activation lookup failed: {e}")
        return jsonify({"error": "We could not verify this activation link. Please try again."}), 503
    if error:
        return jsonify({"error": error}), 400

    claim_id = str(uuid.uuid4())
    token_hash = hash_activation_token(token)
    try:
        claimed = supabase.rpc("claim_lecturer_activation", {
            "p_token_hash": token_hash,
            "p_claim_id": claim_id,
        }).execute()
        claim_rows = claimed.data or []
    except Exception as e:
        print(f"[ACTIVATION] Could not claim activation token: {e}")
        return jsonify({"error": "This link could not be activated right now. Please try again."}), 503
    if not claim_rows:
        return jsonify({"error": "This activation link is being used or is no longer valid. Try again or request a new link."}), 409

    user_id = claim_rows[0]["user_id"]
    try:
        update_url = f"{Config.SUPABASE_URL}/auth/v1/admin/users/{user_id}"
        headers = {
            "apikey": Config.SUPABASE_SERVICE_KEY,
            "Authorization": f"Bearer {Config.SUPABASE_SERVICE_KEY}",
            "Content-Type": "application/json",
        }
        response = http_requests.put(update_url, json={"password": password}, headers=headers, timeout=15)
        if response.status_code not in (200, 201):
            supabase.rpc("release_lecturer_activation_claim", {
                "p_user_id": user_id,
                "p_claim_id": claim_id,
            }).execute()
            print(f"[ACTIVATION] Auth password update failed with status {response.status_code}")
            return jsonify({"error": "We could not set your password right now. Please try again."}), 503
    except Exception as e:
        try:
            supabase.rpc("release_lecturer_activation_claim", {
                "p_user_id": user_id,
                "p_claim_id": claim_id,
            }).execute()
        except Exception:
            pass
        print(f"[ACTIVATION] Auth password update failed: {e}")
        return jsonify({"error": "We could not set your password right now. Please try again."}), 503

    try:
        finalized = supabase.rpc("finalize_lecturer_activation", {
            "p_user_id": user_id,
            "p_claim_id": claim_id,
        }).execute()
        if finalized.data is not True:
            raise RuntimeError("Activation finalization returned false")
    except Exception as e:
        print(f"[ACTIVATION] Password set but activation finalization failed for {user_id}: {e}")
        return jsonify({"error": "Your password was saved, but activation is still processing. Please retry this link in a few minutes."}), 503

    return jsonify({"message": "Password set and lecturer account activated."}), 200


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
    if not Config.is_verified_development_environment():
        return jsonify({"error": "Not found", "code": 404}), 404

    accounts = [
        {"full_name": "Dr. Amidini",   "email": "lecturer@lecturamind.com",
         "password": "lecturer123",    "id_number": "LEC-1001"},
        {"full_name": "Jane Doe", "email": "jane.doe@lecturamind.com", "password": "lecturer123", "id_number": "LEC-2001"},
    {"full_name": "Kennedy Ofosu", "email": "student@lecturamind.com",
         "password": "student123",    "id_number": "STU-2001"},
    {"full_name": "Jane Doe", "email": "jane.doe@lecturamind.com",
         "password": "lecturer123",    "id_number": "LEC-2001"},
    {"full_name": "System Admin", "email": "admin@lecturamind.com",
         "password": "admin123",    "id_number": "SUP-1001"},
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
