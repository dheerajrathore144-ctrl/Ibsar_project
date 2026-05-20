from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token
from database import db
from auth.models import User
from config import Config
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

auth_bp = Blueprint("auth", __name__)

# -----------------------------
# Existing Register Route
# -----------------------------
@auth_bp.route("/register", methods=["POST"])
def register():
    data = request.json
    if User.query.filter_by(email=data["email"]).first():
        return jsonify({"error": "User already exists"}), 400

    user = User(email=data["email"])
    user.set_password(data["password"])

    db.session.add(user)
    db.session.commit()

    return jsonify({"message": "Registration successful"})

# -----------------------------
# Existing Login Route
# -----------------------------
@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.json
    user = User.query.filter_by(email=data["email"]).first()

    if not user or not user.check_password(data["password"]):
        return jsonify({"error": "Invalid credentials"}), 401

    token = create_access_token(identity=user.id)
    return jsonify({"token": token})

# -----------------------------
# NEW: Google Login Route
# -----------------------------
@auth_bp.route("/google", methods=["POST"])
def google_login():
    """
    Frontend should send POST request with JSON:
    {
        "token": "<Google ID Token from frontend>"
    }
    """
    data = request.json
    token = data.get("token")

    if not token:
        return jsonify({"error": "Token is missing"}), 400

    try:
        # Verify the token with Google
        idinfo = id_token.verify_oauth2_token(
            token,
            google_requests.Request(),
            Config.GOOGLE_CLIENT_ID
        )

        # Get email from token
        email = idinfo.get("email")

        if not email:
            return jsonify({"error": "Unable to get email from Google"}), 400

        # Check if user exists, else create
        user = User.query.filter_by(email=email).first()
        if not user:
            user = User(email=email)
            db.session.add(user)
            db.session.commit()

        # Create JWT token
        jwt_token = create_access_token(identity=user.id)
        return jsonify({"token": jwt_token, "email": email})

    except ValueError:
        return jsonify({"error": "Invalid Google token"}), 401
