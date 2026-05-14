"""
events.py — Socket.IO real-time event handlers.
Tracks student presence per course and broadcasts to monitoring lecturers.
"""

import datetime
from flask import request
from flask_socketio import emit, join_room, leave_room
from services.supabase_client import supabase

# In-memory store: { course_id: { student_id: { name, id_number, sid, ... } } }
active_users: dict = {}


def _now_iso() -> str:
    return datetime.datetime.utcnow().isoformat()


def register_socket_events(socketio):
    """Register all Socket.IO event handlers on the given SocketIO instance."""

    @socketio.on("connect")
    def on_connect(auth=None):
        """Accept the connection. Identity is established via event payloads."""
        print(f"[socket] Client connected: {request.sid}")

    @socketio.on("disconnect")
    def on_disconnect():
        """Remove the disconnecting socket from all course presence lists."""
        sid = request.sid
        for course_id, students in list(active_users.items()):
            for student_id, info in list(students.items()):
                if info.get("sid") == sid:
                    del active_users[course_id][student_id]
                    emit("student_went_offline", {
                        "student_id": student_id,
                        "course_id":  course_id,
                    }, room=f"lecturer_course_{course_id}")
                    # Legacy event for existing listeners
                    emit("active_users_updated",
                         list(active_users[course_id].values()),
                         room=f"lecturer_{course_id}")
                    print(f"[socket] {info.get('student_name','?')} went offline (course {course_id}).")

    @socketio.on("student_login")
    def on_student_login(data):
        """
        Fired by the student client after dashboard load.
        Registers presence in every enrolled course room.

        Data:
            student_id, student_name, student_id_number,
            programme, level, course_ids: [..]
        """
        student_id   = data.get("student_id")
        student_name = data.get("student_name", "Student")
        id_number    = data.get("student_id_number", "")
        programme    = data.get("programme")
        level        = data.get("level")
        course_ids   = data.get("course_ids", []) or []

        if not student_id:
            return

        join_room(f"student_{student_id}")

        for course_id in course_ids:
            join_room(f"course_{course_id}")

            if course_id not in active_users:
                active_users[course_id] = {}

            payload = {
                "student_id":   student_id,
                "user_id":      student_id,     # legacy alias
                "student_name": student_name,
                "name":         student_name,   # legacy alias
                "id_number":    id_number,
                "programme":    programme,
                "level":        level,
                "course_id":    course_id,
                "joined_at":    _now_iso(),
                "sid":          request.sid,
            }
            active_users[course_id][student_id] = payload

            emit("student_came_online", payload, room=f"lecturer_course_{course_id}")
            # Legacy event for existing listeners
            emit("active_users_updated",
                 list(active_users[course_id].values()),
                 room=f"lecturer_{course_id}")

        print(f"[socket] {student_name} ({id_number}) is online in {len(course_ids)} course(s).")

    @socketio.on("lecturer_watch_course")
    def on_lecturer_watch_course(data):
        """
        Fired when a lecturer opens the live monitor for a course.
        Joins the lecturer's monitoring room and replays the current presence list.
        """
        course_id = data.get("course_id")
        if not course_id:
            return

        join_room(f"lecturer_course_{course_id}")
        join_room(f"lecturer_{course_id}")  # legacy

        current = list(active_users.get(course_id, {}).values())
        emit("active_students_list", {
            "course_id":       course_id,
            "active_students": current,
            "count":           len(current),
        })
        # Legacy
        emit("active_users_updated", current)

    # ── Legacy events kept for backward compatibility ────────────────────

    @socketio.on("join_course")
    def on_join_course(data):
        """Legacy: a student announces presence in a course."""
        user_id    = data.get("user_id") or data.get("student_id")
        course_id  = data.get("course_id")
        user_name  = data.get("user_name") or data.get("student_name", "Student")
        if not user_id or not course_id:
            return

        join_room(f"course_{course_id}")
        if course_id not in active_users:
            active_users[course_id] = {}
        active_users[course_id][user_id] = {
            "student_id":   user_id,
            "user_id":      user_id,
            "student_name": user_name,
            "name":         user_name,
            "course_id":    course_id,
            "joined_at":    _now_iso(),
            "sid":          request.sid,
        }
        emit("active_users_updated",
             list(active_users[course_id].values()),
             room=f"lecturer_{course_id}")
        emit("student_came_online",
             active_users[course_id][user_id],
             room=f"lecturer_course_{course_id}")

    @socketio.on("lecturer_join")
    def on_lecturer_join(data):
        """Legacy: lecturer joins their monitoring room."""
        course_id = data.get("course_id")
        if not course_id:
            return
        join_room(f"lecturer_{course_id}")
        join_room(f"lecturer_course_{course_id}")
        emit("active_users_updated", list(active_users.get(course_id, {}).values()))

    @socketio.on("leave_course")
    def on_leave_course(data):
        user_id   = data.get("user_id") or data.get("student_id")
        course_id = data.get("course_id")
        if not course_id or not user_id:
            return
        leave_room(f"course_{course_id}")
        if course_id in active_users and user_id in active_users[course_id]:
            del active_users[course_id][user_id]
            emit("active_users_updated",
                 list(active_users[course_id].values()),
                 room=f"lecturer_{course_id}")
            emit("student_went_offline",
                 {"student_id": user_id, "course_id": course_id},
                 room=f"lecturer_course_{course_id}")

    @socketio.on("student_active")
    def on_student_active(data):
        course_id = data.get("course_id")
        if not course_id:
            return
        emit("student_activity", {
            "user_id":   data.get("user_id") or data.get("student_id"),
            "user_name": data.get("user_name") or data.get("student_name", "A student"),
            "action":    data.get("action", "is active"),
            "course_id": course_id,
        }, room=f"lecturer_{course_id}")

    @socketio.on("live_question")
    def on_live_question(data):
        course_id     = data.get("course_id")
        question_text = (data.get("question") or "").strip()
        student_id    = data.get("student_id")
        student_name  = data.get("student_name", "Student")
        if not course_id or not question_text or not student_id:
            return
        try:
            res = supabase.table("live_questions").insert({
                "course_id":  course_id,
                "student_id": student_id,
                "question":   question_text,
            }).execute()
            record = res.data[0]
        except Exception:
            return
        payload = {**record, "student_name": student_name}
        emit("new_live_question", payload, room=f"lecturer_{course_id}")
        emit("new_live_question", payload, room=f"course_{course_id}")

    @socketio.on("lecturer_answer")
    def on_lecturer_answer(data):
        question_id = data.get("question_id")
        answer      = (data.get("answer") or "").strip()
        course_id   = data.get("course_id")
        if not question_id or not answer:
            return
        try:
            res = supabase.table("live_questions").update({
                "answer": answer, "answered": True,
            }).eq("id", question_id).execute()
            record = res.data[0] if res.data else {}
        except Exception:
            return
        emit("question_answered",
             {**record, "answer": answer, "question_id": question_id},
             room=f"course_{course_id}")
        emit("question_answered",
             {**record, "answer": answer, "question_id": question_id},
             room=f"lecturer_{course_id}")
