import unittest
import os
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

from config import Config
from services.lecturer_activation import (
    ACTIVATION_LIFETIME,
    create_activation_token,
    hash_activation_token,
    password_policy_error,
)


class LecturerActivationServiceTests(unittest.TestCase):
    def test_activation_token_is_random_and_only_digest_is_storable(self):
        token, digest, expires_at = create_activation_token()
        self.assertGreaterEqual(len(token), 40)
        self.assertEqual(len(digest), 64)
        self.assertNotEqual(token, digest)
        self.assertEqual(hash_activation_token(token), digest)
        self.assertIsNone(hash_activation_token(""))
        self.assertGreater(expires_at, datetime.now(timezone.utc) + ACTIVATION_LIFETIME - timedelta(seconds=2))

    def test_password_policy_requires_eight_characters_letter_and_number(self):
        self.assertIsNotNone(password_policy_error("short1"))
        self.assertIsNotNone(password_policy_error("longpassword"))
        self.assertIsNotNone(password_policy_error("12345678"))
        self.assertIsNone(password_policy_error("Lecturer123"))

    def test_development_link_flag_fails_closed_outside_explicit_local_development(self):
        with patch.dict(os.environ, {"DEV_ACTIVATION_LINKS_ENABLED": "true", "FLASK_ENV": "production"}):
            self.assertFalse(Config.dev_activation_links_enabled())
        with patch.dict(os.environ, {"DEV_ACTIVATION_LINKS_ENABLED": "true", "FLASK_ENV": "development"}), \
             patch.object(Config, "FRONTEND_URL", "https://lecturamind.example"):
            self.assertFalse(Config.dev_activation_links_enabled())
        with patch.dict(os.environ, {"DEV_ACTIVATION_LINKS_ENABLED": "true", "FLASK_ENV": "development"}), \
             patch.object(Config, "FRONTEND_URL", "http://localhost:5173"):
            self.assertTrue(Config.dev_activation_links_enabled())


if __name__ == "__main__":
    unittest.main()
