import unittest
from types import SimpleNamespace
from unittest.mock import patch

from flask import Flask

from routes import courses


class CourseDatabase:
    def __init__(self, rows):
        self.rows = rows

    def table(self, name):
        return CourseQuery(self.rows.get(name, []))


class CourseQuery:
    def __init__(self, rows):
        self.rows = rows
        self.filters = {}

    def select(self, *_args, **_kwargs):
        return self

    def eq(self, field, value):
        self.filters[field] = value
        return self

    def limit(self, _count):
        return self

    def execute(self):
        rows = [row for row in self.rows if all(row.get(key) == value for key, value in self.filters.items())]
        return SimpleNamespace(data=rows)


class CourseAccessTests(unittest.TestCase):
    def setUp(self):
        self.app = Flask(__name__)
        self.handler = courses.get_course.__wrapped__

    def invoke(self, role, rows, user_id="user-1"):
        with self.app.test_request_context("/api/courses/course-1"):
            from flask import g
            g.user_role = role
            g.user_id = user_id
            with patch.object(courses, "supabase", CourseDatabase(rows)):
                return self.handler("course-1")

    def test_student_can_read_an_enrolled_course(self):
        response, status = self.invoke("student", {
            "enrolments": [{"id": "enrol-1", "student_id": "user-1", "course_id": "course-1"}],
            "courses": [{"id": "course-1", "course_name": "Networks", "profiles": {"full_name": "Lecturer"}}],
        })
        self.assertEqual(status, 200)
        self.assertEqual(response.get_json()["course_name"], "Networks")

    def test_student_cannot_read_an_unenrolled_course(self):
        response, status = self.invoke("student", {
            "enrolments": [],
            "courses": [{"id": "course-1", "course_name": "Private course"}],
        })
        self.assertEqual(status, 404)
        self.assertIn("error", response.get_json())

    def test_lecturer_cannot_read_another_lecturers_course(self):
        response, status = self.invoke("lecturer", {
            "courses": [{"id": "course-1", "lecturer_id": "someone-else"}],
        })
        self.assertEqual(status, 404)

    def test_lecturer_can_read_an_assigned_course(self):
        response, status = self.invoke("lecturer", {
            "courses": [{
                "id": "course-1",
                "lecturer_id": "user-1",
                "course_name": "Networks",
                "profiles": {"full_name": "Lecturer"},
            }],
        })
        self.assertEqual(status, 200)
        self.assertEqual(response.get_json()["course_name"], "Networks")

    def test_superadmin_can_read_course_details(self):
        response, status = self.invoke("superadmin", {
            "courses": [{"id": "course-1", "course_name": "Networks", "profiles": {}}],
        })
        self.assertEqual(status, 200)


if __name__ == "__main__":
    unittest.main()
