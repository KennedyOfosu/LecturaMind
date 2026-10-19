"""
events.py — Socket.IO real-time event handlers.
Tracks student presence per course and broadcasts to monitoring lecturers.
"""

import datetime
from flask import request
from flask_socketio import emit, join_room, leave_room
from services.supabase_client import supabase
from services.lecturer_access import lecturer_can_manage_student, lecturer_managed_student_ids

# In-memory store: { course_id: { student_id: { name, id_number, sid, ... } } }
active_users: dict = {}

# Live quiz leaderboard: { quiz_id: { student_id: { student_id, student_name, score, answers_correct, answers_total } } }
live_sessions: dict = {}
socket_identities: dict = {}

POINTS_PER_CORRECT = 10


def _build_leaderboard(quiz_id: str) -> list:
    """Sort live session entries by score descending and inject rank."""
    session = live_sessions.get(quiz_id, {})
    entries = list(session.get("students", {}).values())
    entries.sort(key=lambda e: e.get("score", 0), reverse=True)
    for i, entry in enumerate(entries):
        entry["rank"] = i + 1
    return entries


def _now_iso() -> str:
    return datetime.datetime.utcnow().isoformat()


def register_socket_events(socketio):
    """Register all Socket.IO event handlers on the given SocketIO instance."""

    def identity_for_current_socket():
        identity = socket_identities.get(request.sid)
        if not identity:
            return None
        try:
            result = supabase.table("profiles").select(
                "id, role, full_name, email, user_id_number, programme, level, classroom_id, account_status"
            ).eq("id", identity["user_id"]).limit(1).execute()
            if not result.data or result.data[0].get("account_status", "active") != "active":
                return None
            return result.data[0]
        except Exception:
            return None

    def course_for_lecturer(identity, course_id):
        if not identity or identity.get("role") not in ("lecturer", "superadmin"):
            return None
        result = supabase.table("courses").select("id, lecturer_id").eq("id", course_id).limit(1).execute()
        if not result.data:
            return None
        course = result.data[0]
        if identity["role"] == "lecturer" and course.get("lecturer_id") != identity.get("id"):
            return None
        return course

    def student_can_use_course(identity, course_id):
        if not identity or identity.get("role") != "student":
            return False
        enrollment = supabase.table("enrolments").select("id").eq(
            "student_id", identity["id"]
        ).eq("course_id", course_id).limit(1).execute()
        if not enrollment.data:
            return False
        course = supabase.table("courses").select("lecturer_id").eq("id", course_id).limit(1).execute()
        lecturer_id = course.data[0].get("lecturer_id") if course.data else None
        return bool(lecturer_id and lecturer_can_manage_student(supabase, lecturer_id, identity["id"]))

    def allowed_students_for_course(course_id, lecturer_id):
        enrolments = supabase.table("enrolments").select("student_id").eq("course_id", course_id).execute()
        student_ids = [row.get("student_id") for row in (enrolments.data or []) if row.get("student_id")]
        return lecturer_managed_student_ids(supabase, lecturer_id, student_ids)

    def quiz_for_identity(identity, quiz_id):
        if not identity or not quiz_id:
            return None
        result = supabase.table("quizzes").select("id, course_id").eq("id", quiz_id).limit(1).execute()
        if not result.data:
            return None
        quiz = result.data[0]
        if identity.get("role") in ("lecturer", "superadmin"):
            return quiz if course_for_lecturer(identity, quiz.get("course_id")) else None
        if identity.get("role") == "student" and student_can_use_course(identity, quiz.get("course_id")):
            return quiz
        return None

    @socketio.on("connect")
    def on_connect(auth=None):
        """Authenticate the connection using the existing Supabase access token."""
        token = (auth or {}).get("token") if isinstance(auth, dict) else None
        if not token:
            return False
        try:
            user_result = supabase.auth.get_user(token)
            user = user_result.user
            if not user:
                return False
            profile_result = supabase.table("profiles").select("id, account_status").eq(
                "id", user.id
            ).limit(1).execute()
            if not profile_result.data or profile_result.data[0].get("account_status", "active") != "active":
                return False
            socket_identities[request.sid] = {"user_id": user.id}
        except Exception:
            return False
        print(f"[socket] Authenticated client connected: {request.sid}")

    @socketio.on("disconnect")
    def on_disconnect():
        """Remove the disconnecting socket from all course presence lists."""
        sid = request.sid
        identity = socket_identities.pop(sid, None)
        for course_id, students in list(active_users.items()):
            for student_id, info in list(students.items()):
                if info.get("sid") == sid and identity and student_id == identity.get("user_id"):
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
        identity = identity_for_current_socket()
        if not identity or identity.get("role") != "student":
            return

        student_id = identity["id"]
        student_name = identity.get("full_name") or "Student"
        id_number = identity.get("user_id_number") or ""
        programme = identity.get("programme")
        level = identity.get("level")
        enrolments = supabase.table("enrolments").select("course_id").eq(
            "student_id", student_id
        ).execute()
        course_ids = [row["course_id"] for row in (enrolments.data or []) if row.get("course_id")]

        join_room(f"student_{student_id}")

        for course_id in course_ids:
            if not student_can_use_course(identity, course_id):
                continue
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
        identity = identity_for_current_socket()
        course = course_for_lecturer(identity, course_id) if course_id else None
        if not course:
            return

        join_room(f"lecturer_course_{course_id}")
        join_room(f"lecturer_{course_id}")  # legacy

        current = list(active_users.get(course_id, {}).values())
        if identity.get("role") == "lecturer":
            allowed_ids = allowed_students_for_course(course_id, identity["id"])
            current = [row for row in current if row.get("student_id") in allowed_ids]
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
        course_id  = data.get("course_id")
        identity = identity_for_current_socket()
        if not course_id or not student_can_use_course(identity, course_id):
            return

        user_id = identity["id"]
        user_name = identity.get("full_name") or "Student"

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
        identity = identity_for_current_socket()
        course = course_for_lecturer(identity, course_id) if course_id else None
        if not course:
            return
        join_room(f"lecturer_{course_id}")
        join_room(f"lecturer_course_{course_id}")
        current = list(active_users.get(course_id, {}).values())
        if identity.get("role") == "lecturer":
            allowed_ids = allowed_students_for_course(course_id, identity["id"])
            current = [row for row in current if row.get("student_id") in allowed_ids]
        emit("active_users_updated", current)

    @socketio.on("leave_course")
    def on_leave_course(data):
        course_id = data.get("course_id")
        identity = identity_for_current_socket()
        if not course_id or not student_can_use_course(identity, course_id):
            return
        user_id = identity["id"]
        leave_room(f"course_{course_id}")
        if course_id in active_users and user_id in active_users[course_id] and active_users[course_id][user_id].get("sid") == request.sid:
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
        identity = identity_for_current_socket()
        if not course_id or not student_can_use_course(identity, course_id):
            return
        student = {"student_id": identity["id"], "student_name": identity.get("full_name") or "Student"}
        emit("student_activity", {
            "user_id":   student["student_id"],
            "user_name": student["student_name"],
            "action":    data.get("action", "is active"),
            "course_id": course_id,
        }, room=f"lecturer_{course_id}")

    @socketio.on("live_question")
    def on_live_question(data):
        course_id     = data.get("course_id")
        question_text = (data.get("question") or "").strip()
        identity = identity_for_current_socket()
        if not course_id or not question_text or not student_can_use_course(identity, course_id):
            return
        student_id = identity["id"]
        student_name = identity.get("full_name") or "Student"
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

    # ── Live Quiz Events ─────────────────────────────────────────────────────

    @socketio.on("lecturer_watch_quiz")
    def on_lecturer_watch_quiz(data):
        """
        Fired when the lecturer opens the leaderboard for a specific quiz.
        Joins the lecturer into the quiz live room and replays current leaderboard.
        """
        quiz_id = data.get("quiz_id")
        identity = identity_for_current_socket()
        if not quiz_for_identity(identity, quiz_id):
            return
        join_room(f"quiz_live_{quiz_id}")
        board = _build_leaderboard(quiz_id)
        emit("leaderboard_update", {"quiz_id": quiz_id, "leaderboard": board})

    @socketio.on("join_live_quiz")
    def on_join_live_quiz(data):
        """
        Student joins a live quiz session.
        Adds them to the in-memory leaderboard and broadcasts updated rankings.

        Data: { quiz_id, student_id, student_name }
        """
        quiz_id      = data.get("quiz_id")
        identity = identity_for_current_socket()
        if not quiz_for_identity(identity, quiz_id) or identity.get("role") != "student":
            return
        student_id = identity["id"]
        student_name = identity.get("full_name") or "Student"

        # Personal room so we can deliver per-student answer feedback
        join_room(f"quiz_student_{quiz_id}_{student_id}")

        if quiz_id not in live_sessions:
            live_sessions[quiz_id] = {"pin": "", "students": {}}

        if student_id not in live_sessions[quiz_id]["students"]:
            live_sessions[quiz_id]["students"][student_id] = {
                "student_id":      student_id,
                "student_name":    student_name,
                "score":           0,
                "answers_correct": 0,
                "answers_total":   0,
            }

        board = _build_leaderboard(quiz_id)
        emit("leaderboard_update", {"quiz_id": quiz_id, "leaderboard": board},
             room=f"quiz_live_{quiz_id}")
        emit("joined_live_quiz", {"quiz_id": quiz_id, "student_id": student_id})
        print(f"[live_quiz] {student_name} joined quiz {quiz_id}.")

    @socketio.on("submit_live_answer")
    def on_submit_live_answer(data):
        """
        Student submits an answer for a question during a live session.
        Scores the answer server-side, updates the leaderboard, and notifies both
        the student (answer_result) and the lecturer room (leaderboard_update).

        Data: { quiz_id, student_id, student_name, question_index, answer }
        """
        quiz_id        = data.get("quiz_id")
        question_index = data.get("question_index")
        answer         = data.get("answer", "")
        identity = identity_for_current_socket()
        if not quiz_for_identity(identity, quiz_id) or identity.get("role") != "student" or question_index is None:
            return
        student_id = identity["id"]
        student_name = identity.get("full_name") or "Student"

        # Fetch correct answer from DB
        try:
            quiz_res = supabase.table("quizzes").select("questions").eq(
                "id", quiz_id
            ).single().execute()
            if not quiz_res.data:
                return
            questions = quiz_res.data["questions"]
            if question_index >= len(questions):
                return
            correct   = questions[question_index].get("correct_answer", "")
            is_correct = (answer.strip() == correct.strip())
        except Exception as exc:
            print(f"[live_quiz] Error fetching quiz: {exc}")
            return

        # Update in-memory leaderboard
        if quiz_id not in live_sessions:
            live_sessions[quiz_id] = {"pin": "", "students": {}}
        if student_id not in live_sessions[quiz_id]["students"]:
            live_sessions[quiz_id]["students"][student_id] = {
                "student_id":      student_id,
                "student_name":    student_name,
                "score":           0,
                "answers_correct": 0,
                "answers_total":   0,
            }

        entry = live_sessions[quiz_id]["students"][student_id]
        entry["answers_total"] = entry.get("answers_total", 0) + 1
        if is_correct:
            entry["answers_correct"] = entry.get("answers_correct", 0) + 1
            entry["score"]           = entry.get("score", 0) + POINTS_PER_CORRECT

        # Send per-student result
        emit("answer_result", {
            "question_index": question_index,
            "is_correct":     is_correct,
            "correct_answer": correct,
            "score":          entry["score"],
        }, room=f"quiz_student_{quiz_id}_{student_id}")

        # Broadcast updated leaderboard to lecturer
        board = _build_leaderboard(quiz_id)
        emit("leaderboard_update",
             {"quiz_id": quiz_id, "leaderboard": board},
             room=f"quiz_live_{quiz_id}")

    # ── Live Q&A ─────────────────────────────────────────────────────────────

    @socketio.on("lecturer_answer")
    def on_lecturer_answer(data):
        question_id = data.get("question_id")
        answer      = (data.get("answer") or "").strip()
        course_id   = data.get("course_id")
        identity = identity_for_current_socket()
        if not question_id or not answer or not course_for_lecturer(identity, course_id):
            return
        try:
            question_res = supabase.table("live_questions").select("id, course_id").eq("id", question_id).eq("course_id", course_id).limit(1).execute()
            if not question_res.data:
                return
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
