"""
events.py — Socket.IO real-time event handlers for live monitoring and Q&A.
Rooms are course-scoped: students join 'course_{id}', lecturers join 'lecturer_{id}'.
"""

import jwt
from flask import request
from flask_socketio import emit, join_room, leave_room
from config import Config
from services.supabase_client import supabase

# In-memory store: { course_id: { user_id: { name, avatar } } }
active_users: dict = {}


def _decode_token(token: str) -> dict | None:
    """Decode the JWT handshake token. Returns payload or None on failure."""
    try:
        return jwt.decode(token, Config.JWT_SECRET, algorithms=["HS256"])
    except Exception:
        return None


def register_socket_events(socketio):
    """
    Register all Socket.IO event handlers on the given SocketIO instance.

    Args:
        socketio: The Flask-SocketIO instance from app.py.
    """

    @socketio.on("connect")
    def on_connect(auth):
        """Authenticate the connecting socket using the JWT token in auth data."""
        token = (auth or {}).get("token", "")
        payload = _decode_token(token)
        if not payload:
            return False  # Reject the connection

        request.environ["user_id"] = payload["sub"]
        request.environ["user_role"] = payload["role"]
        request.environ["user_name"] = payload.get("email", "Unknown")

    @socketio.on("disconnect")
    def on_disconnect():
        """Remove user from all active user lists on disconnect."""
        user_id = request.environ.get("user_id")
        if not user_id:
            return

        for course_id, users in list(active_users.items()):
            if user_id in users:
                del users[user_id]
                emit("active_users_updated", list(users.values()), room=f"lecturer_{course_id}")

    @socketio.on("join_course")
    def on_join_course(data):
        """
        Student joins a course room; updates the active users list for the lecturer.

        Data: { course_id, user_name, avatar_url? }
        """
        user_id = request.environ.get("user_id")
        course_id = data.get("course_id")
        user_name = data.get("user_name", "Student")
        avatar_url = data.get("avatar_url", "")

        if not course_id:
            return

        room = f"course_{course_id}"
        join_room(room)

        if course_id not in active_users:
            active_users[course_id] = {}
        active_users[course_id][user_id] = {
            "user_id": user_id,
            "name": user_name,
            "avatar_url": avatar_url,
        }

        emit("active_users_updated", list(active_users[course_id].values()), room=f"lecturer_{course_id}")

    @socketio.on("lecturer_join")
    def on_lecturer_join(data):
        """
        Lecturer joins their monitoring room for a course.

        Data: { course_id }
        """
        course_id = data.get("course_id")
        if course_id:
            join_room(f"lecturer_{course_id}")
            current_users = list(active_users.get(course_id, {}).values())
            emit("active_users_updated", current_users)

    @socketio.on("leave_course")
    def on_leave_course(data):
        """Student leaves a course room and is removed from the active list."""
        user_id = request.environ.get("user_id")
        course_id = data.get("course_id")
        if not course_id:
            return

        leave_room(f"course_{course_id}")

        if course_id in active_users and user_id in active_users[course_id]:
            del active_users[course_id][user_id]
            emit("active_users_updated", list(active_users[course_id].values()), room=f"lecturer_{course_id}")

    @socketio.on("student_active")
    def on_student_active(data):
        """
        Student signals activity (e.g., opened chatbot). Lecturer is notified.

        Data: { course_id, action }
        """
        user_id = request.environ.get("user_id")
        course_id = data.get("course_id")
        action = data.get("action", "is active")
        user_name = data.get("user_name", "A student")

        if course_id:
            emit("student_activity", {
                "user_id": user_id,
                "user_name": user_name,
                "action": action,
                "course_id": course_id,
            }, room=f"lecturer_{course_id}")

    @socketio.on("live_question")
    def on_live_question(data):
        """
        Student submits a live Q&A question. Stored in DB and broadcast to lecturer.

        Data: { course_id, question, student_name, student_id }
        """
        course_id = data.get("course_id")
        question_text = data.get("question", "").strip()
        student_id = data.get("student_id") or request.environ.get("user_id")
        student_name = data.get("student_name", "Student")

        if not course_id or not question_text:
            return

        try:
            res = supabase.table("live_questions").insert({
                "course_id": course_id,
                "student_id": student_id,
                "question": question_text,
            }).execute()
            question_record = res.data[0]
        except Exception:
            return

        payload = {
            **question_record,
            "student_name": student_name,
        }

        emit("new_live_question", payload, room=f"lecturer_{course_id}")
        emit("new_live_question", payload, room=f"course_{course_id}")

    @socketio.on("lecturer_answer")
    def on_lecturer_answer(data):
        """
        Lecturer answers a live question. Updated in DB and broadcast to all students.

        Data: { question_id, answer, course_id }
        """
        question_id = data.get("question_id")
        answer = data.get("answer", "").strip()
        course_id = data.get("course_id")

        if not question_id or not answer:
            return

        try:
            res = supabase.table("live_questions").update({
                "answer": answer,
                "answered": True,
            }).eq("id", question_id).execute()
            record = res.data[0] if res.data else {}
        except Exception:
            return

        emit("question_answered", {**record, "answer": answer, "question_id": question_id}, room=f"course_{course_id}")
        emit("question_answered", {**record, "answer": answer, "question_id": question_id}, room=f"lecturer_{course_id}")
