"""
attendance_service.py — Attendance oversight, flagging, and alerting.
When a lecturer marks a student absent, this service flags the record
and prepares alert data for notification.
"""

from datetime import date, datetime
from services.supabase_client import supabase


def record_attendance(student_id: str, course_id: str, lecturer_id: str,
                      status: str, date_val: date = None,
                      slot_id: str = None) -> dict:
    """Record a single attendance entry. If absent, auto-flag."""
    date_val = date_val or date.today()

    existing = supabase.table("attendance_records").select("id").eq(
        "student_id", student_id
    ).eq("course_id", course_id).eq("date", date_val.isoformat()).execute()

    is_absent = status in ("absent", "late")
    payload = {
        "student_id": student_id,
        "course_id": course_id,
        "lecturer_id": lecturer_id,
        "date": date_val.isoformat(),
        "status": status,
        "is_flagged": is_absent,
        "flag_reason": f"Marked as {status}" if is_absent else None,
        "slot_id": slot_id,
    }

    if existing.data:
        supabase.table("attendance_records").update(payload).eq("id", existing.data[0]["id"]).execute()
        record_id = existing.data[0]["id"]
    else:
        res = supabase.table("attendance_records").insert(payload).execute()
        record_id = res.data[0]["id"] if res.data else None

    result = {"record_id": record_id, "is_flagged": is_absent}
    if is_absent:
        student = supabase.table("profiles").select("full_name, user_id_number").eq("id", student_id).execute()
        course = supabase.table("courses").select("course_name, course_code").eq("id", course_id).execute()
        result["alert"] = {
            "type": "attendance_alert",
            "student_name": student.data[0]["full_name"] if student.data else "Unknown",
            "student_id_number": student.data[0]["user_id_number"] if student.data else "",
            "course_name": course.data[0]["course_name"] if course.data else "Unknown",
            "course_code": course.data[0]["course_code"] if course.data else "",
            "date": date_val.isoformat(),
            "status": status,
            "timestamp": datetime.utcnow().isoformat(),
        }
    return result


def bulk_record_attendance(records: list) -> list:
    """Record multiple attendance entries at once."""
    results = []
    for r in records:
        results.append(record_attendance(
            student_id=r["student_id"],
            course_id=r["course_id"],
            lecturer_id=r.get("lecturer_id"),
            status=r["status"],
            date_val=datetime.strptime(r["date"], "%Y-%m-%d").date() if isinstance(r.get("date"), str) else r.get("date"),
            slot_id=r.get("slot_id"),
        ))
    return results


def get_attendance_summary(course_id: str = None, student_id: str = None,
                           start_date: str = None, end_date: str = None) -> dict:
    """Get attendance statistics with filtering."""
    query = supabase.table("attendance_records").select(
        "*, profiles!attendance_records_student_id_fkey(full_name, user_id_number), "
        "courses!attendance_records_course_id_fkey(course_name, course_code)"
    )

    if course_id:
        query = query.eq("course_id", course_id)
    if student_id:
        query = query.eq("student_id", student_id)
    if start_date:
        query = query.gte("date", start_date)
    if end_date:
        query = query.lte("date", end_date)

    res = query.order("date", desc=True).execute()
    records = res.data or []

    total = len(records)
    present = sum(1 for r in records if r["status"] == "present")
    absent = sum(1 for r in records if r["status"] == "absent")
    late = sum(1 for r in records if r["status"] == "late")
    excused = sum(1 for r in records if r["status"] == "excused")

    return {
        "records": records,
        "summary": {
            "total": total,
            "present": present,
            "absent": absent,
            "late": late,
            "excused": excused,
            "attendance_rate": round((present / total * 100), 1) if total else 0,
        },
    }


def get_flagged_attendance() -> list:
    """Get all flagged attendance records for admin oversight."""
    res = supabase.table("attendance_records").select(
        "*, profiles!attendance_records_student_id_fkey(full_name, user_id_number), "
        "courses!attendance_records_course_id_fkey(course_name, course_code)"
    ).eq("is_flagged", True).order("date", desc=True).limit(100).execute()
    return res.data or []
