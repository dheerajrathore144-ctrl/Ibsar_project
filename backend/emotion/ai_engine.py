import base64
import cv2
import numpy as np
from deepface import DeepFace


def analyze_emotion_from_base64(image_base64: str):
    """
    Receives base64 image from frontend webcam
    Returns emotion + stress/anxiety/mood scores
    """

    try:
        # Remove base64 header if present
        if "," in image_base64:
            image_base64 = image_base64.split(",")[1]

        # Decode base64 → image
        img_bytes = base64.b64decode(image_base64)
        np_img = np.frombuffer(img_bytes, np.uint8)
        frame = cv2.imdecode(np_img, cv2.IMREAD_COLOR)

        if frame is None:
            raise ValueError("Invalid image data")

        # Analyze emotion using DeepFace
        result = DeepFace.analyze(
            frame,
            actions=["emotion"],
            enforce_detection=False
        )

        emotions = result[0]["emotion"]
        dominant_emotion = result[0]["dominant_emotion"]

        # Dashboard-friendly scores (normalized)
        stress = int((emotions.get("angry", 0) + emotions.get("fear", 0)) / 2)
        anxiety = int(emotions.get("fear", 0))
        mood = int(emotions.get("happy", 0))

        return {
            "emotion": dominant_emotion.capitalize(),
            "stressLevel": min(stress, 100),
            "anxietyLevel": min(anxiety, 100),
            "moodScore": min(mood, 100),
            "distribution": {
                "happy": int(emotions.get("happy", 0)),
                "neutral": int(emotions.get("neutral", 0)),
                "sad": int(emotions.get("sad", 0)),
                "angry": int(emotions.get("angry", 0)),
                "fear": int(emotions.get("fear", 0)),
            }
        }

    except Exception as e:
        # Safe fallback (never crash frontend)
        return {
            "emotion": "Unknown",
            "stressLevel": 0,
            "anxietyLevel": 0,
            "moodScore": 0,
            "distribution": {},
            "error": str(e)
        }
