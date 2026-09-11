import os
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

@chat_bp.route("/api/ingest", methods=["POST"])
def ingest():
    if 'file' not in request.files:
        return jsonify({"error": "No file uploaded"}), 400
        
    file = request.files['file']
    upload_dir = "data/uploads"
    os.makedirs(upload_dir, exist_ok=True)
    
    file_path = os.path.join(upload_dir, file.filename)
    file.save(file_path)
    
    chunks_indexed = llm_service.rag_service.ingest_document(file_path, file.filename)
    return jsonify({"message": f"Successfully indexed {file.filename}", "chunks": chunks_indexed})