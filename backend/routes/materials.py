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
    if not file or not file.filename:
        return jsonify({"error": "No file was selected.", "code": 400}), 400

    file_bytes = file.read()
    file_size = len(file_bytes)

    if file_size == 0:
        return jsonify({"error": "The uploaded file is empty.", "code": 400}), 400

    if file_size > MAX_FILE_SIZE:
        size_mb = round(file_size / (1024 * 1024), 2)
        return jsonify({
            "error": f"File is too large ({size_mb} MB). Maximum allowed size is 10 MB.",
            "code": 413,
        }), 413

    mime = file.content_type or ""
    fn = file.filename.lower()
    ext = fn.rsplit(".", 1)[-1] if "." in fn else ""
    allowed_exts = {"pdf", "docx", "pptx", "ppt"}

    if ext not in allowed_exts:
        return jsonify({
            "error": "Unsupported file type. Please upload a PDF, DOCX, or PPTX file.",
            "code": 415,
        }), 415

    # Normalise mime by extension
    ext_to_mime = {
        "pdf":  "application/pdf",
        "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "ppt":  "application/vnd.ms-powerpoint",
    }
    mime = ext_to_mime[ext]

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
