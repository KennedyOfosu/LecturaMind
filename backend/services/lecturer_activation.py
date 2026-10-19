"""Secure one-time activation token helpers for lecturer onboarding."""

import hashlib
import secrets
from datetime import datetime, timedelta, timezone


ACTIVATION_LIFETIME = timedelta(hours=24)


def create_activation_token():
    """Return a high-entropy URL token, its SHA-256 digest, and UTC expiry."""
    token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
    expires_at = datetime.now(timezone.utc) + ACTIVATION_LIFETIME
    return token, token_hash, expires_at


def hash_activation_token(token):
    if not isinstance(token, str) or not token:
        return None
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def password_policy_error(password):
    if not isinstance(password, str) or len(password) < 8:
        return "Password must be at least 8 characters."
    if not any(char.isalpha() for char in password) or not any(char.isdigit() for char in password):
        return "Password must contain at least one letter and one number."
    return None
