import ollama
from config import Config

class OllamaService:
    @staticmethod
    def determine_model(images: list) -> str:
        """Route to vision model if images exist, otherwise use text model."""
        return Config.DEFAULT_VISION_MODEL if images else Config.DEFAULT_TEXT_MODEL

    @staticmethod
    def build_prompt(user_message: str, file_contexts: list) -> str:
        """Construct prompt incorporating multi-file context."""
        system_prompt = "You are Sasha AI, a helpful local AI assistant. Analyze provided inputs clearly.\n\n"
        full_prompt = system_prompt

        if file_contexts:
            full_prompt += "[ATTACHED FILES DATA]:\n"
            for idx, file_obj in enumerate(file_contexts, 1):
                name = file_obj.get("name", f"file_{idx}.txt")
                content = file_obj.get("content", "")[:Config.MAX_FILE_CHARS]
                full_prompt += f"--- File {idx}: {name} ---\n{content}\n\n"

        full_prompt += f"User: {user_message if user_message else 'Analyze the attached inputs.'}\nSasha AI:"
        return full_prompt

    @classmethod
    def generate_stream(cls, user_message: str, file_contexts: list, images: list):
        """Stream response generator calling Ollama API."""
        selected_model = cls.determine_model(images)
        full_prompt = cls.build_prompt(user_message, file_contexts)

        try:
            response = ollama.generate(
                model=selected_model,
                prompt=full_prompt,
                images=images if images else None,
                stream=True
            )
            for chunk in response:
                token = chunk.get("response", "")
                yield f"data: {token}\n\n"
        except Exception as e:
            yield f"data: Error with model '{selected_model}': {str(e)}\n\n"