import unittest
from types import SimpleNamespace
from unittest.mock import patch

from flask import Flask

from routes import superadmin


class ClassroomQuery:
    def __init__(self, database, table):
        self.database = database
        self.table_name = table
        self.filters = {}

    def select(self, *_args, **_kwargs):
        return self

    def order(self, *_args, **_kwargs):
        return self

    def eq(self, key, value):
        self.filters[key] = value
        return self

    def execute(self):
        if self.table_name == "classrooms":
            if self.database.transient_failures_remaining:
                self.database.transient_failures_remaining -= 1
                raise OSError("temporary database socket failure")
            return SimpleNamespace(data=[{
                "id": "class-1", "name": "Level 100 Networking", "code": "NET-100",
            }])
        if self.table_name == "lecturer_classrooms":
            if self.database.assignment_table_missing:
                raise RuntimeError("Could not find the table 'public.lecturer_classrooms' in the schema cache (PGRST205)")
            return SimpleNamespace(data=[{"lecturer_id": "lecturer-1", "classroom_id": "class-1"}])
        return SimpleNamespace(count=3, data=[])


class ClassroomDatabase:
    assignment_table_missing = False
    transient_failures_remaining = 0

    def table(self, table_name):
        return ClassroomQuery(self, table_name)


class BrokenClassroomDatabase:
    def table(self, _table_name):
        raise RuntimeError("database unavailable")


class SuperadminClassroomTests(unittest.TestCase):
    def setUp(self):
        self.app = Flask(__name__)
        self.handler = superadmin.list_classrooms.__wrapped__.__wrapped__

    def test_classroom_records_load_with_live_enrollment_and_lecturer_counts(self):
        database = ClassroomDatabase()
        with self.app.test_request_context("/api/admin/classrooms"), patch.object(superadmin, "supabase", database):
            response, status = self.handler()

        self.assertEqual(status, 200)
        self.assertEqual(response.get_json(), [{
            "id": "class-1", "name": "Level 100 Networking", "code": "NET-100",
            "student_count": 3, "lecturer_count": 1, "capacity": 3,
        }])

    def test_classrooms_remain_visible_when_lecturer_assignment_migration_is_missing(self):
        database = ClassroomDatabase()
        database.assignment_table_missing = True
        with self.app.test_request_context("/api/admin/classrooms"), patch.object(superadmin, "supabase", database):
            response, status = self.handler()

        self.assertEqual(status, 200)
        self.assertEqual(len(response.get_json()), 1)
        self.assertEqual(response.get_json()[0]["lecturer_count"], 0)

    def test_transient_database_socket_error_is_retried(self):
        database = ClassroomDatabase()
        database.transient_failures_remaining = 1
        with self.app.test_request_context("/api/admin/classrooms"), patch.object(superadmin, "supabase", database):
            response, status = self.handler()

        self.assertEqual(status, 200)
        self.assertEqual(len(response.get_json()), 1)

    def test_database_failure_returns_error_instead_of_a_false_empty_list(self):
        with self.app.test_request_context("/api/admin/classrooms"), patch.object(superadmin, "supabase", BrokenClassroomDatabase()):
            response, status = self.handler()

        self.assertEqual(status, 503)
        self.assertIn("could not be loaded", response.get_json()["error"].lower())


if __name__ == "__main__":
    unittest.main()
