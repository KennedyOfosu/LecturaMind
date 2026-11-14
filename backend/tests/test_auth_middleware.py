import unittest
from types import SimpleNamespace
from unittest.mock import patch

import httpx
from flask import Flask

from middleware import auth_middleware


class AuthMiddlewareFailureTests(unittest.TestCase):
    def setUp(self):
        self.app = Flask(__name__)

    def test_temporary_supabase_outage_returns_503(self):
        client = SimpleNamespace(auth=SimpleNamespace(
            get_user=unittest.mock.Mock(side_effect=httpx.ConnectError("offline")),
        ))

        @auth_middleware.require_auth
        def endpoint():
            return "ok", 200

        with self.app.test_request_context("/private", headers={"Authorization": "Bearer token"}), \
             patch.object(auth_middleware, "supabase", client), \
             patch.object(auth_middleware.time, "sleep"):
            response, status = endpoint()

        self.assertEqual(status, 503)
        self.assertIn("temporarily unavailable", response.get_json()["error"])

    def test_rejected_token_returns_401(self):
        rejected_token = RuntimeError("Invalid JWT")
        rejected_token.status = 401
        client = SimpleNamespace(auth=SimpleNamespace(
            get_user=unittest.mock.Mock(side_effect=rejected_token),
        ))

        @auth_middleware.require_auth
        def endpoint():
            return "ok", 200

        with self.app.test_request_context("/private", headers={"Authorization": "Bearer token"}), \
             patch.object(auth_middleware, "supabase", client):
            response, status = endpoint()

        self.assertEqual(status, 401)
        self.assertIn("Invalid or expired", response.get_json()["error"])


if __name__ == "__main__":
    unittest.main()
