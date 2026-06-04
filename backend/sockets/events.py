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

# Live quiz leaderboard: { quiz_id: { student_id: { student_id, student_name, score, answers_correct, answers_total } } }
live_sessions: dict = {}

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

    # ── Live Quiz Events ─────────────────────────────────────────────────────

    @socketio.on("lecturer_watch_quiz")
    def on_lecturer_watch_quiz(data):
        """
        Fired when the lecturer opens the leaderboard for a specific quiz.
        Joins the lecturer into the quiz live room and replays current leaderboard.
        """
        quiz_id = data.get("quiz_id")
        if not quiz_id:
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
        student_id   = data.get("student_id")
        student_name = data.get("student_name", "Student")
        if not quiz_id or not student_id:
            return

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
        student_id     = data.get("student_id")
        student_name   = data.get("student_name", "Student")
        question_index = data.get("question_index")
        answer         = data.get("answer", "")

        if not quiz_id or not student_id or question_index is None:
            return

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
