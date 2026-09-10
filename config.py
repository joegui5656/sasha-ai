import os

class Config:
    # Ollama Local Settings
    DEFAULT_TEXT_MODEL = os.getenv("DEFAULT_TEXT_MODEL", "mistral")
    DEFAULT_VISION_MODEL = os.getenv("DEFAULT_VISION_MODEL", "llava")
    
    # Common Settings
    MAX_FILE_CHARS = 4000
    HOST = "127.0.0.1"
    PORT = 5000
    DEBUG = True