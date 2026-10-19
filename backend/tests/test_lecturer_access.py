import unittest
from types import SimpleNamespace

from services.lecturer_access import lecturer_can_manage_course_student


class FakeSupabase:
    def __init__(self, classroom_id="class-a", assigned_classes=None, course_owner="lecturer-a", enrolled=True):
        self.classroom_id = classroom_id
        self.assigned_classes = set(assigned_classes or {"class-a"})
        self.course_owner = course_owner
        self.enrolled = enrolled

    def table(self, table_name):
        return FakeQuery(self, table_name)


class FakeQuery:
    def __init__(self, database, table_name):
        self.database = database
        self.table_name = table_name
        self.filters = {}
        self.in_filters = {}

    def select(self, *_args, **_kwargs):
        return self

    def eq(self, field, value):
        self.filters[field] = value
        return self

    def in_(self, field, values):
        self.in_filters[field] = set(values)
        return self

    def limit(self, *_args):
        return self

    def execute(self):
        if self.table_name == "courses":
            rows = [{"id": "course-a"}] if self.database.course_owner == self.filters.get("lecturer_id") else []
        elif self.table_name == "profiles":
            profile = {"id": "student-a", "role": "student", "classroom_id": self.database.classroom_id}
            rows = [profile] if not self.in_filters.get("id") or profile["id"] in self.in_filters["id"] else []
        elif self.table_name == "lecturer_classrooms":
            rows = [
                {"classroom_id": classroom_id}
                for classroom_id in self.database.assigned_classes
            ] if self.filters.get("lecturer_id") == "lecturer-a" else []
        elif self.table_name == "enrolments":
            student_ids = self.in_filters.get("student_id", {"student-a"})
            course_ids = self.in_filters.get("course_id", {"course-a"})
            rows = [{"student_id": "student-a", "id": "enrolment-a"}] if (
                self.database.enrolled and "student-a" in student_ids and "course-a" in course_ids
            ) else []
        else:
            rows = []
        return SimpleNamespace(data=rows)


class LecturerAccessTests(unittest.TestCase):
    def test_lecturer_can_manage_enrolled_student_in_assigned_class_and_owned_course(self):
        self.assertTrue(lecturer_can_manage_course_student(
            FakeSupabase(), "lecturer-a", "student-a", "course-a"
        ))

    def test_lecturer_cannot_manage_student_outside_assigned_class(self):
        database = FakeSupabase(classroom_id="class-b", assigned_classes={"class-a"})
        self.assertFalse(lecturer_can_manage_course_student(
            database, "lecturer-a", "student-a", "course-a"
        ))

    def test_lecturer_cannot_manage_student_from_another_lecturers_course(self):
        database = FakeSupabase(course_owner="lecturer-b")
        self.assertFalse(lecturer_can_manage_course_student(
            database, "lecturer-a", "student-a", "course-a"
        ))

    def test_lecturer_cannot_manage_student_not_enrolled_in_course(self):
        database = FakeSupabase(enrolled=False)
        self.assertFalse(lecturer_can_manage_course_student(
            database, "lecturer-a", "student-a", "course-a"
        ))


if __name__ == "__main__":
    unittest.main()
