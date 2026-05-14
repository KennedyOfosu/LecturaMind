"""
app.py — LecturaMind Flask application entry point.
Registers all blueprints, CORS, and Socket.IO event handlers.
"""

from flask import Flask, jsonify
from flask_cors import CORS
from flask_socketio import SocketIO
from werkzeug.exceptions import RequestEntityTooLarge
from config import Config

app = Flask(__name__)
app.config["SECRET_KEY"] = (Config.SUPABASE_SERVICE_KEY or "fallback-secret")[:32]
app.config["MAX_CONTENT_LENGTH"] = 10 * 1024 * 1024  # 10 MB

# Allow all origins — safe for Bearer token auth (no cookies used)
CORS(
    app,
    resources={r"/api/*": {"origins": "*"}},
    allow_headers=["Content-Type", "Authorization"],
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
)

allowed_origins = "*"

# Gevent mode — required for Socket.IO WebSocket support on Render (gunicorn -k gevent)
socketio = SocketIO(
    app,
    cors_allowed_origins="*",
    async_mode="gevent",
    logger=True,
    engineio_logger=True,
)

# Register blueprints
from routes.auth import auth_bp
from routes.courses import courses_bp
from routes.materials import materials_bp
from routes.announcements import announcements_bp
from routes.chatbot import chatbot_bp
from routes.quiz import quiz_bp
from routes.dashboard import dashboard_bp
from routes.assignments import assignments_bp
from routes.profile import profile_bp

app.register_blueprint(auth_bp, url_prefix="/api/auth")
app.register_blueprint(courses_bp, url_prefix="/api/courses")
app.register_blueprint(materials_bp, url_prefix="/api/materials")
app.register_blueprint(announcements_bp, url_prefix="/api/announcements")
app.register_blueprint(chatbot_bp, url_prefix="/api/chatbot")
app.register_blueprint(quiz_bp, url_prefix="/api/quiz")
app.register_blueprint(dashboard_bp, url_prefix="/api/dashboard")
app.register_blueprint(assignments_bp, url_prefix="/api/assignments")
app.register_blueprint(profile_bp, url_prefix="/api/profile")

# Register Socket.IO events
from sockets.events import register_socket_events
register_socket_events(socketio)

# Ensure the course-materials storage bucket exists
try:
    from services.file_service import ensure_storage_bucket
    ensure_storage_bucket()
except Exception as _e:
    print(f"[startup] storage bucket init skipped: {_e}")


@app.errorhandler(RequestEntityTooLarge)
def handle_file_too_large(e):
    return jsonify({
        "error": "File is too large. Maximum allowed size is 10 MB.",
        "code": 413,
    }), 413


@app.get("/api/health")
def health():
    """Health check — also confirms env vars are loaded."""
    return jsonify({
        "status": "ok",
        "service": "LecturaMind API",
        "supabase_url_set": bool(Config.SUPABASE_URL),
        "service_key_set": bool(Config.SUPABASE_SERVICE_KEY),
        "openai_key_set": bool(Config.OPENAI_API_KEY),
        "frontend_url": Config.FRONTEND_URL,
        "allowed_origins": allowed_origins,
    }), 200


@app.get("/api/health/ai")
def health_ai():
    """Diagnostic: test OpenAI connectivity. Visit this URL to check if AI is working."""
    if not Config.OPENAI_API_KEY:
        return jsonify({"status": "error", "reason": "OPENAI_API_KEY is not set"}), 500
    try:
        from openai import OpenAI
        client = OpenAI(api_key=Config.OPENAI_API_KEY)
        resp = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[{"role": "user", "content": "Say OK"}],
            max_tokens=5,
        )
        return jsonify({"status": "ok", "response": resp.choices[0].message.content.strip()}), 200
    except Exception as e:
        return jsonify({"status": "error", "reason": str(e)}), 500


@app.errorhandler(404)
def not_found(e):
    return jsonify({"error": "Endpoint not found", "code": 404}), 404


@app.errorhandler(405)
def method_not_allowed(e):
    return jsonify({"error": "Method not allowed", "code": 405}), 405


@app.errorhandler(500)
def internal_error(e):
    return jsonify({"error": "Internal server error", "code": 500}), 500


if __name__ == "__main__":
    socketio.run(app, host="0.0.0.0", port=Config.FLASK_PORT, debug=(Config.FLASK_ENV == "development"))
