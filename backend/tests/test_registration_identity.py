import unittest
from types import SimpleNamespace
from unittest.mock import MagicMock

from services.registration_identity import (
    EMAIL_DUPLICATE_MESSAGE,
    FULL_NAME_DUPLICATE_MESSAGE,
    duplicate_identity_errors,
    normalize_email,
    normalize_full_name,
    unique_constraint_field,
)


class RegistrationIdentityTests(unittest.TestCase):
    def test_full_name_normalization_trims_collapses_and_casefolds(self):
        self.assertEqual(normalize_full_name("  Ada   LOVELACE\t Byron "), "ada lovelace byron")

    def test_email_normalization_trims_and_casefolds(self):
        self.assertEqual(normalize_email("  ADA@Example.COM "), "ada@example.com")

    def test_duplicate_lookup_checks_both_normalized_columns(self):
        supabase = MagicMock()
        supabase.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.side_effect = [
            SimpleNamespace(data=[{"id": "name-match"}]),
            SimpleNamespace(data=[]),
        ]

        self.assertEqual(
            duplicate_identity_errors(supabase, " Ada   Lovelace ", "ADA@example.com "),
            {"full_name": FULL_NAME_DUPLICATE_MESSAGE},
        )
        calls = supabase.table.return_value.select.return_value.eq.call_args_list
        self.assertEqual(calls[0].args, ("full_name_normalized", "ada lovelace"))
        self.assertEqual(calls[1].args, ("email_normalized", "ada@example.com"))

    def test_unique_constraint_names_map_back_to_fields(self):
        self.assertEqual(unique_constraint_field('duplicate key violates "profiles_email_normalized_key"'), "email")
        self.assertEqual(unique_constraint_field('duplicate key violates "profiles_full_name_normalized_key"'), "full_name")
        self.assertEqual(unique_constraint_field('duplicate key violates "profiles_user_id_number_key"'), "id_number")
        self.assertIsNone(unique_constraint_field("connection timeout"))


if __name__ == "__main__":
    unittest.main()
