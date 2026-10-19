import unittest
from types import SimpleNamespace
from unittest.mock import patch

from flask import Flask

from routes import superadmin


class DashboardDatabase:
    def __init__(self):
        self.rows = {
            "profiles": [
                {"id": "s1", "role": "student", "classroom_id": "c1", "created_at": "2026-10-01", "account_status": "active"},
                {"id": "s2", "role": "student", "classroom_id": None, "created_at": "2026-10-02", "account_status": "active"},
                {"id": "l1", "role": "lecturer", "classroom_id": None, "created_at": "2026-10-03", "account_status": "active"},
                {"id": "l2", "role": "lecturer", "classroom_id": None, "created_at": "2026-10-04", "account_status": "pending_activation"},
                {"id": "l3", "role": "lecturer", "classroom_id": None, "created_at": "2026-10-05", "account_status": "deactivated"},
            ],
            "classrooms": [
                {"id": "c1", "name": "North Hall", "code": "NH-1", "building": "North"},
                {"id": "c2", "name": "South Hall", "code": "SH-1", "building": "South"},
            ],
            "lecturer_classrooms": [
                {"lecturer_id": "l1", "classroom_id": "c1", "assigned_at": "2026-10-05T10:00:00Z"},
                {"lecturer_id": "l2", "classroom_id": "c2", "assigned_at": "2026-10-05T11:00:00Z"},
            ],
            "courses": [{"id": f"course-{index}"} for index in range(4)],
            "enrolments": [{"id": f"enrolment-{index}"} for index in range(8)],
            "academic_years": [{"id": "year-1", "name": "2026/2027", "is_active": True}],
            "semesters": [{"name": "Semester 1", "academic_year_id": "year-1", "is_active": True}],
            "school_activity_log": [{
                "id": "event-1",
                "event_type": "account_created",
                "details": {"role": "student", "status": "active"},
                "occurred_at": "2026-10-06T10:00:00Z",
            }],
        }

    def table(self, table_name):
        return DashboardQuery(self.rows.get(table_name, []))


class DashboardQuery:
    def __init__(self, rows):
        self.rows = rows
        self.filters = {}
        self.start = 0
        self.end = None
        self.limit_value = None

    def select(self, *_args, **_kwargs):
        return self

    def eq(self, field, value):
        self.filters[field] = value
        return self

    def range(self, start, end):
        self.start = start
        self.end = end + 1
        return self

    def limit(self, value):
        self.limit_value = value
        return self

    def order(self, *_args, **_kwargs):
        return self

    def execute(self):
        rows = [row for row in self.rows if all(row.get(key) == value for key, value in self.filters.items())]
        if self.end is not None:
            rows = rows[self.start:self.end]
        if self.limit_value is not None:
            rows = rows[:self.limit_value]
        return SimpleNamespace(data=rows, count=len(rows))


class SuperadminDashboardTests(unittest.TestCase):
    def test_aggregates_unique_profiles_and_class_coverage_without_returning_private_profiles(self):
        app = Flask(__name__)
        handler = superadmin.admin_dashboard.__wrapped__.__wrapped__
        with app.test_request_context("/api/admin/dashboard"), patch.object(superadmin, "supabase", DashboardDatabase()):
            response, status_code = handler()

        payload = response.get_json()
        self.assertEqual(status_code, 200)
        self.assertEqual(payload["total_students"], 2)
        self.assertEqual(payload["total_lecturers"], 3)
        self.assertEqual(payload["total_classrooms"], 2)
        self.assertEqual(payload["total_courses"], 4)
        self.assertEqual(payload["total_course_enrolments"], 8)
        self.assertEqual(payload["attention_count"], 4)
        self.assertEqual(payload["coverage"]["lecturers_assigned"], 1)
        self.assertEqual(payload["class_distribution"][0]["students"], 1)
        self.assertEqual(payload["class_distribution"][0]["lecturers"], 1)
        self.assertEqual(payload["academic_period"], "2026/2027 · Semester 1")
        self.assertEqual(payload["recent_activity"][0]["title"], "Account created")
        self.assertNotIn("email", payload)
        self.assertNotIn("full_name", payload)
        self.assertNotIn("profiles", payload)


if __name__ == "__main__":
    unittest.main()
