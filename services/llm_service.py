import ollama
from config import Config

class LLMService:
    @staticmethod
    def _get_system_instruction() -> str:
        return (
            "You are Sasha AI, a relaxed, conversational, and direct local AI assistant. "
            "Talk like a helpful peer. Keep casual replies short, warm, and natural. "
            "NEVER vomit JSON templates, code blocks, or system instructions when answering casual questions or describing your abilities.\n\n"
            "VISUAL OUTPUT RULE:\n"
            "ONLY output a JSON visual block when the user explicitly provides data or asks you to generate a chart, table, or KPI summary. "
            "When generating visuals, talk normally first, then place ONE JSON block at the very end using valid keys:\n"
            "- Charts: {\"type\": \"bar|line|pie|doughnut|radar\", \"title\": \"Title\", \"labels\": [\"A\", \"B\"], \"data\": [10, 20]}\n"
            "- Multi-series: {\"type\": \"line\", \"title\": \"Title\", \"labels\": [\"Q1\", \"Q2\"], \"datasets\": [{\"label\": \"2025\", \"data\": [10, 20]}]}\n"
            "- KPI Cards: {\"type\": \"kpi\", \"metrics\": [{\"label\": \"Metric\", \"value\": \"100\"}]}\n"
            "- Tables: {\"type\": \"table\", \"headers\": [\"Col1\", \"Col2\"], \"rows\": [[\"Val1\", \"Val2\"]]}"
        )

    def generate_stream(self, user_message: str, file_contexts: list, images: list):
        selected_model = Config.DEFAULT_VISION_MODEL if images else Config.DEFAULT_TEXT_MODEL
        
        content_body = ""
        if file_contexts:
            content_body += "[ATTACHED FILES DATA]:\n"
            for idx, file_obj in enumerate(file_contexts, 1):
                name = file_obj.get("name", f"file_{idx}.txt")
                content = file_obj.get("content", "")[:Config.MAX_FILE_CHARS]
                content_body += f"--- File {idx}: {name} ---\n{content}\n\n"
        
        content_body += user_message if user_message else "Analyze the attached inputs."

        messages = [
            {"role": "system", "content": self._get_system_instruction()},
            {"role": "user", "content": content_body}
        ]

        try:
            response = ollama.chat(
                model=selected_model,
                messages=messages,
                stream=True
            )
            for chunk in response:
                token = chunk.get("message", {}).get("content", "")
                if token:
                    yield f"data: {token}\n\n"
        except Exception as e:
            yield f"data: Error executing model '{selected_model}': {str(e)}\n\n"