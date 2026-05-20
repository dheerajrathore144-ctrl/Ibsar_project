# ============================================
# FINAL BACKEND (STABLE + SMART + SAMPLING)
# ============================================

import base64
import os
import json
import hashlib
import hmac
import smtplib
import html
import tempfile
import sys
from email.message import EmailMessage
from collections import deque, Counter
import time
from urllib import error as urllib_error
from urllib import request as urllib_request

BACKEND_DIR = os.path.dirname(__file__)
VENDOR_DIR = os.path.join(BACKEND_DIR, "_vendor")
VENDOR_FLASK_INIT = os.path.join(VENDOR_DIR, "flask", "__init__.py")

if os.path.isfile(VENDOR_FLASK_INIT) and VENDOR_DIR not in sys.path:
    sys.path.insert(0, VENDOR_DIR)

from flask import Flask, request, jsonify
from flask_cors import CORS

np = None
cv2 = None
mp = None
DeepFace = None

def load_local_env():
    env_path = os.path.join(os.path.dirname(__file__), ".env")
    if not os.path.exists(env_path):
        return

    with open(env_path, "r", encoding="utf-8") as env_file:
        for raw_line in env_file:
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue

            key, value = line.split("=", 1)
            key = key.strip()
            value = value.strip().strip('"').strip("'")

            if key and key not in os.environ:
                os.environ[key] = value

load_local_env()

app = Flask(__name__)
CORS(app)

# ============================================
# FACE DETECTOR
# ============================================

mp_face_detection = None
face_detector = None
EMOTION_DEPENDENCIES_READY = False
EMOTION_DEPENDENCIES_ERROR = None

# ============================================
# GLOBAL STATE (SESSION BASED)
# ============================================

FRAME_HISTORY = deque(maxlen=10)
LAST_EMOTION = "Neutral"
LAST_CONFIDENCE = 0
LAST_PROCESSED_TIME = 0
LAST_FACE_DETECTED = False

PROCESS_INTERVAL = 0.0  # analyze each request; do not reuse prior frame emotion
MIN_FRAMES_REQUIRED = 3
VOICE_PIPELINE = None
VOICE_PIPELINE_ERROR = None
RAZORPAY_API_BASE = "https://api.razorpay.com/v1"

def ensure_emotion_dependencies():
    global np, cv2, mp, DeepFace
    global mp_face_detection, face_detector
    global EMOTION_DEPENDENCIES_READY, EMOTION_DEPENDENCIES_ERROR

    if EMOTION_DEPENDENCIES_READY:
        return True

    if EMOTION_DEPENDENCIES_ERROR is not None:
        return False

    try:
        import numpy as _np
        import cv2 as _cv2
        import mediapipe as _mp
        from deepface import DeepFace as _DeepFace

        np = _np
        cv2 = _cv2
        mp = _mp
        DeepFace = _DeepFace

        mp_face_detection = mp.solutions.face_detection
        face_detector = mp_face_detection.FaceDetection(
            model_selection=0, min_detection_confidence=0.35
        )

        print("Loading model...")
        try:
            DeepFace.analyze(
                np.zeros((224, 224, 3)), actions=["emotion"], enforce_detection=False
            )
        except:
            pass
        print("Model ready")

        EMOTION_DEPENDENCIES_READY = True
        return True
    except Exception as exc:
        EMOTION_DEPENDENCIES_ERROR = str(exc)
        print("Emotion model dependencies are not installed. Payment and email routes remain available.")
        return False

# ============================================
# RESET API
# ============================================

@app.route("/api/reset_emotion", methods=["POST"])
def reset_emotion():
    global FRAME_HISTORY, LAST_EMOTION, LAST_CONFIDENCE, LAST_PROCESSED_TIME, LAST_FACE_DETECTED

    FRAME_HISTORY.clear()
    LAST_EMOTION = "Neutral"
    LAST_CONFIDENCE = 0
    LAST_PROCESSED_TIME = 0
    LAST_FACE_DETECTED = False

    return jsonify({"status": "reset_done"})


# ============================================
# IMAGE DECODER
# ============================================

def decode_image(data):
    if cv2 is None or np is None:
        if not ensure_emotion_dependencies():
            return None

    if cv2 is None or np is None:
        return None

    try:
        data = data.split(",")[1]
        img = base64.b64decode(data)
        np_arr = np.frombuffer(img, np.uint8)
        return cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
    except:
        return None


# ============================================
# FACE EXTRACTION
# ============================================

