import unittest
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from flask import Flask

from routes import superadmin


class AccountIdGenerationTests(unittest.TestCase):
    def setUp(self):
        self.app = Flask(__name__)
        self.handler = superadmin.generate_account_id.__wrapped__.__wrapped__

    def test_generation_returns_the_database_reservation(self):
        client = MagicMock()
        client.rpc.return_value.execute.return_value = SimpleNamespace(data={
            "user_id_number": "LEC-5002",
            "reservation_token": "reservation-token",
            "expires_at": "2026-10-19T12:30:00+00:00",
        })
        with self.app.test_request_context("/api/admin/generate-account-id", method="POST", json={"role": "lecturer"}), patch.object(superadmin, "supabase", client):
            response, status = self.handler()

        self.assertEqual(status, 200)
        self.assertEqual(response.get_json()["user_id_number"], "LEC-5002")
        client.rpc.assert_called_once_with("generate_account_id_reservation", {"p_role": "lecturer"})

    def test_unsupported_role_is_rejected(self):
        client = MagicMock()
        with self.app.test_request_context("/api/admin/generate-account-id", method="POST", json={"role": "superadmin"}), patch.object(superadmin, "supabase", client):
            response, status = self.handler()

        self.assertEqual(status, 400)
        client.rpc.assert_not_called()

    def test_exhausted_id_sequence_returns_clear_error(self):
        client = MagicMock()
        client.rpc.return_value.execute.side_effect = RuntimeError("ID_EXHAUSTED:student")
        with self.app.test_request_context("/api/admin/generate-account-id", method="POST", json={"role": "student"}), patch.object(superadmin, "supabase", client):
            response, status = self.handler()

        self.assertEqual(status, 409)
        self.assertIn("STU-9999", response.get_json()["error"])

    def test_invalid_id_is_rejected_without_looking_up_a_reservation(self):
        client = MagicMock()
        with self.app.test_request_context("/api/admin/register-student", method="POST", json={
            "id_number": "LEC-5002", "id_reservation_token": "reservation-token",
        }), patch.object(superadmin, "supabase", client):
            _id, _token, error = superadmin._check_id_reservation("student", {
                "id_number": "LEC-5002", "id_reservation_token": "reservation-token",
            })

        self.assertIsNotNone(error)
        self.assertEqual(error[1], 400)
        client.table.assert_not_called()

    def test_id_must_match_an_unexpired_role_specific_reservation(self):
        client = MagicMock()
        client.table.return_value.select.return_value.eq.return_value.eq.return_value.eq.return_value.gt.return_value.limit.return_value.execute.return_value = SimpleNamespace(data=[])
        with self.app.test_request_context("/api/admin/register-student", method="POST", json={} ), patch.object(superadmin, "supabase", client):
            _id, _token, error = superadmin._check_id_reservation("student", {
                "id_number": "STU-5002", "id_reservation_token": "expired-token",
            })

        self.assertIsNotNone(error)
        self.assertEqual(error[1], 409)

    def test_student_creation_consumes_reserved_id_in_database_rpc(self):
        client = MagicMock()
        client.rpc.return_value.execute.return_value = SimpleNamespace(data={"id": "student-user-id"})
        with self.app.test_request_context("/api/admin/register-student", method="POST", json={
            "full_name": "New Student",
            "email": "new.student@example.edu",
            "password": "Student123",
            "id_number": "STU-5002",
            "id_reservation_token": "reservation-token",
            "programme": "",
            "level": "",
            "classroom_id": "",
        }), patch.object(superadmin, "supabase", client), patch.object(
            superadmin, "_check_id_reservation", return_value=("STU-5002", "reservation-token", None)
        ), patch("services.registration_identity.duplicate_identity_errors", return_value={}), patch(
            "routes.auth._create_auth_user", return_value="student-user-id"
        ):
            response, status = superadmin._admin_create_user("student")

        self.assertEqual(status, 201)
        self.assertEqual(response.get_json()["user_id"], "student-user-id")
        client.rpc.assert_called_once_with("create_student_profile_with_id_reservation", {
            "p_user_id": "student-user-id",
            "p_full_name": "New Student",
            "p_email": "new.student@example.edu",
            "p_user_id_number": "STU-5002",
            "p_reservation_token": "reservation-token",
            "p_programme": "",
            "p_level": None,
            "p_academic_year": None,
            "p_classroom_id": None,
            "p_section": "",
        })
        client.table.return_value.insert.assert_not_called()

    def test_lecturer_creation_passes_reserved_id_to_atomic_profile_assignment_rpc(self):
        client = MagicMock()
        client.table.return_value.select.return_value.in_.return_value.execute.return_value = SimpleNamespace(data=[{"id": "class-1"}])
        client.rpc.return_value.execute.return_value = SimpleNamespace(data={
            "id": "lecturer-user-id", "user_id_number": "LEC-5002", "role": "lecturer",
        })
        auth_response = MagicMock(status_code=201)
        auth_response.json.return_value = {"id": "lecturer-user-id"}
        with self.app.test_request_context("/api/admin/register-lecturer", method="POST", json={
            "full_name": "New Lecturer",
            "email": "new.lecturer@example.edu",
            "id_number": "LEC-5002",
            "id_reservation_token": "reservation-token",
            "classroom_ids": ["class-1"],
        }), patch.object(superadmin, "supabase", client), patch.object(
            superadmin, "_check_id_reservation", return_value=("LEC-5002", "reservation-token", None)
        ), patch.object(superadmin, "duplicate_identity_errors", return_value={}), patch.object(
            superadmin.Config, "dev_activation_links_enabled", return_value=True
        ), patch.object(superadmin.http_requests, "post", return_value=auth_response):
            response, status = superadmin._admin_create_pending_lecturer()

        self.assertEqual(status, 201)
        self.assertEqual(response.get_json()["user"]["user_id_number"], "LEC-5002")
        client.rpc.assert_called_once_with("create_pending_lecturer_profile", {
            "p_user_id": "lecturer-user-id",
            "p_full_name": "New Lecturer",
            "p_email": "new.lecturer@example.edu",
            "p_staff_id": "LEC-5002",
            "p_reservation_token": "reservation-token",
            "p_classroom_ids": ["class-1"],
        })


if __name__ == "__main__":
    unittest.main()
