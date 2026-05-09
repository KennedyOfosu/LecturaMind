"""
file_service.py — File upload, text extraction, and Supabase Storage operations.
Text is extracted at upload time and stored in the database to avoid re-processing.
"""

import io
import pdfplumber
import docx
from pptx import Presentation
from services.supabase_client import supabase


def upload_to_storage(file_bytes: bytes, file_name: str, course_id: str) -> str:
    """
    Upload a file to the Supabase Storage bucket 'course-materials'.

    Args:
        file_bytes: Raw file content as bytes.
        file_name: Original filename (used as part of the storage path).
        course_id: UUID of the owning course (used to namespace the path).

    Returns:
        The storage path of the uploaded file.

    Raises:
        Exception: If the Supabase upload fails.
    """
    path = f"{course_id}/{file_name}"
    supabase.storage.from_("course-materials").upload(
        path,
        file_bytes,
        {"content-type": "application/octet-stream", "upsert": "true"},
    )
    return path


def extract_text_from_pdf(file_bytes: bytes) -> str:
    """
    Extract all text from a PDF file using pdfplumber.

    Args:
        file_bytes: Raw PDF content as bytes.

    Returns:
        Concatenated text from all pages, or empty string on failure.
    """
    text_parts = []
    try:
        with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text_parts.append(page_text)
    except Exception:
        pass
    return "\n".join(text_parts)


def extract_text_from_docx(file_bytes: bytes) -> str:
    """
    Extract all text from a DOCX file using python-docx.

    Args:
        file_bytes: Raw DOCX content as bytes.

    Returns:
        Concatenated paragraph text, or empty string on failure.
    """
    try:
        doc = docx.Document(io.BytesIO(file_bytes))
        return "\n".join(p.text for p in doc.paragraphs if p.text.strip())
    except Exception:
        return ""


def extract_text_from_pptx(file_bytes: bytes) -> str:
    """
    Extract all text from a PPTX file using python-pptx.

    Args:
        file_bytes: Raw PPTX content as bytes.

    Returns:
        Concatenated slide text, or empty string on failure.
    """
    try:
        prs = Presentation(io.BytesIO(file_bytes))
        text_parts = []
        for slide in prs.slides:
            for shape in slide.shapes:
                if hasattr(shape, "text") and shape.text.strip():
                    text_parts.append(shape.text.strip())
        return "\n".join(text_parts)
    except Exception:
        return ""


def get_all_course_text(course_id: str) -> str:
    """
    Retrieve and concatenate extracted_text for all materials in a course.

    Args:
        course_id: UUID of the course.

    Returns:
        A single string with all extracted course text, or empty string if none.
    """
    res = supabase.table("materials").select("extracted_text").eq(
        "course_id", course_id
    ).execute()
    texts = [row["extracted_text"] for row in res.data if row.get("extracted_text")]
    return "\n\n---\n\n".join(texts)
