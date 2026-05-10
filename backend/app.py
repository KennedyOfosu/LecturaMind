"""
app.py — LecturaMind Flask application entry point.
Registers all blueprints, CORS, and Socket.IO event handlers.
"""

from flask import Flask, jsonify
from flask_cors import CORS
from flask_socketio import SocketIO
from config import Config

app = Flask(__name__)
app.config["SECRET_KEY"] = (Config.SUPABASE_SERVICE_KEY or "fallback-secret")[:32]

# Accept requests from localhost (dev) and any Vercel/custom domain (prod)
allowed_origins = [
    "http://localhost:5173",
    "http://localhost:3000",
]
if Config.FRONTEND_URL:
    allowed_origins.append(Config.FRONTEND_URL)

CORS(
    app,
    resources={r"/api/*": {"origins": allowed_origins}},
    supports_credentials=True,
    allow_headers=["Content-Type", "Authorization"],
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
)

# Threading mode — works with gunicorn on Render, no eventlet needed
socketio = SocketIO(
    app,
    cors_allowed_origins=allowed_origins,
    async_mode="threading",
    logger=False,
    engineio_logger=False,
)

# Register blueprints
from routes.auth import auth_bp
from routes.courses import courses_bp
from routes.materials import materials_bp
from routes.announcements import announcements_bp
from routes.chatbot import chatbot_bp
from routes.quiz import quiz_bp
from routes.dashboard import dashboard_bp

app.register_blueprint(auth_bp, url_prefix="/api/auth")
app.register_blueprint(courses_bp, url_prefix="/api/courses")
app.register_blueprint(materials_bp, url_prefix="/api/materials")
app.register_blueprint(announcements_bp, url_prefix="/api/announcements")
app.register_blueprint(chatbot_bp, url_prefix="/api/chatbot")
app.register_blueprint(quiz_bp, url_prefix="/api/quiz")
app.register_blueprint(dashboard_bp, url_prefix="/api/dashboard")

# Register Socket.IO events
from sockets.events import register_socket_events
register_socket_events(socketio)


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
