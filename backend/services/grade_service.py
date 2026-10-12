"""
grade_service.py — Grade consolidation, GPA computation, and report card generation.
Report Card = Sum(Course Marks) + Attendance Yield.
"""

from decimal import Decimal
from datetime import datetime
from services.supabase_client import supabase


def get_active_grading_scale() -> list:
    """Fetch active grading scale for the current academic year."""
    active_year = supabase.table("academic_years").select("id").eq("is_active", True).execute()
    if not active_year.data:
        return []
    res = supabase.table("grading_scales").select("*").eq(
        "academic_year_id", active_year.data[0]["id"]
    ).eq("is_active", True).order("min_score").execute()
    return res.data or []


def score_to_grade(score: float, grading_scales: list) -> dict:
    """Map a numerical score to a grade letter and grade point."""
    for g in grading_scales:
        if g["min_score"] <= score <= g["max_score"]:
            return {"grade_letter": g["grade_letter"], "grade_point": g["grade_point"]}
    return {"grade_letter": "F", "grade_point": 0.0}


def compute_cumulative_score(student_id: str, course_ids: list,
                             semester_id: str, academic_year_id: str) -> dict:
    """
    Compute cumulative weighted grade for a student across courses.
    Formula: Sum(Course Marks) + Attendance Yield.
    """
    grading_scales = get_active_grading_scale()
    if not grading_scales:
        grading_scales = [
            {"min_score": 80, "max_score": 100, "grade_letter": "A", "grade_point": 4.0},
            {"min_score": 70, "max_score": 79.99, "grade_letter": "B+", "grade_point": 3.5},
            {"min_score": 60, "max_score": 69.99, "grade_letter": "B", "grade_point": 3.0},
            {"min_score": 50, "max_score": 59.99, "grade_letter": "C+", "grade_point": 2.5},
            {"min_score": 40, "max_score": 49.99, "grade_letter": "C", "grade_point": 2.0},
            {"min_score": 30, "max_score": 39.99, "grade_letter": "D", "grade_point": 1.0},
            {"min_score": 0, "max_score": 29.99, "grade_letter": "F", "grade_point": 0.0},
        ]

    course_results = []
    total_marks_obtained = Decimal("0")
    total_max_marks = Decimal("0")

    for course_id in course_ids:
        course = supabase.table("courses").select("course_name, course_code").eq("id", course_id).execute()
        course_name = course.data[0]["course_name"] if course.data else "Unknown"
        course_code = course.data[0]["course_code"] if course.data else ""

        marks_res = supabase.table("student_marks").select(
            "score, max_score"
        ).eq("student_id", student_id).eq("course_id", course_id).execute()
        marks = marks_res.data or []

        obtained = sum(Decimal(str(m["score"])) for m in marks if m.get("score"))
        max_marks = sum(Decimal(str(m["max_score"])) for m in marks if m.get("max_score"))
        if max_marks == 0:
            max_marks = Decimal("1")

        percentage = float(obtained / max_marks * 100) if max_marks > 0 else 0
        grade = score_to_grade(percentage, grading_scales)

        course_results.append({
            "course_id": course_id,
            "course_name": course_name,
            "course_code": course_code,
            "marks_obtained": float(obtained),
            "max_marks": float(max_marks),
            "percentage": round(percentage, 1),
            "grade_letter": grade["grade_letter"],
            "grade_point": grade["grade_point"],
        })
        total_marks_obtained += obtained
        total_max_marks += max_marks

    # Attendance Yield
    att_res = supabase.table("attendance_records").select("status").eq("student_id", student_id).execute()
    att_records = att_res.data or []
    total_classes = len(att_records)
    attended = sum(1 for r in att_records if r["status"] in ("present", "excused"))
    attendance_yield = round((attended / total_classes * 5) if total_classes > 0 else 0, 1)

    cumulative_percentage = float(total_marks_obtained / total_max_marks * 100) if total_max_marks > 0 else 0
    cumulative_with_yield = cumulative_percentage + attendance_yield
    final_capped = min(cumulative_with_yield, 100)
    final_grade = score_to_grade(final_capped, grading_scales)

    return {
        "student_id": student_id,
        "semester_id": semester_id,
        "academic_year_id": academic_year_id,
        "courses": course_results,
        "total_marks_obtained": float(total_marks_obtained),
        "total_max_marks": float(total_max_marks),
        "attendance_yield": attendance_yield,
        "cumulative_score": round(final_capped, 1),
        "grade_letter": final_grade["grade_letter"],
        "grade_point": final_grade["grade_point"],
    }