def extract_face(img):
    if cv2 is None or face_detector is None:
        if not ensure_emotion_dependencies():
            return None

    if cv2 is None or face_detector is None:
        return None

    try:
        def build_detection_variants(frame):
            variants = [frame]
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            brightness = float(np.mean(gray))

            if brightness < 120:
                alpha = 1.15 if brightness > 90 else 1.3
                beta = 18 if brightness > 90 else 28
                lifted = cv2.convertScaleAbs(frame, alpha=alpha, beta=beta)
                variants.append(lifted)

                lab = cv2.cvtColor(lifted, cv2.COLOR_BGR2LAB)
                l_channel, a_channel, b_channel = cv2.split(lab)
                clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
                l_channel = clahe.apply(l_channel)
                boosted = cv2.merge((l_channel, a_channel, b_channel))
                variants.append(cv2.cvtColor(boosted, cv2.COLOR_LAB2BGR))

            return variants

        for candidate in build_detection_variants(img):
            rgb = cv2.cvtColor(candidate, cv2.COLOR_BGR2RGB)
            results = face_detector.process(rgb)

            if not results.detections:
                continue

            detection = max(
                results.detections,
                key=lambda item: item.location_data.relative_bounding_box.width
                * item.location_data.relative_bounding_box.height,
            )
            bbox = detection.location_data.relative_bounding_box

            h, w, _ = candidate.shape
            box_width = max(1, int(bbox.width * w))
            box_height = max(1, int(bbox.height * h))
            center_x = int((bbox.xmin + (bbox.width / 2)) * w)
            center_y = int((bbox.ymin + (bbox.height / 2)) * h)
            width = int(box_width * 1.45)
            height = int(box_height * 1.6)
            x = max(0, center_x - (width // 2))
            y = max(0, center_y - (height // 2))
            x2 = min(w, x + width)
            y2 = min(h, y + height)

            face = candidate[y:y2, x:x2]

            if face.size > 0:
                return cv2.resize(face, (224, 224))

        return None
    except:
        return None


def build_emotion_fallback_frame(img):
    if cv2 is None:
        return None

    try:
        h, w, _ = img.shape
        if h <= 0 or w <= 0:
            return None

        side = int(min(h, w) * 0.82)
        center_x = w // 2
        center_y = h // 2
        x1 = max(0, center_x - side // 2)
        y1 = max(0, center_y - side // 2)
        x2 = min(w, x1 + side)
        y2 = min(h, y1 + side)
        fallback = img[y1:y2, x1:x2]

        if fallback.size == 0:
            return None

        gray = cv2.cvtColor(fallback, cv2.COLOR_BGR2GRAY)
        brightness = float(np.mean(gray))
        if brightness < 120:
            alpha = 1.12 if brightness > 90 else 1.25
            beta = 14 if brightness > 90 else 24
            fallback = cv2.convertScaleAbs(fallback, alpha=alpha, beta=beta)

        return cv2.resize(fallback, (224, 224))
    except:
        return None


# ============================================
# STRESS LOGIC
# ============================================

def detect_stress(emotions):
    sad = emotions.get("sad", 0)
    angry = emotions.get("angry", 0)
    fear = emotions.get("fear", 0)
    disgust = emotions.get("disgust", 0)

    score = (sad + angry + fear + disgust) / 4 / 10

    if score >= 6.5:
        return "Stressed", score

    return None, score


# ============================================
# EMOTION STABILITY
# ============================================

def get_stable_emotion(current_emotion, confidence):
    global LAST_EMOTION, LAST_CONFIDENCE

    if current_emotion != LAST_EMOTION:
        LAST_EMOTION = current_emotion
        LAST_CONFIDENCE = confidence
        FRAME_HISTORY.clear()
        return current_emotion, confidence

    FRAME_HISTORY.append(current_emotion)

    counts = Counter(FRAME_HISTORY)
    dominant, _ = counts.most_common(1)[0]

    LAST_EMOTION = dominant
    LAST_CONFIDENCE = confidence

    return dominant, confidence


def load_voice_pipeline():
    global VOICE_PIPELINE, VOICE_PIPELINE_ERROR

    if VOICE_PIPELINE is not None or VOICE_PIPELINE_ERROR is not None:
        return VOICE_PIPELINE

    try:
        from transformers import pipeline
        VOICE_PIPELINE = pipeline(
            task="audio-classification",
            model="superb/hubert-large-superb-er",
            top_k=5
        )
    except Exception as exc:
        VOICE_PIPELINE_ERROR = str(exc)
        VOICE_PIPELINE = None

    return VOICE_PIPELINE


def normalize_voice_label(raw_label):
    label = (raw_label or "").strip().lower()

    label_map = {
        "ang": "Angry",
        "anger": "Angry",
        "sad": "Sad",
        "hap": "Happy",
        "happy": "Happy",
        "neu": "Neutral",
        "neutral": "Neutral",
        "fear": "Fearful",
        "fearful": "Fearful",
        "calm": "Calm",
        "surprise": "Surprised",
        "surprised": "Surprised",
    }

    return label_map.get(label, raw_label or "Unknown")


def summarize_voice_prediction(result, waveform):
    predictions = result if isinstance(result, list) else [result]
    ranked = []

    for item in predictions:
        label = normalize_voice_label(item.get("label", "Unknown"))
        confidence = float(item.get("score", 0)) * 100
        ranked.append({
            "label": label,
            "confidence": round(confidence, 2),
            "rawLabel": item.get("label", "Unknown"),
        })

    ranked.sort(key=lambda item: item["confidence"], reverse=True)
    top = ranked[0] if ranked else {"label": "Neutral", "confidence": 0, "rawLabel": "Unknown"}
    runner_up = ranked[1] if len(ranked) > 1 else {"label": "Neutral", "confidence": 0}
    neutral_like_confidence = max(
        (
            item["confidence"]
            for item in ranked
            if item["label"] in {"Neutral", "Calm"}
        ),
        default=0,
    )

    rms = (
        float(np.sqrt(np.mean(np.square(waveform))))
        if np is not None and waveform is not None and len(waveform)
        else 0.0
    )
    duration_seconds = (len(waveform) / 16000.0) if waveform is not None and len(waveform) else 0.0
    confidence_gap = top["confidence"] - runner_up["confidence"]

    tone = top["label"]
    confidence = top["confidence"]

    # Weak / short speech samples are safer to treat as neutral than as a hard emotion.
    if duration_seconds < 1.2 or rms < 0.015:
        tone = "Neutral"
        confidence = 0
    elif top["label"] in {"Sad", "Angry", "Fearful"}:
        # Negative voice labels are the noisiest on weak audio. Require a stronger lead.
        if top["confidence"] < 72 or confidence_gap < 15 or neutral_like_confidence >= top["confidence"] - 8:
            tone = "Neutral"
            confidence = 0
    elif top["confidence"] < 45:
        tone = "Neutral"
        confidence = 0

    return {
        "tone": tone,
        "confidence": round(confidence),
        "rawLabel": top["rawLabel"],
        "topPredictions": ranked[:3],
    }


def razorpay_credentials():
    key_id = os.getenv("RAZORPAY_KEY_ID", "").strip()
    key_secret = os.getenv("RAZORPAY_KEY_SECRET", "").strip()
    return key_id, key_secret


def razorpay_is_configured():
    key_id, key_secret = razorpay_credentials()
    return bool(key_id and key_secret)


def razorpay_headers():
    key_id, key_secret = razorpay_credentials()
    token = base64.b64encode(f"{key_id}:{key_secret}".encode("utf-8")).decode("utf-8")
    return {
        "Authorization": f"Basic {token}",
        "Content-Type": "application/json",
    }


def call_razorpay_api(method, path, payload=None):
    url = f"{RAZORPAY_API_BASE}{path}"
    data = None

    if payload is not None:
        data = json.dumps(payload).encode("utf-8")

    req = urllib_request.Request(
        url,
        data=data,
        headers=razorpay_headers(),
        method=method,
    )

    try:
        with urllib_request.urlopen(req, timeout=20) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib_error.HTTPError as exc:
        raw = exc.read().decode("utf-8", errors="ignore")
        try:
            parsed = json.loads(raw)
            message = (
                parsed.get("error", {}).get("description")
                or parsed.get("error", {}).get("reason")
                or raw
            )
        except Exception:
            message = raw or str(exc)
        raise RuntimeError(message or "Razorpay request failed") from exc
    except urllib_error.URLError as exc:
        raise RuntimeError(str(exc.reason) or "Unable to reach Razorpay") from exc


def verify_razorpay_signature(order_id, payment_id, signature):
    _, key_secret = razorpay_credentials()
    generated_signature = hmac.new(
        key_secret.encode("utf-8"),
        f"{order_id}|{payment_id}".encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(generated_signature, signature)


@app.route("/api/payments/razorpay/order", methods=["POST"])
def create_razorpay_order():
    try:
        if not razorpay_is_configured():
            return jsonify({
                "ok": False,
                "message": "Razorpay test keys are not configured on the backend"
            }), 503

        data = request.get_json() or {}
        amount = int(data.get("amount") or 0)
        currency = str(data.get("currency") or "INR").strip().upper()
        receipt = str(data.get("receipt") or f"melomind_{int(time.time())}")[:40]
        notes = data.get("notes") if isinstance(data.get("notes"), dict) else {}

        if amount <= 0:
            return jsonify({"ok": False, "message": "amount must be greater than zero"}), 400

        order_payload = {
            "amount": amount,
            "currency": currency,
            "receipt": receipt,
            "notes": notes,
        }

        order = call_razorpay_api("POST", "/orders", order_payload)
        key_id, _ = razorpay_credentials()

        return jsonify({
            "ok": True,
            "keyId": key_id,
            "order": order,
        }), 200
    except Exception as exc:
        return jsonify({"ok": False, "message": str(exc)}), 500


@app.route("/api/payments/razorpay/verify", methods=["POST"])
def verify_razorpay_payment():
    try:
        if not razorpay_is_configured():
            return jsonify({
                "ok": False,
                "message": "Razorpay test keys are not configured on the backend"
            }), 503

        data = request.get_json() or {}
        order_id = str(data.get("orderId") or data.get("razorpay_order_id") or "").strip()
        payment_id = str(data.get("paymentId") or data.get("razorpay_payment_id") or "").strip()
        signature = str(data.get("signature") or data.get("razorpay_signature") or "").strip()

        if not order_id or not payment_id or not signature:
            return jsonify({
                "ok": False,
                "message": "orderId, paymentId and signature are required"
            }), 400

        if not verify_razorpay_signature(order_id, payment_id, signature):
            return jsonify({
                "ok": False,
                "message": "Razorpay signature verification failed"
            }), 400

        payment = call_razorpay_api("GET", f"/payments/{payment_id}")
        payment_status = str(payment.get("status") or "").lower()

        if payment_status not in {"authorized", "captured"}:
            return jsonify({
                "ok": False,
                "message": f"Payment is not successful yet. Current status: {payment_status or 'unknown'}",
                "payment": payment,
            }), 400

        return jsonify({
            "ok": True,
            "payment": {
                "id": payment.get("id"),
                "orderId": payment.get("order_id"),
                "status": payment.get("status"),
                "method": payment.get("method"),
                "amount": payment.get("amount"),
                "currency": payment.get("currency"),
                "email": payment.get("email"),
                "contact": payment.get("contact"),
            },
        }), 200
    except Exception as exc:
        return jsonify({"ok": False, "message": str(exc)}), 500


# ============================================
# MAIN API
# ============================================

@app.route("/api/live_emotion", methods=["POST"])
def live_emotion():
    global LAST_PROCESSED_TIME, LAST_EMOTION, LAST_CONFIDENCE, LAST_FACE_DETECTED

    try:
        if not ensure_emotion_dependencies():
            return jsonify({
                "emotion": "Unavailable",
                "confidence": 0,
                "face_detected": False,
                "message": EMOTION_DEPENDENCIES_ERROR or "Emotion analysis dependencies are not installed on the backend",
            }), 503

        now = time.time()

        LAST_PROCESSED_TIME = now

        data = request.json
        img = decode_image(data.get("image"))

        if img is None:
            LAST_FACE_DETECTED = False
            LAST_EMOTION = "No Face Detected"
            LAST_CONFIDENCE = 0
            return jsonify({
                "emotion": "No Face Detected",
                "confidence": 0,
                "face_detected": False,
            })

        img = cv2.flip(img, 1)
        face = extract_face(img)
        face_detected = face is not None
        analysis_frame = face if face_detected else build_emotion_fallback_frame(img)

        if analysis_frame is None:
            LAST_FACE_DETECTED = False
            LAST_EMOTION = "No Face Detected"
            LAST_CONFIDENCE = 0
            return jsonify({
                "emotion": "No Face Detected",
                "confidence": 0,
                "face_detected": False,
            })

        # ============================================
        # EMOTION ANALYSIS
        # ============================================

        result = DeepFace.analyze(
            analysis_frame,
            actions=["emotion"],
            enforce_detection=False,
            detector_backend="skip"
        )

        if isinstance(result, list):
            result = result[0]

        emotions = result["emotion"]
        dominant = result["dominant_emotion"]
        confidence = emotions[dominant]

        # ============================================
        # BALANCED EMOTION LOGIC
        # ============================================

        happy = emotions.get("happy", 0)
        sad = emotions.get("sad", 0)
        angry = emotions.get("angry", 0)
        fear = emotions.get("fear", 0)
        disgust = emotions.get("disgust", 0)
        neutral = emotions.get("neutral", 0)

        stress_score = (sad + angry + fear + disgust) / 4

        # Prefer clear positive expressions before falling into negative buckets.
        if (
            happy >= 22
            and happy >= sad
            and happy >= angry + 4
            and happy >= fear + 4
            and happy >= neutral - 8
        ):
            emotion = "Happy"
            confidence = happy

        # Strong angry / frustration signals.
        elif angry >= 28 or (angry + disgust >= 48):
            emotion = "Angry"
            confidence = angry

        elif neutral >= 38 and neutral >= sad - 4:
            emotion = "Neutral"
            confidence = neutral

        # Only call it sad when sadness very clearly dominates the frame.
        elif sad >= 60 and sad >= happy + 18 and sad >= neutral + 14:
            emotion = "Sad"
            confidence = sad

        # Stressed should be reserved for strong negative mixtures, not slight sadness.
        elif stress_score >= 42 and max(sad, angry, fear, disgust) >= 36:
            emotion = "Stressed"
            confidence = stress_score

        else:
            if dominant == "happy":
                emotion = "Happy"
                confidence = happy
            elif dominant == "neutral":
                emotion = "Neutral"
                confidence = neutral
            elif dominant == "sad":
                emotion = "Neutral" if sad < 70 else "Sad"
                confidence = neutral if sad < 70 else sad
            elif dominant == "angry":
                emotion = "Angry"
                confidence = angry
            else:
                emotion = "Neutral"
                confidence = neutral

        LAST_FACE_DETECTED = face_detected
        LAST_EMOTION = emotion
        LAST_CONFIDENCE = round(float(confidence), 2)

        return jsonify({
            "emotion": emotion,
            "confidence": LAST_CONFIDENCE,
            "face_detected": face_detected,
        })

    except Exception as e:
        print("ERROR:", e)
        LAST_FACE_DETECTED = False
        LAST_EMOTION = "No Face Detected"
        LAST_CONFIDENCE = 0

    return jsonify({
        "emotion": "No Face Detected",
        "confidence": 0,
        "face_detected": False,
    })


@app.route("/api/analyze_voice", methods=["POST"])
def analyze_voice():
    try:
        if np is None:
            return jsonify({
                "ok": False,
                "message": "Voice analysis dependencies are not installed on the backend"
            }), 503

        classifier = load_voice_pipeline()
        if classifier is None:
            return jsonify({
                "ok": False,
                "message": VOICE_PIPELINE_ERROR or "Voice model is not available"
            }), 503

        audio_file = request.files.get("audio")
        if audio_file is None:
            return jsonify({"ok": False, "message": "audio file missing"}), 400

        suffix = os.path.splitext(audio_file.filename or "voice.wav")[1] or ".wav"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
            temp_path = temp_file.name
            audio_file.save(temp_path)

        try:
            import librosa

            waveform, sample_rate = librosa.load(temp_path, sr=16000, mono=True)
            result = classifier({"array": waveform, "sampling_rate": sample_rate})
        finally:
            if os.path.exists(temp_path):
                os.remove(temp_path)

        summary = summarize_voice_prediction(result, waveform)

        return jsonify({
            "ok": True,
            "tone": summary["tone"],
            "confidence": summary["confidence"],
            "rawLabel": summary["rawLabel"],
            "topPredictions": summary["topPredictions"],
        }), 200

    except Exception as exc:
        return jsonify({"ok": False, "message": str(exc)}), 500


# ============================================
# RUN
# ============================================

@app.route("/api/send_booking_email", methods=["POST"])
def send_booking_email():
    """
    Sends CareConnect booking confirmation email.
    Requires SMTP env vars:
    SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SENDER
    """
    try:
        data = request.get_json() or {}
        to_email = data.get("userEmail")
        if not to_email:
            return jsonify({"ok": False, "message": "userEmail missing"}), 400

        smtp_host = os.getenv("SMTP_HOST")
        smtp_port = int(os.getenv("SMTP_PORT", "587"))
        smtp_user = os.getenv("SMTP_USER")
        smtp_pass = os.getenv("SMTP_PASS")
        smtp_sender = os.getenv("SMTP_SENDER", smtp_user or "")

        if not smtp_host or not smtp_user or not smtp_pass or not smtp_sender:
            return jsonify({
                "ok": False,
                "message": "SMTP is not configured on backend"
            }), 503

        psychologist = data.get("psychologist", "Your therapist")
        date = data.get("date", "TBD")
        time_slot = data.get("time", "TBD")
        session_type = data.get("type", "video")
        meet_link = data.get("meetLink", "")
        user_name = data.get("userName") or "there"
        session_price = data.get("price", "TBD")

        safe_user_name = html.escape(str(user_name))
        safe_psychologist = html.escape(str(psychologist))
        safe_date = html.escape(str(date))
        safe_time = html.escape(str(time_slot))
        safe_session_type = html.escape(str(session_type).title())
        safe_session_price = html.escape(str(session_price))
        safe_meet_link = html.escape(str(meet_link))

        msg = EmailMessage()
        msg["Subject"] = "CareConnect Session Confirmation"
        msg["From"] = smtp_sender
        msg["To"] = to_email

        body = f"""
Hello,

Your CareConnect session has been confirmed.

Psychologist: {psychologist}
Date: {date}
Time: {time_slot}
Session Type: {session_type}
Price: {session_price}
Session Link: {meet_link}

Please join a few minutes before your scheduled time.

Thanks,
MeloMind CareConnect
"""
        msg.set_content(body.strip())

        html_body = f"""
<!DOCTYPE html>
<html lang="en">
  <body style="margin:0;padding:0;background:#f4f8f7;font-family:Arial,sans-serif;color:#1f2937;">
    <div style="width:100%;background:#f4f8f7;padding:32px 16px;">
      <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #dbe7e3;border-radius:24px;overflow:hidden;box-shadow:0 18px 45px rgba(15,23,42,0.08);">
        <div style="background:linear-gradient(135deg,#dff4f2 0%,#9fd1cd 100%);padding:32px 32px 24px;">
          <table role="presentation" style="border-collapse:collapse;margin-bottom:18px;">
            <tr>
              <td style="vertical-align:middle;">
                <div style="height:44px;width:44px;border-radius:14px;background:#2f6f73;color:#ffffff;font-size:18px;font-weight:700;line-height:44px;text-align:center;">
                  M
                </div>
              </td>
              <td style="padding-left:12px;vertical-align:middle;">
                <div style="font-size:22px;font-weight:800;line-height:1;color:#183b3d;">MeloMind</div>
                <div style="margin-top:4px;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#335c5e;">
                  CareConnect
                </div>
              </td>
            </tr>
          </table>
          <div style="display:inline-block;padding:8px 14px;border-radius:999px;background:#ffffff;color:#2f6f73;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">
            Booking Confirmed
          </div>
          <h1 style="margin:18px 0 8px;font-size:30px;line-height:1.2;color:#183b3d;">
            Your session is booked
          </h1>
          <p style="margin:0;font-size:15px;line-height:1.7;color:#335c5e;">
            Hello {safe_user_name}, your CareConnect session has been successfully scheduled. Your meeting link is ready below.
          </p>
        </div>

        <div style="padding:28px 32px;">
          <div style="background:#f8fbfa;border:1px solid #dde8e4;border-radius:20px;padding:22px;">
            <h2 style="margin:0 0 18px;font-size:18px;color:#183b3d;">Session details</h2>

            <table role="presentation" style="width:100%;border-collapse:collapse;">
              <tr>
                <td style="padding:10px 0;color:#6b7280;font-size:14px;">Psychologist</td>
                <td style="padding:10px 0;color:#183b3d;font-size:14px;font-weight:700;text-align:right;">{safe_psychologist}</td>
              </tr>
              <tr>
                <td style="padding:10px 0;color:#6b7280;font-size:14px;border-top:1px solid #e6efeb;">Date</td>
                <td style="padding:10px 0;color:#183b3d;font-size:14px;font-weight:700;text-align:right;border-top:1px solid #e6efeb;">{safe_date}</td>
              </tr>
              <tr>
                <td style="padding:10px 0;color:#6b7280;font-size:14px;border-top:1px solid #e6efeb;">Time</td>
                <td style="padding:10px 0;color:#183b3d;font-size:14px;font-weight:700;text-align:right;border-top:1px solid #e6efeb;">{safe_time}</td>
              </tr>
              <tr>
                <td style="padding:10px 0;color:#6b7280;font-size:14px;border-top:1px solid #e6efeb;">Session Type</td>
                <td style="padding:10px 0;color:#183b3d;font-size:14px;font-weight:700;text-align:right;border-top:1px solid #e6efeb;">{safe_session_type}</td>
              </tr>
              <tr>
                <td style="padding:10px 0;color:#6b7280;font-size:14px;border-top:1px solid #e6efeb;">Fee</td>
                <td style="padding:10px 0;color:#183b3d;font-size:14px;font-weight:700;text-align:right;border-top:1px solid #e6efeb;">{safe_session_price}</td>
              </tr>
            </table>
          </div>

          <div style="margin-top:24px;border-radius:20px;background:#fff7ed;border:1px solid #f6d6b8;padding:20px;">
            <p style="margin:0 0 12px;font-size:14px;line-height:1.7;color:#8a5a2b;">
              Join a few minutes before your scheduled time. Use the button below to open your session link.
            </p>
            <a href="{safe_meet_link}" style="display:inline-block;background:#2f6f73;color:#ffffff;text-decoration:none;padding:14px 22px;border-radius:14px;font-size:14px;font-weight:700;">
              Open Session Link
            </a>
            <p style="margin:14px 0 0;font-size:12px;line-height:1.6;color:#8a5a2b;word-break:break-all;">
              If the button does not work, copy this link: {safe_meet_link}
            </p>
          </div>

          <p style="margin:24px 0 0;font-size:13px;line-height:1.7;color:#6b7280;">
            Need help before your session? Please use the same email address you booked with so our support team can verify your appointment faster.
          </p>
        </div>

        <div style="border-top:1px solid #e6efeb;background:#f8fbfa;padding:20px 32px 24px;">
          <p style="margin:0;font-size:13px;font-weight:700;color:#183b3d;">MeloMind CareConnect</p>
          <p style="margin:8px 0 0;font-size:12px;line-height:1.7;color:#6b7280;">
            Private emotional well-being support, booking updates, and session access in one place.
          </p>
          <p style="margin:10px 0 0;font-size:12px;line-height:1.7;color:#6b7280;">
            This confirmation was sent to {html.escape(str(to_email))}. Please keep this email for your session details.
          </p>
        </div>
      </div>
    </div>
  </body>
</html>
"""
        msg.add_alternative(html_body.strip(), subtype="html")

        with smtplib.SMTP(smtp_host, smtp_port) as server:
            server.starttls()
            server.login(smtp_user, smtp_pass)
            server.send_message(msg)

        return jsonify({"ok": True, "message": "Email sent"}), 200
    except Exception as e:
        return jsonify({"ok": False, "message": str(e)}), 500


@app.route("/api/send_payment_confirmation_email", methods=["POST"])
def send_payment_confirmation_email():
    """
    Sends subscription payment confirmation email.
    Requires SMTP env vars:
    SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SENDER
    """
    try:
        data = request.get_json() or {}
        to_email = data.get("userEmail")
        if not to_email:
            return jsonify({"ok": False, "message": "userEmail missing"}), 400

        smtp_host = os.getenv("SMTP_HOST")
        smtp_port = int(os.getenv("SMTP_PORT", "587"))
        smtp_user = os.getenv("SMTP_USER")
        smtp_pass = os.getenv("SMTP_PASS")
        smtp_sender = os.getenv("SMTP_SENDER", smtp_user or "")

        if not smtp_host or not smtp_user or not smtp_pass or not smtp_sender:
            return jsonify({
                "ok": False,
                "message": "SMTP is not configured on backend"
            }), 503

        user_name = data.get("userName") or "there"
        plan_name = data.get("planName") or "MeloMind membership"
        amount = data.get("amount") or "TBD"
        billing_cycle = data.get("billingCycle") or "one-time"
        payment_id = data.get("paymentId") or "TBD"
        order_id = data.get("orderId") or "TBD"
        payment_method = data.get("paymentMethod") or "Razorpay"

        safe_user_name = html.escape(str(user_name))
        safe_plan_name = html.escape(str(plan_name))
        safe_amount = html.escape(str(amount))
        safe_billing_cycle = html.escape(str(billing_cycle))
        safe_payment_id = html.escape(str(payment_id))
        safe_order_id = html.escape(str(order_id))
        safe_payment_method = html.escape(str(payment_method))
        safe_to_email = html.escape(str(to_email))

        msg = EmailMessage()
        msg["Subject"] = "MeloMind Payment Confirmation"
        msg["From"] = smtp_sender
        msg["To"] = to_email

        body = f"""
Hello,

Your MeloMind payment has been confirmed.

Plan: {plan_name}
Amount: {amount}
Billing: {billing_cycle}
Payment Method: {payment_method}
Payment ID: {payment_id}
Order ID: {order_id}

Thank you for choosing MeloMind.
"""
        msg.set_content(body.strip())

        html_body = f"""
<!DOCTYPE html>
<html lang="en">
  <body style="margin:0;padding:0;background:#f4f8f7;font-family:Arial,sans-serif;color:#1f2937;">
    <div style="width:100%;background:#f4f8f7;padding:32px 16px;">
      <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #dbe7e3;border-radius:24px;overflow:hidden;box-shadow:0 18px 45px rgba(15,23,42,0.08);">
        <div style="background:linear-gradient(135deg,#dff4f2 0%,#9fd1cd 100%);padding:32px 32px 24px;">
          <table role="presentation" style="border-collapse:collapse;margin-bottom:18px;">
            <tr>
              <td style="vertical-align:middle;">
                <div style="height:44px;width:44px;border-radius:14px;background:#2f6f73;color:#ffffff;font-size:18px;font-weight:700;line-height:44px;text-align:center;">
                  M
                </div>
              </td>
              <td style="padding-left:12px;vertical-align:middle;">
                <div style="font-size:22px;font-weight:800;line-height:1;color:#183b3d;">MeloMind</div>
                <div style="margin-top:4px;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#335c5e;">
                  Payment Confirmation
                </div>
              </td>
            </tr>
          </table>
          <div style="display:inline-block;padding:8px 14px;border-radius:999px;background:#ffffff;color:#2f6f73;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">
            Payment Successful
          </div>
          <h1 style="margin:18px 0 8px;font-size:30px;line-height:1.2;color:#183b3d;">
            Your plan is active
          </h1>
          <p style="margin:0;font-size:15px;line-height:1.7;color:#335c5e;">
            Hello {safe_user_name}, your MeloMind payment was successful and your selected plan is now active.
          </p>
        </div>

        <div style="padding:28px 32px;">
          <div style="background:#f8fbfa;border:1px solid #dde8e4;border-radius:20px;padding:22px;">
            <h2 style="margin:0 0 18px;font-size:18px;color:#183b3d;">Payment summary</h2>

            <table role="presentation" style="width:100%;border-collapse:collapse;">
              <tr>
                <td style="padding:10px 0;color:#6b7280;font-size:14px;">Plan</td>
                <td style="padding:10px 0;color:#183b3d;font-size:14px;font-weight:700;text-align:right;">{safe_plan_name}</td>
              </tr>
              <tr>
                <td style="padding:10px 0;color:#6b7280;font-size:14px;border-top:1px solid #e6efeb;">Amount</td>
                <td style="padding:10px 0;color:#183b3d;font-size:14px;font-weight:700;text-align:right;border-top:1px solid #e6efeb;">{safe_amount}</td>
              </tr>
              <tr>
                <td style="padding:10px 0;color:#6b7280;font-size:14px;border-top:1px solid #e6efeb;">Billing</td>
                <td style="padding:10px 0;color:#183b3d;font-size:14px;font-weight:700;text-align:right;border-top:1px solid #e6efeb;">{safe_billing_cycle}</td>
              </tr>
              <tr>
                <td style="padding:10px 0;color:#6b7280;font-size:14px;border-top:1px solid #e6efeb;">Payment Method</td>
                <td style="padding:10px 0;color:#183b3d;font-size:14px;font-weight:700;text-align:right;border-top:1px solid #e6efeb;">{safe_payment_method}</td>
              </tr>
              <tr>
                <td style="padding:10px 0;color:#6b7280;font-size:14px;border-top:1px solid #e6efeb;">Payment ID</td>
                <td style="padding:10px 0;color:#183b3d;font-size:14px;font-weight:700;text-align:right;border-top:1px solid #e6efeb;">{safe_payment_id}</td>
              </tr>
              <tr>
                <td style="padding:10px 0;color:#6b7280;font-size:14px;border-top:1px solid #e6efeb;">Order ID</td>
                <td style="padding:10px 0;color:#183b3d;font-size:14px;font-weight:700;text-align:right;border-top:1px solid #e6efeb;">{safe_order_id}</td>
              </tr>
            </table>
          </div>

          <p style="margin:24px 0 0;font-size:13px;line-height:1.7;color:#6b7280;">
            If you need help with your plan, please contact support using the same email address used for your payment.
          </p>
        </div>

        <div style="border-top:1px solid #e6efeb;background:#f8fbfa;padding:20px 32px 24px;">
          <p style="margin:0;font-size:13px;font-weight:700;color:#183b3d;">MeloMind</p>
          <p style="margin:8px 0 0;font-size:12px;line-height:1.7;color:#6b7280;">
            This confirmation was sent to {safe_to_email}. Please keep it for your payment records.
          </p>
        </div>
      </div>
    </div>
  </body>
</html>
"""
        msg.add_alternative(html_body.strip(), subtype="html")

        with smtplib.SMTP(smtp_host, smtp_port) as server:
            server.starttls()
            server.login(smtp_user, smtp_pass)
            server.send_message(msg)

        return jsonify({"ok": True, "message": "Email sent"}), 200
    except Exception as e:
        return jsonify({"ok": False, "message": str(e)}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)
