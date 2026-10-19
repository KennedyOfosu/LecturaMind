"""Recurring class scheduling for lecturer/course assignments."""

from datetime import time

from services.supabase_client import supabase


WEEKDAY_DAYS = (1, 3, 5)  # Monday, Wednesday, Friday
WEEKEND_DAYS = (6, 0)     # Saturday, Sunday


def _minutes(value):
    if isinstance(value, time):
        return value.hour * 60 + value.minute
    parts = str(value or "").split(":")
    return int(parts[0]) * 60 + int(parts[1]) if len(parts) >= 2 else 0


def _session_type_for_lecturer(lecturer_id):
    assignments = supabase.table("lecturer_assignments").select("programme").eq(
        "lecturer_id", lecturer_id
    ).execute().data or []
    programme_counts = {}
    for assignment in assignments:
        programme = assignment.get("programme")
        if programme:
            programme_counts[programme] = programme_counts.get(programme, 0) + 1
    if programme_counts:
        primary_programme = sorted(programme_counts, key=lambda value: (-programme_counts[value], value))[0]
        return "weekday" if primary_programme == "BSc Information Technology" else "weekend"

    profile = supabase.table("profiles").select("programme, department").eq("id", lecturer_id).limit(1).execute().data or []
    profile = profile[0] if profile else {}
    if profile.get("programme") == "BSc Information Technology" or "information technology" in (profile.get("department") or "").lower():
        return "weekday"
    return "weekend"


def create_course_schedule_for_assignment(assignment):
    """Place one weekly one-hour meeting in an open 08:00-14:00 slot.

    Existing meetings for the lecturer and classroom are checked within the
    same academic year and semester. The lecturer's weekday/weekend track is
    stable and uses the programme-to-session rule from migration 009.
    """
    try:
        assignment_id = assignment["id"]
        existing = supabase.table("course_schedules").select("id").eq(
            "assignment_id", assignment_id
        ).execute()
        if existing.data:
            return existing.data[0]

        programme = assignment.get("programme")
        level = int(assignment.get("level") or 0)
        if not programme or level not in (100, 200, 300, 400):
            return None

        groups = supabase.table("classrooms").select("id, room_id").eq(
            "programme", programme
        ).eq("level", level).order("created_at").execute().data or []
        assigned = supabase.table("lecturer_classrooms").select(
            "classrooms!lecturer_classrooms_classroom_id_fkey(id, room_id, programme, level)"
        ).eq("lecturer_id", assignment["lecturer_id"]).execute().data or []
        assigned_groups = [
            row.get("classrooms") for row in assigned
            if row.get("classrooms")
            and row["classrooms"].get("programme") == programme
            and int(row["classrooms"].get("level") or 0) == level
        ]
        if assigned_groups:
            groups = assigned_groups
        if not groups:
            return None
        classroom = next((row for row in groups if row.get("room_id")), groups[0])
        classroom_id = classroom["id"]
        physical_room_id = classroom.get("room_id")
        academic_year = assignment.get("academic_year") or "2026/2027"
        semester = assignment.get("semester") or "Semester 1"
        session_type = _session_type_for_lecturer(assignment["lecturer_id"])
        base_days = WEEKDAY_DAYS if session_type == "weekday" else WEEKEND_DAYS
        scheduled = supabase.table("course_schedules").select(
            "lecturer_id, classroom_id, physical_room_id, day_of_week, start_time, end_time"
        ).eq("academic_year", academic_year).eq("semester", semester).execute().data or []
        days = sorted(
            base_days,
            key=lambda day: sum(
                1 for row in scheduled
                if row.get("lecturer_id") == assignment["lecturer_id"] and row.get("day_of_week") == day
            ),
        )

        for day in days:
            for hour in range(8, 14):
                start = f"{hour:02d}:00:00"
                end = f"{hour + 1:02d}:00:00"
                start_minute, end_minute = hour * 60, (hour + 1) * 60
                conflict = any(
                    row.get("day_of_week") == day
                    and (
                        row.get("lecturer_id") == assignment["lecturer_id"]
                        or row.get("classroom_id") == classroom_id
                        or (physical_room_id and row.get("physical_room_id") == physical_room_id)
                    )
                    and start_minute < _minutes(row.get("end_time"))
                    and end_minute > _minutes(row.get("start_time"))
                    for row in scheduled
                )
                if conflict:
                    continue

                slots = supabase.table("timetable_slots").select("id").eq(
                    "day_of_week", day
                ).eq("start_time", start).eq("end_time", end).limit(1).execute().data or []
                slot_id = slots[0]["id"] if slots else supabase.table("timetable_slots").insert({
                    "day_of_week": day, "start_time": start, "end_time": end,
                }).execute().data[0]["id"]
                payload = {
                    "assignment_id": assignment_id,
                    "course_id": assignment["course_id"],
                    "lecturer_id": assignment["lecturer_id"],
                    "classroom_id": classroom_id,
                    "physical_room_id": physical_room_id,
                    "programme": programme,
                    "level": level,
                    "academic_year": academic_year,
                    "semester": semester,
                    "session_type": session_type,
                    "day_of_week": day,
                    "start_time": start,
                    "end_time": end,
                    "slot_id": slot_id,
                }
                return supabase.table("course_schedules").insert(payload).execute().data[0]
        return None
    except Exception as exc:
        error_text = str(exc).lower()
        if "course_schedules" in error_text and any(
            marker in error_text for marker in ("pgrst205", "could not find the table", "does not exist")
        ):
            print("[COURSE_SCHEDULES] migration 009 is pending; assignment was saved without a meeting time.")
            return None
        raise
