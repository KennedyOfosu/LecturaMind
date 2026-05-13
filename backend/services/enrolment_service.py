"""
enrolment_service.py — Auto-enrolment based on programme + level matching.
"""

from services.supabase_client import supabase


def auto_enrol_student_by_programme(student_id: str, programme: str, level: int) -> int:
    """
    Auto-enrol a student in all courses whose lecturer_assignments
    match the student's programme and level.

    Returns the number of new enrolments created.
    """
    if not programme or not level:
        return 0

    assignments = supabase.table("lecturer_assignments").select("course_id").eq(
        "programme", programme
    ).eq("level", level).execute()

    if not assignments.data:
        return 0

    created = 0
    for a in assignments.data:
        course_id = a["course_id"]
        existing = supabase.table("enrolments").select("id").eq(
            "student_id", student_id
        ).eq("course_id", course_id).execute()
        if not existing.data:
            try:
                supabase.table("enrolments").insert({
                    "student_id": student_id,
                    "course_id": course_id,
                }).execute()
                created += 1
            except Exception:
                pass
    return created


def backfill_student_enrolments(course_id: str, programme: str, level: int) -> int:
    """
    When a lecturer creates a new assignment, auto-enrol all existing
    students whose programme + level match.
    """
    students = supabase.table("profiles").select("id").eq(
        "role", "student"
    ).eq("programme", programme).eq("level", level).execute()

    if not students.data:
        return 0

    created = 0
    for s in students.data:
        existing = supabase.table("enrolments").select("id").eq(
            "student_id", s["id"]
        ).eq("course_id", course_id).execute()
        if not existing.data:
            try:
                supabase.table("enrolments").insert({
                    "student_id": s["id"],
                    "course_id": course_id,
                }).execute()
                created += 1
            except Exception:
                pass
    return created
