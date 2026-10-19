import unittest
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from flask import Flask

from routes import auth


class LecturerLoginStatusTests(unittest.TestCase):
    def login_with_status(self, status):
        app = Flask(__name__)
        client = MagicMock()
        client.table.return_value.select.return_value.eq.return_value.execute.return_value = SimpleNamespace(data=[{
            "id": "lecturer-id",
            "full_name": "Taylor Lecturer",
            "email": "taylor@example.edu",
            "role": "lecturer",
            "user_id_number": "LEC-1234",
            "account_status": status,
        }])
        session = SimpleNamespace(access_token="session-token")
        client.auth.sign_in_with_password.return_value = SimpleNamespace(session=session)
        with patch.object(auth, "supabase", client):
            with app.test_request_context("/api/auth/login", method="POST", json={
                "id_number": "LEC-1234",
                "password": "Lecturer123",
            }):
                response, code = auth.login()
        return client, response, code

    def test_pending_lecturer_is_blocked_before_supabase_sign_in(self):
        client, response, code = self.login_with_status("pending_activation")
        self.assertEqual(code, 403)
        self.assertIn("waiting for password activation", response.get_json()["error"])
        client.auth.sign_in_with_password.assert_not_called()

    def test_deactivated_lecturer_is_blocked_before_supabase_sign_in(self):
        client, response, code = self.login_with_status("deactivated")
        self.assertEqual(code, 403)
        self.assertIn("deactivated", response.get_json()["error"])
        client.auth.sign_in_with_password.assert_not_called()

    def test_active_lecturer_signs_in_with_existing_id_login_flow(self):
        client, response, code = self.login_with_status("active")
        self.assertEqual(code, 200)
        self.assertEqual(response.get_json()["token"], "session-token")
        client.auth.sign_in_with_password.assert_called_once_with({
            "email": "taylor@example.edu",
            "password": "Lecturer123",
        })


if __name__ == "__main__":
    unittest.main()
