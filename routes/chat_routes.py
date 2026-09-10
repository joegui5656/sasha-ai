from flask import Blueprint, render_template, request, jsonify, Response
from services.llm_service import LLMService

chat_bp = Blueprint("chat", __name__)
llm_service = LLMService()

@chat_bp.route("/")
def home():
    return render_template("index.html")

@chat_bp.route("/api/chat", methods=["POST"])
def chat():
    data = request.get_json(silent=True) or {}
    user_message = data.get("message", "").strip()
    file_contexts = data.get("file_contexts", [])
    images = data.get("images", [])

    if not user_message and not file_contexts and not images:
        return jsonify({"error": "No input provided"}), 400

    stream = llm_service.generate_stream(user_message, file_contexts, images)
    return Response(stream, mimetype="text/event-stream")