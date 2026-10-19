"""Normalization and database checks for registration identity fields."""

import re


FULL_NAME_DUPLICATE_MESSAGE = "This full name is already registered. Please use a different name."
EMAIL_DUPLICATE_MESSAGE = "This email address is already in use. Please use a different email address."


def normalize_full_name(value):
    """Trim and collapse whitespace; compare names case-insensitively."""
    return re.sub(r"\s+", " ", str(value or "").strip()).lower()


def normalize_email(value):
    return str(value or "").strip().lower()


def duplicate_identity_errors(supabase, full_name, email):
    """Check current profile rows using normalized, indexed identity columns."""
    name_key = normalize_full_name(full_name)
    email_key = normalize_email(email)
    errors = {}
    if name_key:
        result = supabase.table("profiles").select("id").eq("full_name_normalized", name_key).limit(1).execute()
        if result.data:
            errors["full_name"] = FULL_NAME_DUPLICATE_MESSAGE
    if email_key:
        result = supabase.table("profiles").select("id").eq("email_normalized", email_key).limit(1).execute()
        if result.data:
            errors["email"] = EMAIL_DUPLICATE_MESSAGE
    return errors


def unique_constraint_field(error):
    """Map Postgres/PostgREST unique violations to the corresponding form field."""
    detail = str(error).lower()
    if "profiles_email_normalized_key" in detail or "email_normalized" in detail:
        return "email"
    if "profiles_full_name_normalized_key" in detail or "full_name_normalized" in detail:
        return "full_name"
    if "user_id_number" in detail:
        return "id_number"
    return None