def generate_report_card(student_id: str, semester_id: str,
                         academic_year_id: str) -> dict:
    """Generate or regenerate a report card for a student."""
    course_ids_res = supabase.table("enrolments").select("course_id").eq(
        "student_id", student_id
    ).execute()
    course_ids = [c["course_id"] for c in course_ids_res.data or []]

    result = compute_cumulative_score(student_id, course_ids, semester_id, academic_year_id)

    existing = supabase.table("report_cards").select("id").eq(
        "student_id", student_id
    ).eq("semester_id", semester_id).eq("academic_year_id", academic_year_id).execute()

    rc_payload = {
        "student_id": student_id,
        "semester_id": semester_id,
        "academic_year_id": academic_year_id,
        "total_marks_obtained": result["total_marks_obtained"],
        "total_max_marks": result["total_max_marks"],
        "attendance_yield": result["attendance_yield"],
        "cumulative_score": result["cumulative_score"],
        "grade_letter": result["grade_letter"],
        "grade_point": result["grade_point"],
    }

    if existing.data:
        supabase.table("report_cards").update(rc_payload).eq("id", existing.data[0]["id"]).execute()
        rc_id = existing.data[0]["id"]
    else:
        rc_res = supabase.table("report_cards").insert(rc_payload).execute()
        rc_id = rc_res.data[0]["id"] if rc_res.data else None

    if rc_id:
        for course in result["courses"]:
            existing_course = supabase.table("report_card_courses").select("id").eq(
                "report_card_id", rc_id
            ).eq("course_id", course["course_id"]).execute()
            course_payload = {
                "report_card_id": rc_id,
                "course_id": course["course_id"],
                "course_name": course["course_name"],
                "course_code": course["course_code"],
                "marks_obtained": course["marks_obtained"],
                "max_marks": course["max_marks"],
                "grade_letter": course["grade_letter"],
                "grade_point": course["grade_point"],
            }
            if existing_course.data:
                supabase.table("report_card_courses").update(course_payload).eq("id", existing_course.data[0]["id"]).execute()
            else:
                supabase.table("report_card_courses").insert(course_payload).execute()

    result["report_card_id"] = rc_id
    return result


def generate_bulk_report_cards(semester_id: str, academic_year_id: str,
                               programme: str = None, level: int = None) -> dict:
    """Generate report cards for all matching students."""
    query = supabase.table("profiles").select("id, full_name, user_id_number").eq("role", "student")
    if programme:
        query = query.eq("programme", programme)
    if level:
        query = query.eq("level", level)
    students = query.execute().data or []

    results = []
    for s in students:
        try:
            rc = generate_report_card(s["id"], semester_id, academic_year_id)
            results.append({"student_id": s["id"], "student_name": s["full_name"], "status": "generated"})
        except Exception as e:
            results.append({"student_id": s["id"], "student_name": s["full_name"], "status": f"failed: {e}"})

    return {"total": len(results), "results": results}


def finalize_report_card(rc_id: str) -> dict:
    """Finalize a report card, making it read-only for student view."""
    supabase.table("report_cards").update({
        "is_finalized": True,
        "finalized_at": datetime.utcnow().isoformat(),
    }).eq("id", rc_id).execute()
    return {"message": "Report card finalized", "report_card_id": rc_id}
