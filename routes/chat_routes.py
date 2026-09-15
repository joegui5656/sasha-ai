from flask import Blueprint, request, Response
from services.llm_service import LLMService

chat_bp = Blueprint('chat', __name__)

@chat_bp.route('/api/chat', methods=['POST'])
def chat():
    data = request.json or {}
    history = data.get('history', [])  # Array of {role: 'user'|'assistant', content: '...'}
    user_message = data.get('message', '')
    file_contexts = data.get('file_contexts', [])
    images = data.get('images', [])

    def generate():
        for chunk in LLMService.generate_stream(user_message, history, file_contexts, images):
            safe_chunk = chunk.replace('\n', '\\n')
            yield f"data: {safe_chunk}\n\n"

    return Response(generate(), mimetype='text/event-stream')