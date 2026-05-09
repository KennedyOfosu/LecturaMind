"""
quiz_service.py — AI-powered quiz generation from course material content.
OpenAI is instructed to return strict JSON only to allow reliable parsing.
"""

import json
import re
from openai import OpenAI
from config import Config
from services.supabase_client import supabase
from services.file_service import get_all_course_text

client = OpenAI(api_key=Config.OPENAI_API_KEY)


def _parse_quiz_json(raw: str) -> list:
    """
    Parse the raw OpenAI response into a list of question objects.
    Strips markdown fences if present before parsing.

    Args:
        raw: Raw string response from OpenAI.

    Returns:
        List of question dicts.

    Raises:
        ValueError: If the response cannot be parsed as valid JSON.
    """
    cleaned = re.sub(r"```(?:json)?", "", raw).replace("```", "").strip()
    try:
        questions = json.loads(cleaned)
    except json.JSONDecodeError as e:
        raise ValueError(f"OpenAI returned invalid JSON: {e}")

    if not isinstance(questions, list):
        raise ValueError("Expected a JSON array of questions")

    return questions


def generate_quiz(course_id: str, num_questions: int = 10, difficulty: str = "medium") -> dict:
    """
    Generate a quiz from course material and save it to the database.

    Args:
        course_id: UUID of the course to generate the quiz for.
        num_questions: Number of multiple-choice questions to generate (5–20).
        difficulty: 'easy', 'medium', or 'hard'.

    Returns:
        The created quiz database record.

    Raises:
        ValueError: If no course material exists or AI returns bad data.
    """
    course_text = get_all_course_text(course_id)
    if not course_text.strip():
        raise ValueError("No course materials found. Upload materials before generating a quiz.")

    course_res = supabase.table("courses").select("course_name").eq("id", course_id).single().execute()
    course_name = course_res.data.get("course_name", "this course") if course_res.data else "this course"

    prompt = (
        f"You are a university lecturer creating a quiz for the course \"{course_name}\".\n"
        f"Based ONLY on the course content below, generate exactly {num_questions} multiple-choice "
        f"questions at {difficulty} difficulty level.\n\n"
        "Return ONLY a valid JSON array with no markdown, no explanation, and no extra text. "
        "Each element must be an object with exactly these keys:\n"
        "- \"question\": string\n"
        "- \"options\": array of exactly 4 strings\n"
        "- \"correct_answer\": string (must exactly match one of the options)\n"
        "- \"explanation\": string (brief explanation of why the answer is correct)\n\n"
        f"Course Content:\n{course_text[:8000]}"  # Truncate to stay within token limits
    )

    response = client.chat.completions.create(
        model="gpt-3.5-turbo",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=3000,
        temperature=0.5,
    )

    raw = response.choices[0].message.content.strip()
    questions = _parse_quiz_json(raw)

    import datetime
    title = f"{course_name} Quiz — {difficulty.capitalize()} ({datetime.date.today().strftime('%d %b %Y')})"

    res = supabase.table("quizzes").insert({
        "course_id": course_id,
        "title": title,
        "questions": questions,
    }).execute()

    return res.data[0]
