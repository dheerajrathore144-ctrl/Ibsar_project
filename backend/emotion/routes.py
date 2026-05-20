from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from emotion.ai_engine import analyze_emotion_from_base64

emotion_bp = Blueprint("emotion", __name__)


@emotion_bp.route("/analyze", methods=["POST"])
@jwt_required()
def analyze_emotion():
    """
    Receives webcam image from frontend
    Returns emotion dashboard data
    """
    data = request.get_json()
    image = data.get("image")

    if not image:
        return jsonify({"error": "Image data missing"}), 400

    result = analyze_emotion_from_base64(image)
    result["user"] = get_jwt_identity()

    return jsonify(result), 200
