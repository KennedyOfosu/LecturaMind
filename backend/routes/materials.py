"""
materials.py — File upload, retrieval, and deletion routes for course materials.
Text is extracted on upload and stored in the database for fast AI querying.
"""

from flask import Blueprint, request, jsonify, g, Response
import datetime
import requests
from services.supabase_client import supabase
from services.file_service import (
    upload_to_storage, extract_text_from_pdf,
    extract_text_from_docx, extract_text_from_pptx,
    get_mime_type,
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


@materials_bp.get("/<material_id>/file")
@require_auth
def download_material_file(material_id: str):
    """Proxy the file from Supabase Storage and stream it to the client as a download."""
    print(f"[download-file] Request for material_id={material_id}")
    try:
        res = supabase.table("materials").select("file_path, file_name").eq("id", material_id).execute()
    except Exception as e:
        print(f"[download-file] DB error: {e}")
        return jsonify({"error": f"Database error: {str(e)}", "code": 500}), 500

    if not res.data:
        print(f"[download-file] Material not found: {material_id}")
        return jsonify({"error": "Material not found", "code": 404}), 404

    file_path = res.data[0]["file_path"]
    file_name = res.data[0]["file_name"]
    print(f"[download-file] Found material: file_path={file_path}, file_name={file_name}")

    try:
        # Generate a signed URL (server-side, same approach as /download endpoint)
        signed = supabase.storage.from_("course-materials").create_signed_url(
            file_path, 3600
        )
        print(f"[download-file] Signed URL response: {signed}")
        signed_url = _extract_signed_url(signed)
        if not signed_url:
            print(f"[download-file] Failed to extract signed URL for {file_path}")
            return jsonify({"error": "Could not generate download link", "code": 500}), 500

        print(f"[download-file] Fetching file from signed URL: {signed_url[:50]}...")
        # Fetch the file bytes server-to-server (no CORS issues)
        resp = requests.get(signed_url, timeout=60)
        print(f"[download-file] Response status: {resp.status_code}")
        resp.raise_for_status()
        file_bytes = resp.content
        print(f"[download-file] File size: {len(file_bytes)} bytes")
    except Exception as e:
        print(f"[download-file] Failed for {file_path}: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": f"Could not retrieve file from storage: {str(e)}", "code": 500}), 500

    mime = get_mime_type(file_name)
    response = Response(file_bytes, mimetype=mime)
    response.headers["Content-Disposition"] = f'attachment; filename="{file_name}"'
    response.headers["Content-Length"] = len(file_bytes)
    print(f"[download-file] Returning file: mime={mime}, size={len(file_bytes)}")
    return response


def _extract_signed_url(signed_response):
    """
    Extract the signed URL string from the storage3 create_signed_url response.

    storage3 (used by supabase-py 2.x) returns a plain dict:
        {"signedURL": "https://...", ...}
    We handle edge cases defensively in case of version drift.
    """
    if signed_response is None:
        return None

    # Primary: plain dict with "signedURL" key (storage3's actual format)
    if isinstance(signed_response, dict):
        url = (
            signed_response.get("signedURL")
            or signed_response.get("signedUrl")
            or signed_response.get("signed_url")
        )
        if url:
            return url
        # Nested under "data"?
        data = signed_response.get("data")
        if isinstance(data, dict):
            return (
                data.get("signedURL")
                or data.get("signedUrl")
                or data.get("signed_url")
            )

    # Attribute-based access (future-proofing for model objects)
    for attr in ("signedURL", "signed_url", "signedUrl"):
        val = getattr(signed_response, attr, None)
        if val:
            return val

    return None


@materials_bp.get("/<material_id>/download")
@require_auth
def download_material(material_id: str):
    """Generate a 1-hour signed URL for downloading a material file."""
    try:
        res = supabase.table("materials").select("file_path, file_name").eq("id", material_id).execute()
    except Exception as e:
        print(f"[download] DB error for material {material_id}: {e}")
        return jsonify({"error": f"Database error: {str(e)}", "code": 500}), 500

    if not res.data:
        print(f"[download] Material {material_id} not found in database")
        return jsonify({"error": "Material not found", "code": 404}), 404

    file_path = res.data[0]["file_path"]
    file_name = res.data[0]["file_name"]
    print(f"[download] Generating signed URL for: {file_path}")

    try:
        signed = supabase.storage.from_("course-materials").create_signed_url(
            file_path, 3600
        )
        print(f"[download] Signed URL response type={type(signed).__name__}, value={signed}")
        url = _extract_signed_url(signed)
        if not url:
            print(f"[download] Could not extract URL from response: {signed}")
            return jsonify({"error": "Could not generate download link", "code": 500}), 500
        return jsonify({"url": url, "file_name": file_name}), 200
    except Exception as e:
        print(f"[download] Storage error for {file_path}: {e}")
        return jsonify({"error": f"Could not generate download link: {str(e)}", "code": 500}), 500


@materials_bp.post("/download-all")
@require_auth
def download_all_materials():
    """
    Bulk signed-URL endpoint.
    Body: { "material_ids": ["uuid1", "uuid2", ...] }
    Returns: [{ "id", "file_name", "url" }, ...]
    Caps at 20 files per request.
    """
    body = request.get_json(silent=True) or {}
    ids = body.get("material_ids", [])
    if not ids:
        return jsonify({"error": "material_ids is required", "code": 400}), 400
    if len(ids) > 20:
        return jsonify({"error": "Cannot bulk-download more than 20 files at once", "code": 400}), 400

    try:
        res = supabase.table("materials").select("id, file_path, file_name").in_("id", ids).execute()
    except Exception as e:
        return jsonify({"error": str(e), "code": 500}), 500

    results = []
    for row in res.data:
        try:
            signed = supabase.storage.from_("course-materials").create_signed_url(
                row["file_path"], 3600
            )
            url = _extract_signed_url(signed)
            if url:
                results.append({"id": row["id"], "file_name": row["file_name"], "url": url})
        except Exception as e:
            print(f"[download-all] Failed for {row['file_path']}: {e}")

    return jsonify(results), 200


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
