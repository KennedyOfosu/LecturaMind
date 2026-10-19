"""Database-backed classroom and course scope checks for lecturers."""


def lecturer_classroom_ids(supabase, lecturer_id):
    result = supabase.table("lecturer_classrooms").select("classroom_id").eq(
        "lecturer_id", lecturer_id
    ).execute()
    return {row["classroom_id"] for row in (result.data or [])}


def lecturer_can_manage_student(supabase, lecturer_id, student_id):
    student_result = supabase.table("profiles").select(
        "id, role, classroom_id"
    ).eq("id", student_id).limit(1).execute()
    if not student_result.data:
        return False
    student = student_result.data[0]
    if student.get("role") != "student":
        return False
    classroom_ids = lecturer_classroom_ids(supabase, lecturer_id)
    if classroom_ids:
        return student.get("classroom_id") in classroom_ids

    # Legacy lecturers without classroom assignments retain access only to
    # students already enrolled in a course they own.
    return bool(lecturer_managed_student_ids(supabase, lecturer_id, [student_id]))


def lecturer_managed_student_ids(supabase, lecturer_id, student_ids):
    """Filter by assigned classes, with a safe fallback for legacy accounts.

    Lecturers with explicit class assignments are limited to those classes.
    Older lecturer accounts without class assignments keep their existing
    enrolled rosters in courses they own until an administrator assigns classes.
    """
    requested_ids = list(set(student_ids or []))
    if not requested_ids:
        return set()
    classroom_ids = lecturer_classroom_ids(supabase, lecturer_id)
    profiles = supabase.table("profiles").select("id, role, classroom_id").in_(
        "id", requested_ids
    ).execute()
    students = [
        profile for profile in (profiles.data or [])
        if profile.get("role") == "student"
    ]

    if classroom_ids:
        return {
            profile["id"] for profile in students
            if profile.get("classroom_id") in classroom_ids
        }

    course_result = supabase.table("courses").select("id").eq(
        "lecturer_id", lecturer_id
    ).execute()
    course_ids = [row["id"] for row in (course_result.data or []) if row.get("id")]
    if not course_ids or not students:
        return set()
    enrolments = supabase.table("enrolments").select("student_id").in_(
        "course_id", course_ids
    ).in_("student_id", [student["id"] for student in students]).execute()
    return {
        row["student_id"] for row in (enrolments.data or [])
        if row.get("student_id")
    }


def lecturer_owns_course(supabase, lecturer_id, course_id):
    result = supabase.table("courses").select("id").eq(
        "id", course_id
    ).eq("lecturer_id", lecturer_id).limit(1).execute()
    return bool(result.data)


def lecturer_can_manage_course_student(supabase, lecturer_id, student_id, course_id):
    if not lecturer_owns_course(supabase, lecturer_id, course_id):
        return False
    if not lecturer_can_manage_student(supabase, lecturer_id, student_id):
        return False
    enrolment = supabase.table("enrolments").select("id").eq(
        "student_id", student_id
    ).eq("course_id", course_id).limit(1).execute()
    return bool(enrolment.data)
