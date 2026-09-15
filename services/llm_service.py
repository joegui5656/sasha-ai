import psutil
import ollama
from config import Config

class LLMService:
    def __init__(self):
        # Lazy load RAGService to prevent AppLocker/DLL restrictions from crashing application startup
        self.rag_service = None
        try:
            from services.rag_service import RAGService
            self.rag_service = RAGService()
        except Exception as e:
            print(f"[Warning] RAG Service bypassed due to system policy restriction: {e}")

    @staticmethod
    def _get_system_instruction() -> str:
        return (
            "You are Sasha AI, an executive-level data analyst assistant.\n\n"
            "STRICT META-RESPONSE RULES:\n"
            "1. NEVER explain how you process data, never mention 'simulating outputs', and NEVER mention 'JSON', 'data structures', 'codeblocks', or 'Pareto' in your conversational text.\n"
            "2. If asked what you can do, your capabilities, or what model you use, respond ONLY with the exact sentence: 'I am an AI assistant designed to generate analytical insights, observations, and recommendations, and can output analytical visual tools such as tables, and charts.' Stop immediately after this sentence. DO NOT generate examples, sample tables, or charts unless the user explicitly provides data or asks for an example.\n"
            "3. For actual data analysis requests, state ONLY direct analytical insights, key observations, and actionable recommendations.\n"
            "4. ONLY generate JSON codeblocks for visual elements when analyzing actual user data or when explicitly asked for a visualization.\n\n"
            "JSON STRUCTURE EXAMPLES (FOR INSTRUCTION ONLY - DO NOT OUTPUT UNLESS DATA IS PROVIDED):\n"
            "```json\n"
            "{\n"
            '  "renderType": "table",\n'
            '  "title": "Summary Table",\n'
            '  "headers": ["Metric", "Value"],\n'
            '  "rows": [["Pass Rate", "72%"]]\n'
            "}\n"
            "```\n"
            "```json\n"
            "{\n"
            '  "renderType": "pareto",\n'
            '  "title": "Category Analysis",\n'
            '  "labels": ["Tech Support", "Billing", "Access"],\n'
            '  "data": [46, 24, 15]\n'
            "}\n"
            "```"
        )

    def _select_optimal_model(self, is_image_present: bool) -> str:
        if is_image_present:
            return Config.DEFAULT_VISION_MODEL  # Defaults to 'llava'
            
        free_ram_gb = psutil.virtual_memory().available / (1024 ** 3)
        total_ram_gb = psutil.virtual_memory().total / (1024 ** 3)
        
        MIN_RAM_FOR_20B_GB = 14.0
        
        if free_ram_gb >= MIN_RAM_FOR_20B_GB:
            print(f"[Model Allocation] Resource check passed ({free_ram_gb:.1f} GB free). Routing to 'gpt20b'.")
            return "gpt20b"
        else:
            print(f"[Model Allocation] Resource constrained ({free_ram_gb:.1f} GB free / {total_ram_gb:.1f} GB total). Routing to default text model.")
            return getattr(Config, 'DEFAULT_TEXT_MODEL', 'mistral')

    def generate_stream(self, user_message: str, file_contexts: list, images: list):
        selected_model = self._select_optimal_model(bool(images))
        
        content_body = ""
        
        # 1. Query RAG vector store if initialized
        if user_message and self.rag_service:
            try:
                retrieved_context = self.rag_service.query_context(user_message)
                if retrieved_context:
                    content_body += f"[RETRIEVED KNOWLEDGE BASE CONTEXT]:\n{retrieved_context}\n\n"
            except Exception as e:
                print(f"[RAG Retrieval Error]: {e}")

        # 2. Add attached document contexts
        if file_contexts:
            content_body += "[ATTACHED FILES DATA]:\n"
            for idx, file_obj in enumerate(file_contexts, 1):
                name = file_obj.get("name", f"file_{idx}.txt")
                content = file_obj.get("content", "")[:Config.MAX_FILE_CHARS]
                content_body += f"--- File {idx}: {name} ---\n{content}\n\n"
        
        content_body += user_message if user_message else "Analyze the attached inputs."

        user_payload = {
            "role": "user",
            "content": content_body
        }

        if images:
            user_payload["images"] = images

        messages = [
            {"role": "system", "content": self._get_system_instruction()},
            user_payload
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