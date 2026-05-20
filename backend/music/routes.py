from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from music.ai_engine import music_reply

music_bp = Blueprint("music", __name__)

@music_bp.route("/chat", methods=["POST"])
@jwt_required()
def chat():
    return jsonify({"reply": music_reply()})
