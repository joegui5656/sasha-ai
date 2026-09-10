from flask import Flask
from config import Config
from routes.chat_routes import chat_bp

def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)
    app.register_blueprint(chat_bp)
    return app

if __name__ == "__main__":
    app = create_app()
    app.run(host=Config.HOST, port=Config.PORT, debug=Config.DEBUG)