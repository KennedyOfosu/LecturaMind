"""
materials.py — File upload, retrieval, and deletion routes for course materials.
Text is extracted on upload and stored in the database for fast AI querying.
"""

from flask import Blueprint, request, jsonify, g
from services.supabase_client import supabase
from services.file_service import (
    upload_to_storage, extract_text_from_pdf,
    extract_text_from_docx, extract_text_from_pptx,
)
from middleware.auth_middleware import require_auth, require_role

materials_bp = Blueprint("materials", __name__)

ALLOWED_MIME_TYPES = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/vnd.ms-powerpoint",
}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


@materials_bp.post("/upload")
@require_auth
@require_role("lecturer")
def upload_material():
    """
    Upload a PDF or DOCX course material.

    Form data: { file, course_id }
    Returns: the created material database record.
    """
    course_id = request.form.get("course_id", "").strip()
    if not course_id:
        return jsonify({"error": "course_id is required", "code": 400}), 400

    if "file" not in request.files:
        return jsonify({"error": "No file provided", "code": 400}), 400

    file = request.files["file"]
    if not file.filename:
        return jsonify({"error": "Empty filename", "code": 400}), 400

    file_bytes = file.read()

    if len(file_bytes) > MAX_FILE_SIZE:
        return jsonify({"error": "File exceeds 10 MB limit", "code": 413}), 413

    mime = file.content_type or ""
    fn = file.filename.lower()

    # Infer MIME from extension if browser sends generic type
    if mime not in ALLOWED_MIME_TYPES:
        if fn.endswith(".pdf"):
            mime = "application/pdf"
        elif fn.endswith(".docx"):
            mime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        elif fn.endswith(".pptx"):
            mime = "application/vnd.openxmlformats-officedocument.presentationml.presentation"
        elif fn.endswith(".ppt"):
            mime = "application/vnd.ms-powerpoint"
        else:
            return jsonify({"error": "Only PDF, DOCX, and PPTX files are allowed", "code": 415}), 415

    # Extract text based on file type
    if mime == "application/pdf" or fn.endswith(".pdf"):
        extracted_text = extract_text_from_pdf(file_bytes)
        file_type = "pdf"
    elif fn.endswith(".pptx") or fn.endswith(".ppt") or "presentation" in mime:
        extracted_text = extract_text_from_pptx(file_bytes)
        file_type = "pptx"
    else:
        extracted_text = extract_text_from_docx(file_bytes)
        file_type = "docx"

    try:
        file_path = upload_to_storage(file_bytes, file.filename, course_id)
    except Exception as e:
        return jsonify({"error": f"Storage upload failed: {str(e)}", "code": 500}), 500

    try:
        res = supabase.table("materials").insert({
            "course_id": course_id,
            "file_name": file.filename,
            "file_path": file_path,
            "file_type": file_type,
            "extracted_text": extracted_text,
        }).execute()
    except Exception as e:
        return jsonify({"error": str(e), "code": 500}), 500

    return jsonify(res.data[0]), 201


@materials_bp.get("/course/<course_id>")
@require_auth
def get_course_materials(course_id: str):
    """Return all materials for a given course (accessible to enrolled students and the lecturer)."""
    res = supabase.table("materials").select(
        "id, course_id, file_name, file_path, file_type, uploaded_at"
    ).eq("course_id", course_id).order("uploaded_at", desc=True).execute()
    return jsonify(res.data), 200


@materials_bp.delete("/<material_id>")
@require_auth
@require_role("lecturer")
def delete_material(material_id: str):
    """Delete a material record and remove its file from Supabase Storage."""
    # Fetch the record first to get the file path
    res = supabase.table("materials").select("file_path").eq("id", material_id).single().execute()
    if not res.data:
        return jsonify({"error": "Material not found", "code": 404}), 404

    file_path = res.data["file_path"]

    try:
        supabase.storage.from_("course-materials").remove([file_path])
    except Exception:
        pass  # Storage removal failure should not block the DB delete

    supabase.table("materials").delete().eq("id", material_id).execute()
    return jsonify({"message": "Material deleted"}), 200
