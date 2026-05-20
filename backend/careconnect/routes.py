from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required

careconnect_bp = Blueprint("careconnect", __name__)

@careconnect_bp.route("/doctors", methods=["GET"])
@jwt_required()
def doctors():
    return jsonify([
        {"name": "Dr. Emily Watson", "specialty": "Stress"},
        {"name": "Dr. Michael Brown", "specialty": "Depression"}
    ])
