"""
ai_service.py — OpenAI GPT interaction and student query processing.
The AI always responds using injected course content as context.
"""

from openai import OpenAI
from config import Config
from services.supabase_client import supabase
from services.file_service import get_all_course_text

client = OpenAI(api_key=Config.OPENAI_API_KEY)


def build_prompt(course_name: str, course_text: str, student_query: str) -> list:
    """
    Construct the message list for the OpenAI chat completions endpoint.

    Args:
        course_name: Name of the course (used in the system message).
        course_text: Extracted text from all course materials.
        student_query: The student's question.

    Returns:
        List of message dicts ready for the OpenAI API.
    """
    system_message = (
        f"You are LecturaMind, an AI teaching assistant for the course \"{course_name}\". "
        "Your job is to answer student questions accurately and helpfully, using ONLY the "
        "course content provided below. If the answer cannot be found in the course content, "
        "tell the student politely and suggest they contact their lecturer directly. "
        "Do not answer questions outside the scope of the provided course material.\n\n"
        f"Course Content:\n{course_text}"
    )
    return [
        {"role": "system", "content": system_message},
        {"role": "user", "content": student_query},
    ]


def query_openai(messages: list) -> str:
    """
    Send a message list to OpenAI and return the assistant's response text.

    Args:
        messages: List of message dicts (system + user).

    Returns:
        The AI response string.

    Raises:
        Exception: Propagates OpenAI API errors to the caller.
    """
    response = client.chat.completions.create(
        model="gpt-3.5-turbo",
        messages=messages,
        max_tokens=1000,
        temperature=0.3,
    )
    return response.choices[0].message.content.strip()


def process_student_query(course_id: str, student_id: str, student_query: str) -> str:
    """
    Full pipeline: fetch course text → build prompt → call OpenAI → save log → return response.

    Args:
        course_id: UUID of the course being queried.
        student_id: UUID of the student asking the question.
        student_query: The raw question string from the student.

    Returns:
        The AI's response string.
    """
    # Fetch course name
    course_res = supabase.table("courses").select("course_name").eq("id", course_id).single().execute()
    course_name = course_res.data.get("course_name", "this course") if course_res.data else "this course"

    # Fetch course material text
    course_text = get_all_course_text(course_id)

    if not course_text.strip():
        response_text = (
            "I'm sorry, but no course materials have been uploaded for this course yet. "
            "Please check back later, or contact your lecturer for assistance."
        )
    else:
        messages = build_prompt(course_name, course_text, student_query)
        try:
            response_text = query_openai(messages)
        except Exception as e:
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
        pass  # Logging failure should not block the response

    return response_text
