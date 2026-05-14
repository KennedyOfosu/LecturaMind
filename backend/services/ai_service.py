"""
ai_service.py — Anthropic Claude interaction and student query processing.
The AI always responds using injected course content as context.
"""

import anthropic
from config import Config
from services.supabase_client import supabase
from services.file_service import get_all_course_text

client = anthropic.Anthropic(api_key=Config.ANTHROPIC_API_KEY)


def build_system_prompt(course_name: str, course_text: str) -> str:
    """
    Build the system prompt that instructs Claude to answer only from course materials.
    """
    return (
        f"You are LecturaMind, an AI teaching assistant for the course \"{course_name}\". "
        "Your job is to answer student questions accurately and helpfully, using ONLY the "
        "course content provided below. If the answer cannot be found in the course content, "
        "tell the student politely and suggest they contact their lecturer directly. "
        "Do not answer questions outside the scope of the provided course material.\n\n"
        f"Course Content:\n{course_text}"
    )


def query_claude(system_prompt: str, student_query: str) -> str:
    """
    Send a query to Anthropic Claude and return the assistant's response text.

    Args:
        system_prompt: System instructions including course content.
        student_query: The student's question.

    Returns:
        The AI response string.

    Raises:
        Exception: Propagates Anthropic API errors to the caller.
    """
    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=1024,
        system=system_prompt,
        messages=[{"role": "user", "content": student_query}],
    )
    return response.content[0].text.strip()


def process_student_query(course_id: str, student_id: str, student_query: str) -> str:
    """
    Full pipeline: fetch course text → build prompt → call Claude → save log → return response.

    Args:
        course_id: UUID of the course being queried.
        student_id: UUID of the student asking the question.
        student_query: The raw question string from the student.

    Returns:
        The AI's response string.
    """
    # Fetch course name
    course_res = supabase.table("courses").select("course_name").eq("id", course_id).execute()
    course_name = course_res.data[0].get("course_name", "this course") if course_res.data else "this course"

    # Fetch course material text
    course_text = get_all_course_text(course_id)

    if not course_text.strip():
        response_text = (
            "I'm sorry, but no course materials have been uploaded for this course yet. "
            "Please check back later, or contact your lecturer for assistance."
        )
    else:
        system_prompt = build_system_prompt(course_name, course_text)
        try:
            response_text = query_claude(system_prompt, student_query)
        except Exception as e:
            import traceback
            print(f"[AI ERROR] Claude call failed: {e}")
            traceback.print_exc()
            response_text = (
                "I'm experiencing a technical issue and cannot answer your question right now. "
                "Please try again in a moment or contact your lecturer directly."
            )

    # Persist the chat log regardless of success/failure
    try:
        supabase.table("chat_messages").insert({
            "student_id": student_id,
            "course_id": course_id,
            "query": student_query,
            "response": response_text,
        }).execute()
    except Exception:
        pass

    return response_text
