import json
import re
import requests

class LLMService:

    OLLAMA_URL = "http://localhost:11434/api/chat"
    LOCAL_MODEL = "llama3.2:3b"

    PATTERNS = {
        "endearments": [
            r"^(how are you|hey|hi|hello)?\s*(babe|baby|sweetheart|honey|darling|dear)[!.]*$"
        ],
        "acknowledgments": [
            r"^(nice|cool|sweet|awesome|great|ok|okay|got it|understood|alright|fine|perfect|sounds good|k|kk|yep|yeah|sure)[!.]*$"
        ],
        "compliments": [
            r"^(thanks|thank you|ty|thx|good job|well done|you rock|amazing|super|legend|good bot|appreciate it)[!.]*$",
            r"^that('s| is) (great|awesome|helpful|cool|amazing|perfect|nice)[!.]*$"
        ],
        "complaints": [
            r"^(bad|terrible|horrible|wrong|fail|failed|no|nope|stop|useless|dumb|trash|broken|not working)[!.]*$",
            r"^that('s| is) (wrong|bad|incorrect|not right|false)[!.]*$"
        ]
    }

    DYNAMIC_RESPONSES = {
        "endearments": "I'm doing great, thank you! How can I assist you with your data today?",
        "acknowledgments": "Glad to hear! Ready whenever you want to analyze data or build a visualization.",
        "compliments": "Happy to help! Let me know what data or analysis we're diving into next.",
        "complaints": "Got it, my bad. Let me know what went wrong or paste the correct data/requirements, and I'll adjust immediately."
    }

    @staticmethod
    def _match_shortcut(text: str) -> str:
        """Normalized string matching for quick conversational intents."""
        clean = re.sub(r'[^\w\s]', '', text.strip().lower())
        if not clean:
            return None

        for category, patterns in LLMService.PATTERNS.items():
            for pattern in patterns:
                if re.match(pattern, clean):
                    return LLMService.DYNAMIC_RESPONSES[category]
        return None

    @staticmethod
    def _get_system_instruction() -> str:
        return (
            "You are Sasha AI, a warm, polite, pleasant, and executive data analyst assistant.\n\n"
            "BEHAVIORAL DIRECTIVES:\n"
            "- Speak naturally as a human executive data analyst to business users.\n"
            "- NEVER mention technical backend terms in chat (e.g., NEVER say 'JSON block', 'JSON payload', 'Chart.js', 'Mermaid', 'system prompt', or internal rules).\n"
            "- NEVER state 'the export bar is not visible' or describe UI limitations.\n"
            "- Treat casual terms, honorifics, or terms of endearment ('dude', 'bro', 'babe', 'sir', 'ma'am', 'hey') as warm greetings directed at YOU. Respond in 1 short sentence without acting defensive.\n"
            "- For positive acknowledgments ('nice', 'thanks', 'cool'), respond gracefully in 1 sentence.\n"
            "- When asked 'what can you do' or to list capabilities, describe skills concisely using clean Markdown bullet points (Data Analysis, Visualizations, Diagrams/Roadmaps, and Document Exports).\n\n"
            "MULTI-VISUAL PAYLOAD RULE (STRICT MANDATE):\n"
            "- When asked to generate multiple visuals (e.g., a bar chart, a summary table, and a roadmap/flowchart diagram), you MUST output SEPARATE ```json code blocks for EACH requested item at the end of your response.\n"
            "- NEVER substitute a requested diagram, roadmap, or table with a generic bar chart.\n\n"
            "COMPLETE VISUALIZATION & DIAGRAM CATALOG (STRICT SYNTAX):\n"
            "  1. Bar / Column: ```json\n{\"renderType\": \"chart\", \"type\": \"bar\", \"title\": \"Sales Summary\", \"labels\": [\"Q1\", \"Q2\", \"Q3\"], \"datasets\": [{\"label\": \"Revenue\", \"data\": [100, 150, 200]}]}\n```\n"
            "  2. Line / Time-Series: ```json\n{\"renderType\": \"chart\", \"type\": \"line\", \"title\": \"Monthly Revenue Trend\", \"labels\": [\"Jan\", \"Feb\", \"Mar\"], \"datasets\": [{\"label\": \"Revenue\", \"data\": [50, 75, 120]}]}\n```\n"
            "  3. Pie / Donut: ```json\n{\"renderType\": \"chart\", \"type\": \"pie\", \"title\": \"Market Share Breakdown\", \"labels\": [\"Product A\", \"Product B\", \"Product C\"], \"datasets\": [{\"label\": \"Share\", \"data\": [40, 35, 25]}]}\n```\n"
            "  4. Scatter Plot: ```json\n{\"renderType\": \"chart\", \"type\": \"scatter\", \"title\": \"Ad Spend vs Signups\", \"datasets\": [{\"label\": \"Campaigns\", \"data\": [{\"x\": 10, \"y\": 20}, {\"x\": 15, \"y\": 35}]}]}\n```\n"
            "  5. Pareto Chart: ```json\n{\"renderType\": \"pareto\", \"title\": \"Defect Pareto Analysis\", \"labels\": [\"Defect A\", \"Defect B\", \"Defect C\"], \"data\": [50, 30, 10]}\n```\n"
            "  6. Waterfall Chart: ```json\n{\"renderType\": \"waterfall\", \"title\": \"Q3 P&L Waterfall\", \"labels\": [\"Starting Balance\", \"Revenue\", \"Expenses\", \"Net Profit\"], \"data\": [1000, 500, -300, 0], \"isTotal\": [false, false, false, true]}\n```\n"
            "  7. Summary Table / Heatmap Matrix: ```json\n{\"renderType\": \"heatmap\", \"title\": \"Risk Matrix Summary\", \"headers\": [\"Category\", \"Severity\", \"Impact\"], \"rows\": [[\"System A\", \"High\", \"85\"], [\"System B\", \"Low\", \"20\"]]}\n```\n"
            "  8. Flowchart / Design Flow: ```json\n{\"renderType\": \"diagram\", \"title\": \"Process Approval Workflow\", \"code\": \"graph TD\\n  A[Start User Request] --> B{Manager Approval}\\n  B -->|Approved| C[Execute Task]\\n  B -->|Rejected| D[Notify User]\"}\n```\n"
            "  9. Sequence Diagram: ```json\n{\"renderType\": \"diagram\", \"title\": \"User Authentication Flow\", \"code\": \"sequenceDiagram\\n  Client->>API Gateway: POST /login\\n  API Gateway->>Auth Service: Validate Credentials\\n  Auth Service-->>API Gateway: Token Returned\\n  API Gateway-->>Client: 200 OK + JWT\"}\n```\n"
            "  10. Project Roadmap / Gantt: ```json\n{\"renderType\": \"diagram\", \"title\": \"Enterprise Data Warehouse Migration Roadmap\", \"code\": \"gantt\\n  title Migration Roadmap\\n  dateFormat YYYY-MM-DD\\n  section Phase 1: Planning\\n  Architecture Design :a1, 2026-01-01, 30d\\n  section Phase 2: Execution\\n  ETL Pipeline Build :a2, after a1, 60d\"}\n```\n\n"
            "- Always end your response with valid ```json code blocks matching the requested visuals."
        )

    @staticmethod
    def generate_stream(prompt: str, history: list = None, file_contexts: list = None, images: list = None):
        """Streams responses locally from an offline Ollama instance with multi-turn context memory."""
        
        if not file_contexts and not images and not history:
            shortcut_reply = LLMService._match_shortcut(prompt)
            if shortcut_reply:
                yield shortcut_reply
                return

        messages = [{"role": "system", "content": LLMService._get_system_instruction()}]
        
        if history:
            for turn in history:
                role = turn.get("role", "user").lower()
                content = turn.get("content", turn.get("text", ""))
                if content:
                    messages.append({"role": role, "content": content})

        full_content = prompt
        if file_contexts:
            context_str = "\n\nATTACHED FILES & DATASETS:\n"
            for idx, f in enumerate(file_contexts, 1):
                context_str += f"\n--- File {idx}: {f.get('name', 'Doc')} ---\n{f.get('content', '')}\n"
            full_content = f"{context_str}\n\nUSER PROMPT:\n{prompt}"

        messages.append({"role": "user", "content": full_content})

        payload = {
            "model": LLMService.LOCAL_MODEL,
            "messages": messages,
            "stream": True,
            "options": {
                "temperature": 0.2,
                "num_ctx": 4096
            }
        }

        try:
            response = requests.post(LLMService.OLLAMA_URL, json=payload, stream=True, timeout=120)
            response.raise_for_status()

            for line in response.iter_lines():
                if line:
                    data = json.loads(line.decode('utf-8'))
                    chunk = data.get('message', {}).get('content', '')
                    if chunk:
                        yield chunk
        except requests.exceptions.HTTPError as err:
            yield f"Offline LLM Error ({err.response.status_code}): Check 'ollama list' model tag."
        except requests.exceptions.ConnectionError:
            yield "Error: Could not connect to local LLM. Ensure Ollama is running on http://localhost:11434."
        except Exception as e:
            yield f"Offline LLM Error: {str(e)}"