import { db } from "../firebase";
import { collection, addDoc, getDocs, query, where } from "firebase/firestore";
import React, { useRef, useState, useEffect, useContext } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "../lib/notify";
import { EmotionContext } from "../context/EmotionContext";
import {
  Brain,
  ClipboardList,
  Activity,
  FileText,
  User,
  Calendar,
  ArrowRight,
  Camera,
  Mic,
  Play,
  Upload,
  Download,
  ShieldAlert,
  Smile,
  TrendingUp,
  Headphones,
  Music,
  X
} from "lucide-react";
import jsPDF from "jspdf";
import { useNavigate } from "react-router-dom";
import { apiUrl } from "../lib/api";

const palette = {
  blue: "#1f5f99",
  mint: "#e7f2ff",
  cream: "#f7fafc",
  blush: "#f8ead2",
  sage: "#d8e5ef",
  deep: "#0b2f55",
  deepAlt: "#617386",
};

const GLOBAL_STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap');

body {
  margin:0;
  font-family:'Plus Jakarta Sans',system-ui,sans-serif;
  background:#f7fafc;
  color:#0b2f55;
}

/* container */
.container{
  width:100%;
  max-width:1100px;
  margin:auto;
}

/* gradient header */
.medical-gradient{
  background:linear-gradient(135deg,#081c30 0%,#1f5f99 62%,#38a3d1 100%);
}

/* cards */
.medical-card{
  background:white;
  border-radius:12px;
  border:1px solid #e2e8f0;
  box-shadow:0 2px 8px rgba(0,0,0,0.05);
  transition:all .2s;
}

.medical-card:hover{
  box-shadow:0 6px 18px rgba(0,0,0,0.08);
}

/* muted background */
.bg-muted{
  background:#eef3fb;
}

/* progress colors */
.bg-medical-teal-light{ background:#eefaf6; }
.bg-medical-blue-light{ background:#e7f2ff; }
.bg-medical-green-light{ background:#eefaf6; }
.bg-medical-amber-light{ background:#fff4df; }
.bg-medical-red-light{ background:#fae9e2; }

/* text colors */
.text-primary{ color:#253342; }
.text-medical-blue{ color:#1f5f99; }
.text-medical-green{ color:#2e856e; }

.text-muted-foreground{
  color:#64748b;
}

/* animations */
.scan-pulse{
  animation:scanPulse 2s ease-in-out infinite;
}

@keyframes scanPulse{
  0%,100%{opacity:.4;transform:scale(1);}
  50%{opacity:1;transform:scale(1.05);}
}

.scan-ring{
  animation:scanRing 1.5s ease-in-out infinite;
}

@keyframes scanRing{
  0%{box-shadow:0 0 0 0 rgba(17,40,79,.35);}
  70%{box-shadow:0 0 0 15px rgba(17,40,79,0);}
  100%{box-shadow:0 0 0 0 rgba(42,167,155,0);}
}

/* basic layout */
.min-h-screen{min-height:100vh;}
.flex{display:flex;}
.items-center{align-items:center;}
.justify-center{justify-content:center;}
.justify-between{justify-content:space-between;}
.gap-2{gap:8px;}
.gap-3{gap:12px;}
.gap-4{gap:16px;}
.gap-6{gap:24px;}
.mx-auto{margin-left:auto;margin-right:auto;}
.mb-6{margin-bottom:24px;}
.mb-8{margin-bottom:32px;}
.mt-1{margin-top:4px;}
.mt-2{margin-top:8px;}
.p-4{padding:16px;}
.p-6{padding:24px;}
.rounded-lg{border-radius:10px;}
.rounded-full{border-radius:9999px;}

/* colors */
.bg-background{background:#f7f3ff;}
.bg-card{background:white;}
.bg-border{background:#e2e8f0;}
.border-b{border-bottom:1px solid #e2e8f0;}

.text-foreground{color:#0f172a;}
.text-primary{color:#253342;}
.text-primary-foreground{color:#253342;}
`;

// Simple UI replacements

const Card = ({ children, className = "" }) => (
  <div className={`bg-white shadow rounded-lg ${className}`}>{children}</div>
);

const CardContent = ({ children, className = "" }) => (
  <div className={`p-4 ${className}`}>{children}</div>
);

const CardHeader = ({ children }) => (
  <div className="border-b p-4 font-semibold">{children}</div>
);

const CardTitle = ({ children }) => (
  <h3 className="text-lg font-bold">{children}</h3>
);

const Button = ({ children, variant = "primary", style = {}, onMouseOver, onMouseOut, ...props }) => {
  const variantStyles =
    variant === "outline"
      ? {
          background: palette.blue,
          color: "#ffffff",
          border: "1px solid #2a4ecf",
        }
      : {
          background: palette.blue,
          color: "#ffffff",
          border: "1px solid #2a4ecf",
        };

  return (
    <button
      {...props}
      style={{
        padding: "12px 18px",
        borderRadius: "10px",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "8px",
        fontWeight: "600",
        transition: "all 0.2s ease",
        ...variantStyles,
        ...style,
      }}
      onMouseOver={(e) => {
        e.currentTarget.style.background = "#5838ac";
        e.currentTarget.style.transform = "translateY(-1px)";
        onMouseOver?.(e);
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.background = style.background || palette.blue;
        e.currentTarget.style.transform = "translateY(0)";
        onMouseOut?.(e);
      }}
    >
      {children}
    </button>
  );
};

const Progress = ({ value }) => (
  <div style={{ width: "100%", background: "#eee", height: "8px", borderRadius: "4px" }}>
    <div
      style={{
        width: `${value}%`,
        background: palette.blue,
        height: "8px",
        borderRadius: "4px",
      }}
    />
  </div>
);

const Input = (props) => (
  <input
    {...props}
    style={{
      width: "100%",
      padding: "10px 12px",
      border: `1px solid ${palette.sage}`,
      borderRadius: "10px",
      background: "#fff",
      color: "#0f172a",
    }}
  />
);

const Label = ({ children }) => (
  <label style={{ fontWeight: "600" }}>{children}</label>
);

const Slider = ({ value, onValueChange, min, max }) => {

  const val = value[0];

  const getColor = (v) => {
    if (v <= 3) return "#00d5b9";   // green
    if (v <= 6) return "#eab308";   // yellow
    if (v <= 8) return "#f97316";   // orange
    return "#ef4444";               // red
  };

  const percent = ((val - min) / (max - min)) * 100;

  return (
    <div style={{ width: "100%" }}>
      <input
        type="range"
        min={min}
        max={max}
        value={val}
        onChange={(e) => onValueChange([Number(e.target.value)])}
        style={{
          width: "100%",
          height: "8px",
          borderRadius: "6px",
          appearance: "none",
          outline: "none",
          transition: "all 0.3s ease",

          background: `linear-gradient(
            to right,
            ${getColor(val)} 0%,
            ${getColor(val)} ${percent}%,
            #e2e8f0 ${percent}%,
            #e2e8f0 100%
          )`
        }}
      />

      {/* Custom Thumb Styling */}
      <style>
        {`
        input[type="range"]::-webkit-slider-thumb {
          appearance: none;
          height: 18px;
          width: 18px;
          border-radius: 50%;
          background: ${getColor(val)};
          border: 3px solid white;
          box-shadow: 0 2px 6px rgba(0,0,0,0.2);
          cursor: pointer;
          transition: all 0.2s ease;
        }

        input[type="range"]::-webkit-slider-thumb:hover {
          transform: scale(1.2);
        }

        input[type="range"]::-moz-range-thumb {
          height: 18px;
          width: 18px;
          border-radius: 50%;
          background: ${getColor(val)};
          border: none;
          cursor: pointer;
        }
        `}
      </style>
    </div>
  );
};

/* =====================================================
   CONSTANTS
===================================================== */
const STEPS = [
  { key: "info", label: "Patient Info", icon: Brain },
  { key: "survey", label: "Assessment", icon: ClipboardList },
  { key: "scan", label: "AI Scan", icon: Activity },
  { key: "report", label: "Report", icon: FileText },
];

const QUESTIONS = [
  "Difficulty falling asleep or staying asleep",
  "Feeling tired or having low energy",
  "Loss of interest or pleasure in activities",
  "Feeling stressed or overwhelmed",
  "Experiencing sudden mood changes",
  "Feeling nervous or anxious",
  "Difficulty concentrating",
  "Avoiding social interaction",
  "Feeling emotionally overwhelmed",
  "Difficulty relaxing even during free time"
];

const EMOTIONS = [
  "Happy",
  "Sad",
  "Angry",
  "Frustrated",
  "Neutral",
  "Depressed",
];

const REPORT_COLLECTION_PRIMARY = "emotional_wellbeing_reports";
const REPORT_COLLECTION_LEGACY = "mental_health_reports";
const SCAN_DURATION_SECONDS = 30;

function normalizeStepKey(step) {
  if (step === "patient" || step === "patient-info") return "info";
  if (step === "assessment") return "survey";
  if (step === "ai-scan") return "scan";
  if (step === "report") return "report";
  return STEPS.some((item) => item.key === step) ? step : "info";
}
/* ===============================
   HELPER FUNCTIONS
================================ */

function getAgeGroup(age) {
  if (age < 18) return "Child";
  if (age < 30) return "Young Adult";
  if (age < 55) return "Adult";
  return "Senior";
}

function getMusicTherapy(emotion, age, stressScore, depressionLevel, stabilityScore = 5) {

  const group = getAgeGroup(age);
  const e = emotion?.toLowerCase();

  const therapies = [
    {
      name: "Relaxation Therapy",
      freq: "432 Hz",
      brainwave: "Alpha Brainwave (8-12 Hz)",
      therapy: "Relaxation Regulation Therapy",
      userMessage: "You may benefit from a calming session to ease stress and help your mood feel more settled.",
      purpose: "Calm the nervous system and reduce stress buildup.",
      frequencyBenefit: "This frequency is commonly used in calming music to support emotional balance and relaxation.",
      brainwaveBenefit: "Alpha-style listening is often associated with calm attention, relaxation, and mental steadiness.",
      helps: "Stress reduction, relaxation, emotional balance",
      explanation:
        "Calm, steady music is commonly used in relaxation and stress-management routines. This recommendation is intended as supportive wellness guidance rather than a clinical treatment plan.",
      duration: "10–15 minutes",
      schedule: "1–2 sessions per day",
      listeningMethod:
        "Listen in a quiet, comfortable place with low distractions. Headphones are optional if they feel comfortable."
    },

    {
      name: "Emotional Recovery Therapy",
      freq: "528 Hz",
      brainwave: "Theta-Alpha Brainwave (6-10 Hz)",
      therapy: "Emotional Healing Therapy",
      userMessage: "A gentle recovery-focused session may help when your current mood looks lower or emotionally heavy.",
      purpose: "Support emotional recovery and reduce sadness.",
      frequencyBenefit: "This frequency is often used in soft meditative listening to encourage emotional reset and gentle recovery.",
      brainwaveBenefit: "Theta-alpha style listening is commonly used for rest, reflection, and emotional calming.",
      helps: "Mood stabilization, emotional healing, wellbeing support",
      explanation:
        "Gentle, low-arousal music may support rest, reflection, and mood recovery for some people. This recommendation is provided for general wellbeing support.",
      duration: "15–20 minutes",
      schedule: "1–2 sessions per day",
      listeningMethod:
        "Listen during a calm moment, such as while resting, breathing slowly, or sitting quietly."
    },

    {
      name: "Emotional Clarity Therapy",
      freq: "741 Hz",
      brainwave: "Alpha Brainwave (8-12 Hz)",
      therapy: "Emotional Clarity Therapy",
      userMessage: "A clarity-focused session may help if your results suggest frustration, overload, or difficulty staying mentally clear.",
      purpose: "Reduce emotional overload and support clearer thinking.",
      frequencyBenefit: "This frequency is often paired with reflective music to support mental reset and emotional clarity.",
      brainwaveBenefit: "Alpha-style listening may support calm focus and help reduce mental noise.",
      helps: "Reduced overthinking, emotional clarity, focus",
      explanation:
        "Soft instrumental or ambient audio can help create a calmer environment for mental reset and reflective attention.",
      duration: "10 minutes",
      schedule: "1 session when feeling emotionally overwhelmed",
      listeningMethod:
        "Listen in a calm setting, ideally while pausing other demanding tasks for a few minutes."
    },

    {
      name: "Positive Engagement Therapy",
      freq: "639 Hz",
      brainwave: "Beta Brainwave (12-20 Hz)",
      therapy: "Motivation and Engagement Therapy",
      userMessage: "Your current mood looks positive, so this session is aimed at helping you maintain that energy in a healthy way.",
      purpose: "Support a positive mood and maintain healthy engagement.",
      frequencyBenefit: "This frequency is often used in uplifting listening sessions to support positive energy and healthy engagement.",
      brainwaveBenefit: "Beta-style listening is commonly linked with alertness, active attention, and engaged thinking.",
      helps: "Mood maintenance, positive engagement, emotional steadiness",
      explanation:
        "When mood is already positive, familiar or uplifting music may help maintain energy and emotional steadiness during everyday activities.",
      duration: "10–12 minutes",
      schedule: "Once daily",
      listeningMethod:
        "Listen during comfortable low-intensity activities such as journaling, stretching, or a short walk if that feels supportive."
    }
  ];

  let selected;

  // HIGH STRESS
  if (stressScore >= 5) {
    selected = therapies[0];
  }

  // HIGH DEPRESSION
  else if (depressionLevel === "High Depression" || e === "sad" || e === "depressed") {
    selected = therapies[1];
  }

  // LOW STABILITY
  else if (stabilityScore <= 3) {
    selected = therapies[0];
  }

  // ANGER / FRUSTRATION
  else if (e === "angry" || e === "frustrated") {
    selected = therapies[2];
  }

  // POSITIVE STATE
  else if (e === "happy") {
    selected = therapies[3];
  }

  // DEFAULT BALANCE THERAPY
  else {
    selected = therapies[0];
  }

  // Age adjustment
  if (group === "Child") {
    selected.duration = "8–10 minutes";
  }

  if (group === "Senior") {
    selected.duration = "8–12 minutes";
  }

  return { group, recommendations: [selected] };

}

function getStressScore(scores) {
  const stressRelated = [3, 4, 5, 8, 9];
  let total = 0;

  stressRelated.forEach((i) => {
    total += scores[i];
  });

  return Math.round(total / stressRelated.length);
}

function getDepressionIndicator(scores) {
  const depressionRelated = [0, 1, 2];
  let total = 0;

  depressionRelated.forEach((i) => {
    total += scores[i];
  });

  const avg = Math.round(total / depressionRelated.length);

  if (avg >= 8)
    return { label: "High Depression", color: "text-[#dd5b42]" };

  if (avg >= 5)
    return { label: "Moderate Depression", color: "text-[#d99a17]" };

  if (avg >= 3)
    return { label: "Low Depression", color: "text-[#d5a021]" };

  return { label: "No Depression", color: "text-[#00a58f]" };
}

function getStabilityScore(scores) {
  const stabilityRelated = [3, 4, 8, 9];
  const validScores = stabilityRelated
    .map((i) => Number(scores?.[i]))
    .filter((value) => Number.isFinite(value));

  if (!validScores.length) return 0;

  const avgDifficulty = validScores.reduce((total, value) => total + value, 0) / validScores.length;
  return Math.max(1, Math.min(10, Math.round(11 - avgDifficulty)));
}

function getStabilityPercent(stabilityScore) {
  const n = Number(stabilityScore);
  if (!Number.isFinite(n)) return 0;
  if (n <= 10) return Math.max(0, Math.min(100, Math.round(n * 10)));
  return Math.max(0, Math.min(100, Math.round(n)));
}

function getStressRisk(emotion, avgScore) {
  if (["Angry", "Frustrated", "Depressed", "Stressed"].includes(emotion))
    return { label: "High", color: "text-[#dd5b42]" };

  if (emotion === "Sad")
    return { label: "Moderate", color: "text-[#d99a17]" };

  if (avgScore > 7)
    return { label: "Moderate", color: "text-[#d99a17]" };

  return { label: "Low", color: "text-[#00a58f]" };
}

function clampPercent(value) {
  return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
}

function normalizeSurveyScores(rawScores) {
  if (!Array.isArray(rawScores)) return Array(QUESTIONS.length).fill(null);
  return rawScores.slice(0, QUESTIONS.length);
}

function normalizeSurveyQuestions(rawQuestions) {
  if (!Array.isArray(rawQuestions) || rawQuestions.length === 0) return QUESTIONS;
  return rawQuestions.slice(0, QUESTIONS.length);
}

function getInsight(name, emotion, avgScore, stressScore, depressionLevel, stabilityScore) {

  const e = emotion?.toLowerCase();

  let stateDescription = "";
  let recommendation = "";

  if (depressionLevel === "High Depression") {
    stateDescription =
      "strong depression-related survey indicators with reduced emotional resilience";

    recommendation =
      "Your responses suggest that professional support would be helpful. Please connect with a psychologist or qualified emotional well-being professional through CareConnect as soon as possible for timely guidance.";
  }

  else if (stressScore >= 6) {
    stateDescription =
      "elevated psychological stress indicators suggesting increased cognitive and emotional load";

    recommendation =
      "Structured relaxation techniques such as breathing exercises, mindfulness sessions, and calming music therapy may help regulate the nervous system and reduce stress accumulation.";
  }

  else if (depressionLevel === "Moderate Depression" || e === "sad" || e === "depressed") {
    stateDescription =
      "signs of emotional fatigue and reduced mood stability";

    recommendation =
      "Supportive emotional recovery strategies including reflective journaling, relaxation music therapy, and healthy social interaction may assist in restoring emotional balance. If this pattern continues, consider speaking with a psychologist for additional support.";
  }

  else if (e === "angry" || e === "frustrated") {
    stateDescription =
      "heightened emotional reactivity which may indicate temporary psychological strain";

    recommendation =
      "Calming interventions such as breathing exercises, short mindful breaks, and relaxation-focused sound therapy are recommended to stabilize emotional responses.";
  }

  else if (e === "happy") {
    stateDescription =
      "a positive emotional engagement pattern with healthy cognitive activation";

    recommendation =
      "Maintaining balanced routines such as physical activity, creative hobbies, and relaxation practices can help sustain this positive emotional state.";
  }

  else if (e === "neutral") {
    stateDescription =
      "a stable emotional baseline with balanced psychological indicators";

    recommendation =
      "Light emotional maintenance strategies such as mindfulness exercises, calm music listening, and periodic relaxation may help sustain emotional equilibrium.";
  }

  else {
    stateDescription =
      "moderate emotional variability within normal psychological limits";

    recommendation =
      "Balanced self-care practices including relaxation, reflective thinking, and healthy daily routines are recommended to maintain emotional wellbeing.";
  }

  return `${name}'s emotional wellbeing analysis indicates ${stateDescription}. The AI system detected a primary emotional state of ${emotion} with an average psychological stress score of ${avgScore}. Based on behavioral indicators, stress analysis, and emotional interpretation models, ${recommendation}`;
}



/* ===============================
   MAIN COMPONENT
================================ */

export default function EmotionWellbeing() {

  const navigate = useNavigate();
  const { emotionData, setEmotionData } = useContext(EmotionContext);

  const restoreData = emotionData || {};
  const restoredStep = normalizeStepKey(restoreData.step);

  useEffect(() => {
    const style = document.createElement("style");
    style.innerHTML = GLOBAL_STYLES;
    document.head.appendChild(style);

    return () => {
      document.head.removeChild(style);
    };
  }, []);

  const [step, setStep] = useState(restoredStep);

  const [name, setName] = useState(restoreData.name || "");
  const [age, setAge] = useState(restoreData.age || "");
  const [infoError, setInfoError] = useState("");
  const [previousReports, setPreviousReports] = useState([]);
  const [showReportsPopup, setShowReportsPopup] = useState(false);

  const [scores, setScores] = useState(() => {
    if (Array.isArray(restoreData.scores)) {
      const normalizedScores = normalizeSurveyScores(restoreData.scores);
      return normalizedScores.length === QUESTIONS.length
        ? normalizedScores
        : Array(QUESTIONS.length).fill(null);
    }

    return Array(QUESTIONS.length).fill(null);
  });
  const handleScoreChange = (index, value) => {
    const updated = [...scores];
    updated[index] = Number(value);
    setScores(updated);
  };

  const [cameraReady, setCameraReady] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanStarted, setScanStarted] = useState(false);
  const [countdown, setCountdown] = useState(SCAN_DURATION_SECONDS);

  const [scanResult, setScanResult] = useState(restoreData.scanResult || null);

  const videoRef = useRef(null);
  const intervalRef = useRef(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const uploadedVideoUrlRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioContextRef = useRef(null);
  const audioSourceRef = useRef(null);
  const audioProcessorRef = useRef(null);
  const audioStreamRef = useRef(null);
  const scanSessionRef = useRef(0);
  const liveRequestRef = useRef(0);
  const appliedLiveRequestRef = useRef(0);
  const isScanningRef = useRef(false);
  const finalizingScanRef = useRef(false);
  const latestEmotionResultRef = useRef({
    emotion: restoreData.latestEmotionResult?.emotion || "No Face Detected",
    emotionScore: restoreData.latestEmotionResult?.emotionScore || 0,
  });

  useEffect(() => {
    setEmotionData({
      step: normalizeStepKey(step),
      name,
      age,
      scores,
      scanResult,
      latestEmotionResult: latestEmotionResultRef.current,
    });
  }, [step, name, age, scores, scanResult, setEmotionData]);

  useEffect(() => {
    const currentVideo = videoRef.current;

    return () => {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
      isScanningRef.current = false;
      finalizingScanRef.current = false;

      const stream = currentVideo?.srcObject;
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }

      if (currentVideo && uploadedVideoUrlRef.current) {
        currentVideo.pause();
        currentVideo.removeAttribute("src");
        currentVideo.load();
      }

      if (uploadedVideoUrlRef.current) {
        URL.revokeObjectURL(uploadedVideoUrlRef.current);
        uploadedVideoUrlRef.current = null;
      }

      if (audioProcessorRef.current) audioProcessorRef.current.disconnect();
      if (audioSourceRef.current) audioSourceRef.current.disconnect();
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        audioContextRef.current.close().catch(() => {});
      }
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const validatePatientInfo = () => {
    const cleanName = name.trim();
    const parsedAge = Number(age);

    if (!cleanName) return "Please enter your full name.";
    if (cleanName.length < 2) return "Name should be at least 2 characters.";
    if (age === "") return "Please enter your age.";
    if (!Number.isFinite(parsedAge)) return "Please enter a valid age.";
    if (parsedAge < 1) return "Age must be at least 1 year.";
    if (parsedAge > 100) return "Age cannot be more than 100 years.";

    return "";
  };

  const handleAgeInput = (event) => {
    const raw = event.target.value;

    if (raw === "") {
      setAge("");
      if (infoError) setInfoError("");
      return;
    }

    const digitsOnly = raw.replace(/\D/g, "");
    if (!digitsOnly) return;

    const parsedAge = Number(digitsOnly);
    const cappedAge = Math.min(parsedAge, 100);
    setAge(String(cappedAge));

    if (parsedAge > 100) {
      setInfoError("Age cannot be more than 100 years.");
    } else if (infoError) {
      setInfoError("");
    }
  };

  const handleNameInput = (event) => {
    const raw = event.target.value;
    const lettersAndSpacesOnly = raw.replace(/[^A-Za-z\s]/g, "");
    const normalized = lettersAndSpacesOnly.replace(/\s{2,}/g, " ");

    setName(normalized);

    if (infoError) {
      setInfoError("");
    }
  };

  const handleContinueToSurvey = () => {
    const error = validatePatientInfo();
    if (error) {
      setInfoError(error);
      toast.error(error);
      return;
    }

    setInfoError("");
    setStep("survey");
  };

  const encodeWav = (samples, sampleRate) => {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);

    const writeString = (offset, string) => {
      for (let i = 0; i < string.length; i += 1) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    writeString(0, "RIFF");
    view.setUint32(4, 36 + samples.length * 2, true);
    writeString(8, "WAVE");
    writeString(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, "data");
    view.setUint32(40, samples.length * 2, true);

    let offset = 44;
    for (let i = 0; i < samples.length; i += 1) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      offset += 2;
    }

    return new Blob([buffer], { type: "audio/wav" });
  };

  const getAudioRms = (samples) => {
    if (!samples?.length) return 0;
    let total = 0;
    for (let i = 0; i < samples.length; i += 1) {
      total += samples[i] * samples[i];
    }
    return Math.sqrt(total / samples.length);
  };

  const extractDominantVoiceSamples = (samples, sampleRate) => {
    if (!samples?.length || !sampleRate) return null;

    const windowSize = Math.max(1024, Math.floor(sampleRate * 0.3));
    const chunks = [];

    for (let start = 0; start < samples.length; start += windowSize) {
      const end = Math.min(samples.length, start + windowSize);
      const slice = samples.slice(start, end);
      const rms = getAudioRms(slice);
      chunks.push({ slice, rms });
    }

    const strongestRms = Math.max(...chunks.map((chunk) => chunk.rms), 0);
    if (strongestRms < 0.018) return null;

    const keepThreshold = Math.max(0.02, strongestRms * 0.45);
    const keptChunks = chunks.filter((chunk) => chunk.rms >= keepThreshold);
    if (!keptChunks.length) return null;

    const totalLength = keptChunks.reduce((sum, chunk) => sum + chunk.slice.length, 0);
    if (totalLength < sampleRate * 0.8) return null;

    const filtered = new Float32Array(totalLength);
    let offset = 0;
    keptChunks.forEach((chunk) => {
      filtered.set(chunk.slice, offset);
      offset += chunk.slice.length;
    });

    return filtered;
  };

  const startAudioCapture = async (stream) => {
    if (!stream) return;

    audioChunksRef.current = [];

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    const audioTracks = stream.getAudioTracks();
    if (!audioTracks || audioTracks.length === 0) return;

    const audioOnlyStream = new MediaStream(audioTracks);
    const audioContext = new AudioContextClass();
    const source = audioContext.createMediaStreamSource(audioOnlyStream);
    const processor = audioContext.createScriptProcessor(4096, 1, 1);

    processor.onaudioprocess = (event) => {
      const channelData = event.inputBuffer.getChannelData(0);
      audioChunksRef.current.push(new Float32Array(channelData));
    };

    source.connect(processor);
    processor.connect(audioContext.destination);

    audioContextRef.current = audioContext;
    audioSourceRef.current = source;
    audioProcessorRef.current = processor;
    audioStreamRef.current = audioOnlyStream;
  };

  const stopAudioCapture = async () => {
    try {
      if (audioProcessorRef.current) audioProcessorRef.current.disconnect();
      if (audioSourceRef.current) audioSourceRef.current.disconnect();
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        await audioContextRef.current.close();
      }
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    } catch (err) {
      console.warn("Audio capture cleanup failed:", err);
    }

    audioProcessorRef.current = null;
    audioSourceRef.current = null;
    audioContextRef.current = null;
    audioStreamRef.current = null;
  };

  const analyzeVoiceAudio = async () => {
    try {
      if (!audioChunksRef.current.length || !audioContextRef.current?.sampleRate) {
        return { tone: "Neutral", confidence: 0 };
      }

      const totalLength = audioChunksRef.current.reduce((sum, chunk) => sum + chunk.length, 0);
      if (!totalLength) {
        return { tone: "Neutral", confidence: 0 };
      }

      const merged = new Float32Array(totalLength);
      let offset = 0;
      audioChunksRef.current.forEach((chunk) => {
        merged.set(chunk, offset);
        offset += chunk.length;
      });

      const dominantVoiceSamples = extractDominantVoiceSamples(
        merged,
        audioContextRef.current.sampleRate
      );

      if (!dominantVoiceSamples) {
        return { tone: "Neutral", confidence: 0 };
      }

      const wavBlob = encodeWav(dominantVoiceSamples, audioContextRef.current.sampleRate);
      const formData = new FormData();
      formData.append("audio", wavBlob, "voice-scan.wav");

      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 4500);
      const response = await fetch(apiUrl("/api/analyze_voice"), {
        method: "POST",
        body: formData,
        signal: controller.signal,
      }).catch(() => null);
      window.clearTimeout(timeoutId);

      if (!response?.ok) {
        return { tone: "Neutral", confidence: 0 };
      }

      const data = await response.json();
      const tone = data.tone || "Neutral";
      const confidence = Number(data.confidence) || 0;

      return {
        tone: confidence >= 40 ? tone : "Neutral",
        confidence,
      };
    } catch (err) {
      console.error("Voice analysis error:", err);
      return { tone: "Neutral", confidence: 0 };
    }
  };

  const detectEmotion = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    if (!isScanningRef.current || finalizingScanRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const sessionId = scanSessionRef.current;
    const requestId = liveRequestRef.current + 1;
    liveRequestRef.current = requestId;

    canvas.width = 320;
    canvas.height = 240;

    ctx.drawImage(video, 0, 0, 320, 240);

    const base64Image = canvas.toDataURL("image/jpeg", 0.8);

    try {
      const res = await fetch(apiUrl("/api/live_emotion"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ image: base64Image }),
      });

      const data = await res.json();
      if (
        sessionId !== scanSessionRef.current ||
        !isScanningRef.current ||
        finalizingScanRef.current ||
        requestId < appliedLiveRequestRef.current
      ) {
        return;
      }
      appliedLiveRequestRef.current = requestId;

      // set scan result for UI
      const nextResult = {
        emotion: data.emotion,
        emotionScore: Math.round(data.confidence),
        voiceSentiment: {
          tone: "Analyzing",
          confidence: 0,
        },
      };
      latestEmotionResultRef.current = {
        emotion: nextResult.emotion,
        emotionScore: nextResult.emotionScore,
      };
      setScanResult(nextResult);

    } catch (err) {
      console.error("Emotion detection error:", err);
    }
  };

  const currentIdx = STEPS.findIndex((s) => s.key === step);

  const resetCurrentAssessment = async () => {
    clearInterval(intervalRef.current);
    intervalRef.current = null;
    setCameraReady(false);
    setScanning(false);
    setScanStarted(false);
    setCountdown(SCAN_DURATION_SECONDS);
    isScanningRef.current = false;
    finalizingScanRef.current = false;
    liveRequestRef.current = 0;
    appliedLiveRequestRef.current = 0;
    scanSessionRef.current += 1;
    latestEmotionResultRef.current = {
      emotion: "No Face Detected",
      emotionScore: 0,
    };
    setScanResult(null);
    await fetch(apiUrl("/api/reset_emotion"), { method: "POST" }).catch(() => {});
  };

  const handleRetest = async () => {
    await resetCurrentAssessment();
    setEmotionData((prev) => ({
      ...(prev || {}),
      step: "scan",
      scanResult: null,
      latestEmotionResult: {
        emotion: "No Face Detected",
        emotionScore: 0,
      },
    }));
    setStep("scan");
  };

  const startScan = async () => {
    if (scanning || scanStarted || intervalRef.current) return;

    scanSessionRef.current += 1;
    liveRequestRef.current = 0;
    appliedLiveRequestRef.current = 0;
    finalizingScanRef.current = false;
    isScanningRef.current = false;
    latestEmotionResultRef.current = {
      emotion: "No Face Detected",
      emotionScore: 0,
    };
    setScanResult(null);
    clearInterval(intervalRef.current);
    intervalRef.current = null;
    try {
      await fetch(apiUrl("/api/reset_emotion"), { method: "POST" }).catch(() => {});

      if (uploadedVideoUrlRef.current) {
        URL.revokeObjectURL(uploadedVideoUrlRef.current);
        uploadedVideoUrlRef.current = null;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      await startAudioCapture(stream);

      setCameraReady(true);
      setScanning(true);
      isScanningRef.current = true;
      setScanStarted(true);
      setCountdown(SCAN_DURATION_SECONDS);

      const startTime = Date.now();

      intervalRef.current = setInterval(() => {

        detectEmotion(); // send frame to DeepFace

        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        const remaining = SCAN_DURATION_SECONDS - elapsed;

        setCountdown(remaining > 0 ? remaining : 0);

        if (elapsed >= SCAN_DURATION_SECONDS) {
          stopScan();
        }

      }, 1000);

    } catch (err) {
      toast.error("Camera or microphone permission denied.");
    }
  };

  const handleVideoUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (scanning || intervalRef.current) {
      event.target.value = "";
      return;
    }

    scanSessionRef.current += 1;
    liveRequestRef.current = 0;
    appliedLiveRequestRef.current = 0;
    finalizingScanRef.current = false;
    isScanningRef.current = false;
    latestEmotionResultRef.current = {
      emotion: "No Face Detected",
      emotionScore: 0,
    };
    setScanResult(null);
    clearInterval(intervalRef.current);
    intervalRef.current = null;
    await fetch(apiUrl("/api/reset_emotion"), { method: "POST" }).catch(() => {});

    const stream = videoRef.current?.srcObject;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }

    if (uploadedVideoUrlRef.current) {
      URL.revokeObjectURL(uploadedVideoUrlRef.current);
      uploadedVideoUrlRef.current = null;
    }

    const uploadedUrl = URL.createObjectURL(file);
    uploadedVideoUrlRef.current = uploadedUrl;

    try {
      if (videoRef.current) {
        videoRef.current.srcObject = null;
        videoRef.current.src = uploadedUrl;
        await videoRef.current.play();

        const mediaStream =
          (typeof videoRef.current.captureStream === "function" && videoRef.current.captureStream()) ||
          (typeof videoRef.current.mozCaptureStream === "function" && videoRef.current.mozCaptureStream()) ||
          null;

        if (mediaStream) {
          await startAudioCapture(mediaStream);
        }
      }
    } catch (err) {
      console.error("Video upload playback error:", err);
      toast.error("Could not play uploaded video. Please try another file.");
      return;
    }

    setCameraReady(true);
    setScanning(true);
    isScanningRef.current = true;
    setScanStarted(true);
    setCountdown(SCAN_DURATION_SECONDS);

    const startTime = Date.now();
    intervalRef.current = setInterval(() => {
      if (!videoRef.current || videoRef.current.paused || videoRef.current.ended) {
        stopScan();
        return;
      }

      detectEmotion();
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const remaining = SCAN_DURATION_SECONDS - elapsed;
      setCountdown(remaining > 0 ? remaining : 0);

      if (elapsed >= SCAN_DURATION_SECONDS) {
        stopScan();
      }
    }, 1000);

    event.target.value = "";
  };

  const stopScan = async () => {
    setScanning(false);
    isScanningRef.current = false;
    finalizingScanRef.current = true;
    clearInterval(intervalRef.current);
    intervalRef.current = null;

    const stream = videoRef.current?.srcObject;

    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }

    if (videoRef.current && uploadedVideoUrlRef.current) {
      videoRef.current.pause();
      videoRef.current.removeAttribute("src");
      videoRef.current.load();
      URL.revokeObjectURL(uploadedVideoUrlRef.current);
      uploadedVideoUrlRef.current = null;
    }
    const latestEmotion = latestEmotionResultRef.current || {
      emotion: "No Face Detected",
      emotionScore: 0,
    };
    const emotion = latestEmotion.emotion || "No Face Detected";
    const emotionScore = Number.isFinite(latestEmotion.emotionScore) ? latestEmotion.emotionScore : 0;

    const initialResult = {
      emotion: emotion,
      emotionScore: emotionScore,
      voiceSentiment: {
        tone: "Analyzing",
        confidence: 0,
      },
    };
    setScanResult(initialResult);

    const { recommendations } = getMusicTherapy(
      emotion,
      Number(age),
      stressScore,
      depression.label
    );

    const baseReport = {
      name,
      age: Number(age),
      date: new Date().toISOString(),

      questions: QUESTIONS,
      surveyScores: scores,

      avgScore,
      stressScore,
      depressionIndicator: depression.label,
      stabilityScore,

      emotion,
      emotionScore,
      voiceSentiment: initialResult.voiceSentiment,

      stressRisk: getStressRisk(emotion, avgScore).label,

      aiInsight: getInsight(name, emotion, avgScore, stressScore, depression.label, stabilityScore),

      musicTherapy: recommendations,
    };

    /* ===== GO TO REPORT PAGE ===== */
    setStep("report");

    const finalizeReport = async () => {
      const voiceSentiment = await analyzeVoiceAudio();
      await stopAudioCapture();

      setScanResult({
        emotion,
        emotionScore,
        voiceSentiment,
      });

      const report = {
        ...baseReport,
        voiceSentiment,
      };

      await addDoc(collection(db, REPORT_COLLECTION_PRIMARY), report);
    };

    finalizeReport().catch(async (err) => {
      console.error("Final report generation error:", err);
      await stopAudioCapture();
      setScanResult({
        emotion,
        emotionScore,
        voiceSentiment: {
          tone: "Neutral",
          confidence: 0,
        },
      });
      try {
        await addDoc(collection(db, REPORT_COLLECTION_PRIMARY), {
          ...baseReport,
          voiceSentiment: {
            tone: "Neutral",
            confidence: 0,
          },
        });
      } catch (saveErr) {
        console.error("Report save fallback error:", saveErr);
      }
    });
  };

  /* ===== FETCH PREVIOUS REPORTS FROM FIRESTORE ===== */

  const fetchPreviousReports = async () => {
    const error = validatePatientInfo();
    if (error) {
      setInfoError(error);
      toast.error(error);
      return;
    }

    const reports = [];
    const collectionsToRead = [REPORT_COLLECTION_PRIMARY, REPORT_COLLECTION_LEGACY];

    for (const collectionName of collectionsToRead) {
      const q = query(
        collection(db, collectionName),
        where("name", "==", name.trim()),
        where("age", "==", Number(age))
      );

      const querySnapshot = await getDocs(q);
      querySnapshot.forEach((doc) => {
        reports.push({ id: `${collectionName}:${doc.id}`, ...doc.data() });
      });
    }

    if (reports.length === 0) {
      toast.info("No reports found for this user.");
      return;
    }

    reports.sort((a, b) => new Date(b.date) - new Date(a.date));

    setPreviousReports(reports);
    setShowReportsPopup(true);
  };
  /* ---------- Report helpers ---------- */

  const avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  const stressScore = getStressScore(scores);
  const depression = getDepressionIndicator(scores);
  const stabilityScore = getStabilityScore(scores);

  const sanitizeFilePart = (value) =>
    String(value || "User")
      .replace(/[<>:"/\\|?*]/g, "")
      .split("")
      .filter((ch) => ch.charCodeAt(0) >= 32)
      .join("")
      .trim()
      .replace(/\s+/g, "_") || "User";

  const formatDateTag = (value) => {
    const d = value ? new Date(value) : new Date();
    if (Number.isNaN(d.getTime())) return "report";
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}`;
  };

  const formatHumanDate = (value) => {
    const d = value ? new Date(value) : new Date();
    if (Number.isNaN(d.getTime())) return new Date().toLocaleDateString();
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const buildProfessionalReportPdf = (reportData) => {
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 40;
    const contentWidth = pageWidth - margin * 2;
    const lineHeight = 15;

    const colors = {
      primary: [30, 64, 175],
      accent: [15, 118, 110],
      text: [15, 23, 42],
      muted: [100, 116, 139],
      soft: [241, 245, 249],
      border: [203, 213, 225],
    };

    let y = margin;

    const drawTopBand = () => {
      doc.setFillColor(...colors.primary);
      doc.rect(0, 0, pageWidth, 14, "F");
    };

    const ensureSpace = (needed = 40) => {
      if (y + needed <= pageHeight - margin) return;
      doc.addPage();
      y = margin;
      drawTopBand();
    };

    const sectionTitle = (title) => {
      ensureSpace(40);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(...colors.primary);
      doc.text(title, margin, y);
      y += 8;
      doc.setDrawColor(...colors.border);
      doc.line(margin, y, pageWidth - margin, y);
      y += 14;
    };

    const keyValue = (label, value, opts = {}) => {
      const labelWidth = opts.labelWidth || 120;
      const valueX = margin + labelWidth;
      const maxWidth = pageWidth - margin - valueX;
      const safeValue =
        value === undefined || value === null || value === "" ? "N/A" : String(value);
      const lines = doc.splitTextToSize(safeValue, maxWidth);
      ensureSpace(lines.length * lineHeight + 4);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(...colors.muted);
      doc.text(label, margin, y);

      doc.setFont("helvetica", "normal");
      doc.setTextColor(...colors.text);
      doc.text(lines, valueX, y);

      y += lines.length * lineHeight + 3;
    };

    const paragraph = (text) => {
      const safeText = text || "N/A";
      const lines = doc.splitTextToSize(safeText, contentWidth);
      ensureSpace(lines.length * lineHeight + 6);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(...colors.text);
      doc.text(lines, margin, y);
      y += lines.length * lineHeight + 6;
    };

    const metricCard = (x, title, value) => {
      doc.setFillColor(...colors.soft);
      doc.setDrawColor(...colors.border);
      doc.roundedRect(x, y, 120, 52, 6, 6, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(...colors.muted);
      doc.text(title, x + 10, y + 18);
      doc.setFontSize(14);
      doc.setTextColor(...colors.accent);
      doc.text(String(value ?? "N/A"), x + 10, y + 38);
    };

    const addPageNumbers = () => {
      const total = doc.getNumberOfPages();
      for (let i = 1; i <= total; i += 1) {
        doc.setPage(i);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(...colors.muted);
        doc.text(`Page ${i} of ${total}`, pageWidth - margin, pageHeight - 18, {
          align: "right",
        });
      }
    };

    const voiceTone = reportData.voiceSentiment?.tone || "N/A";
    const voiceConfidence =
      reportData.voiceSentiment?.confidence !== undefined
        ? `${reportData.voiceSentiment.confidence}%`
        : "N/A";

    drawTopBand();

    doc.setFillColor(...colors.soft);
    doc.roundedRect(margin, y, contentWidth, 92, 8, 8, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor(...colors.primary);
    doc.text("Emotional Well-Being Assessment Report", margin + 14, y + 32);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...colors.muted);
    doc.text(`Generated: ${formatHumanDate(reportData.date)}`, margin + 14, y + 52);
    doc.text("Prepared by EmotionWellbeing", margin + 14, y + 68);
    y += 112;

    sectionTitle("Patient Information");
    keyValue("Name", reportData.name);
    keyValue("Age", reportData.age);
    keyValue("Assessment Date", formatHumanDate(reportData.date));

    sectionTitle("Clinical Summary");
    const cardGap = 10;
    const startX = margin;
    metricCard(startX, "Average Score", `${reportData.avgScore ?? "N/A"}/10`);
    metricCard(startX + 120 + cardGap, "Stress Score", `${reportData.stressScore ?? "N/A"}/10`);
    metricCard(startX + (120 + cardGap) * 2, "Depression", reportData.depressionIndicator);
    metricCard(
      startX + (120 + cardGap) * 3,
      "Stability",
      `${getStabilityPercent(reportData.stabilityScore)}%`
    );
    y += 66;

    sectionTitle("Survey Response Details");
    const questions = normalizeSurveyQuestions(reportData.questions);
    const surveyScores = normalizeSurveyScores(reportData.surveyScores);
    questions.forEach((question, i) => {
      const score = surveyScores[i] !== undefined ? `${surveyScores[i]}/10` : "N/A";
      keyValue(`${i + 1}.`, `${question}  (${score})`, { labelWidth: 24 });
    });

    sectionTitle("AI Emotion Analysis");
    keyValue("Detected Emotion", reportData.emotion);
    keyValue("Emotion Score", reportData.emotionScore);
    keyValue("Stress Risk", reportData.stressRisk);
    keyValue("Voice Tone", `${voiceTone} (${voiceConfidence})`);
    if (reportData.wellbeingScore !== undefined) {
      keyValue("Wellbeing Score", `${reportData.wellbeingScore}%`);
    }

    sectionTitle("AI Insight");
    paragraph(reportData.aiInsight);

    sectionTitle("Supportive Listening Plan");
    const therapies = reportData.musicTherapy || [];
    if (therapies.length === 0) {
      paragraph("No therapy recommendation available.");
    } else {
      therapies.forEach((therapy, idx) => {
        ensureSpace(80);
        doc.setFillColor(...colors.soft);
        doc.setDrawColor(...colors.border);
        doc.roundedRect(margin, y, contentWidth, 78, 6, 6, "FD");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(...colors.primary);
        doc.text(
          therapy.name || therapy.therapy || therapy.tag || `Recommendation ${idx + 1}`,
          margin + 10,
          y + 18
        );
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(...colors.text);
        doc.text(`Frequency: ${therapy.freq || "N/A"}`, margin + 10, y + 36);
        doc.text(
          `Benefit: ${therapy.helps || therapy.benefit || therapy.purpose || "N/A"}`,
          margin + 10,
          y + 52
        );
        doc.text(`Duration: ${therapy.duration || "N/A"}`, margin + 10, y + 68);
        y += 90;
      });
    }

    sectionTitle("References");
    paragraph("Sources: general music-based intervention research and professional music-therapy guidance.");
    paragraph(
      "This report is for wellness guidance and not a substitute for clinical diagnosis or emergency care."
    );

    addPageNumbers();
    const fileName = `Emotional_Wellbeing_Report_${sanitizeFilePart(reportData.name)}_${formatDateTag(
      reportData.date
    )}.pdf`;
    doc.save(fileName);
  };

  const downloadPreviousReport = (report) => {
    const normalizedStabilityScore =
      report.surveyScores?.length ? getStabilityScore(report.surveyScores) : report.stabilityScore;

    buildProfessionalReportPdf({
      name: report.name,
      age: report.age,
      date: report.date,
      questions: normalizeSurveyQuestions(report.questions),
      surveyScores: normalizeSurveyScores(report.surveyScores),
      avgScore: report.avgScore,
      stressScore: report.stressScore,
      depressionIndicator: report.depressionIndicator,
      stabilityScore: normalizedStabilityScore,
      stabilityPercent: report.stabilityPercent ?? getStabilityPercent(normalizedStabilityScore),
      emotion: report.emotion,
      emotionScore: report.emotionScore,
      voiceSentiment: report.voiceSentiment,
      stressRisk: report.stressRisk,
      aiInsight: report.aiInsight,
      musicTherapy: report.musicTherapy || [],
    });
  };

  const downloadPDF = () => {
    if (!scanResult) return;

    const { emotion, emotionScore, voiceSentiment } = scanResult;
    const stressRisk = getStressRisk(emotion, avgScore);
    const wellbeingScore = clampPercent(
      (100 - avgScore * 8 + emotionScore * 0.2 + stabilityScore * 2) / 1.2
    );
    const { recommendations } = getMusicTherapy(
      emotion,
      Number(age),
      stressScore,
      depression.label,
      stabilityScore
    );

    buildProfessionalReportPdf({
      name,
      age,
      date: new Date().toISOString(),
      questions: QUESTIONS,
      surveyScores: scores,
      avgScore,
      stressScore,
      depressionIndicator: depression.label,
      stabilityScore,
      stabilityPercent: getStabilityPercent(stabilityScore),
      emotion,
      emotionScore,
      voiceSentiment,
      stressRisk: stressRisk.label,
      wellbeingScore,
      aiInsight: getInsight(
        name,
        emotion,
        avgScore,
        stressScore,
        depression.label,
        stabilityScore
      ),
      musicTherapy: recommendations || [],
    });
  };

  /* =====================================================
     RENDER
  ===================================================== */

  const isInfoValid =
    name.trim().length >= 2 &&
    age.trim().length > 0 &&
    Number(age) >= 1 &&
    Number(age) <= 100;
  const surveyAnsweredCount = scores.filter((s) => Number.isFinite(s)).length;
  const surveyProgressPct = Math.round((surveyAnsweredCount / QUESTIONS.length) * 100);
  const scanProgressPct = ((SCAN_DURATION_SECONDS - countdown) / SCAN_DURATION_SECONDS) * 100;
  const allSurveyAnswered = surveyAnsweredCount === QUESTIONS.length;

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-6xl mx-auto px-4 py-6">
        {/* ===== Step Indicator ===== */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const isActive = i === currentIdx;
            const isDone = i < currentIdx;
            return (
              <div key={s.key} className="flex items-center gap-2">
                  <div
                    className="flex items-center gap-2 px-3 py-2 rounded-full text-xs font-medium text-white transition-all"
                    style={
                      isActive
                        ? { background: palette.blue, border: "1px solid #5e3db4" }
                        : isDone
                          ? { background: palette.blue, border: "1px solid #5e3db4" }
                          : { background: palette.blue, border: "1px solid #5e3db4", opacity: 0.82 }
                    }
                  >
                  <Icon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{s.label}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`w-8 h-0.5 ${i < currentIdx ? "" : "bg-border"}`} style={i < currentIdx ? { background: palette.blue } : undefined} />
                )}
              </div>
            );
          })}
        </div>

        {showReportsPopup && (

          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">

            <div className="bg-white rounded-xl p-6 w-[500px] max-h-[70vh] overflow-y-auto shadow-xl">

              <h2 className="text-xl font-bold mb-4">
                Previous Reports
              </h2>

              {previousReports.map((report) => (
                <div
                  key={report.id}
                  className="flex justify-between items-center border-b py-3"
                >

                  <div>
                    <p className="font-semibold">{report.name}</p>
                      <p className="text-sm text-[#6b7f90]">
                      {new Date(report.date).toLocaleDateString()}
                    </p>
                  </div>


                  <Button
                    size="sm"
                    onClick={() => downloadPreviousReport(report)}
                  >
                    Download
                  </Button>

                </div>
              ))}

              <Button
                variant="outline"
                onClick={() => setShowReportsPopup(false)}
                className="mt-4 w-full flex items-center justify-center gap-2 transition-all hover:-translate-y-0.5"
              >
                Close
                <X className="w-4 h-4" />
              </Button>

            </div>
          </div>

        )}

        {/* ===== Content ===== */}
        <AnimatePresence mode="wait">



          {/* ---------- STEP 1: USER INFO ---------- */}
          {step === "info" && (
            <motion.div key="info" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.3 }} className="max-w-lg mx-auto">
              <Card className="overflow-hidden border border-[#d7e0ec] shadow-[0_24px_54px_rgba(34,48,70,0.08)]">
                <div
                  className="relative overflow-hidden p-6 text-center"
                  style={{
                    background:
                      "radial-gradient(circle at 18% 18%, rgba(56,163,209,0.32), transparent 28%), radial-gradient(circle at 82% 16%, rgba(231,242,255,0.24), transparent 30%), linear-gradient(135deg, #081c30 0%, #0b2f55 48%, #1f5f99 100%)",
                  }}
                >
                  <div
                    className="absolute inset-0"
                    style={{
                      background:
                        "radial-gradient(circle at 14% 18%, rgba(216,237,248,0.18) 0, rgba(216,237,248,0) 28%), radial-gradient(circle at 86% 12%, rgba(255,255,255,0.12) 0, rgba(255,255,255,0) 24%), linear-gradient(180deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.01) 100%)",
                    }}
                  />
                  <div
                    className="absolute inset-x-0 bottom-0 h-px"
                    style={{ background: "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.24) 50%, rgba(255,255,255,0) 100%)" }}
                  />
                  <div className="relative inline-flex items-center justify-center w-16 h-16 rounded-xl mb-4 border border-white/12 bg-white/10 shadow-[0_14px_30px_rgba(12,22,39,0.18)] backdrop-blur-sm">
                    <Brain className="relative w-7 h-7 text-white" />
                  </div>
                  <div className="relative mx-auto mb-3 flex w-fit items-center justify-center rounded-md border border-[#97a9c6]/30 bg-[#e7edf8] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#42556f]">
                    AI Assessment Intake
                  </div>
                  <h2 className="relative text-xl font-bold tracking-[-0.02em] text-white">Emotional Well-Being Assessment</h2>
                  <p className="relative mx-auto mt-2 max-w-sm text-sm leading-6 text-[#d8e0eb]">
                    Complete your patient details to begin the guided survey and AI scan workflow.
                  </p>
                </div>
                <CardContent className="p-6 space-y-5" style={{ background: "linear-gradient(180deg, #fbfcfe 0%, #ffffff 68%)" }}>
                  <div className="space-y-2">
                    <Label htmlFor="name" className="flex items-center gap-2 text-foreground">
                      <User className="w-4 h-4 text-primary" /> Full Name
                    </Label>
                    <Input
                      id="name"
                      placeholder="Enter your name"
                      value={name}
                      onChange={handleNameInput}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="age" className="flex items-center gap-2 text-foreground">
                      <Calendar className="w-4 h-4 text-primary" /> Age
                    </Label>
                    <Input
                      id="age"
                      type="number"
                      placeholder="Enter your age (1-100)"
                      value={age}
                      onChange={handleAgeInput}
                      min={1}
                      max={100}
                    />
                  </div>
                  {infoError && (
                      <div className="rounded-lg border border-[#f5c9bf] bg-[#fdecea] px-3 py-2 text-sm text-[#dd5b42]">
                      {infoError}
                    </div>
                  )}
                  <Button
                    onClick={handleContinueToSurvey}
                    size="lg"
                      className="w-full mt-2 flex items-center justify-center gap-2 transition-all hover:gap-3"
                      style={{
                        background: palette.blue,
                        color: "#ffffff",
                        opacity: isInfoValid ? 1 : 0.96,
                      }}
                  >
                    Continue to Assessment
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => fetchPreviousReports()}
                  >
                    View Previous Reports
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* ---------- STEP 2: SURVEY ---------- */}
          {step === "survey" && (
            <motion.div key="survey" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.3 }}>
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 rounded-lg bg-medical-teal-light">
                  <ClipboardList className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-foreground">Emotional Well-Being Self-Assessment</h2>
                  <p className="text-sm text-muted-foreground">Rate each statement from 1 (minimal) to 10 (severe)</p>
                </div>
              </div>

              <div className="mb-6 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="font-semibold text-primary">{surveyAnsweredCount}/{QUESTIONS.length} completed</span>
                </div>
                <Progress value={surveyProgressPct} className="h-2" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {QUESTIONS.map((q, i) => (
                  <Card key={i} className="medical-card">
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start mb-3">
                        <p className="text-sm font-medium text-foreground leading-snug pr-3">
                          <span className="text-primary font-bold mr-1">{i + 1}.</span>{q}
                        </p>
                        <span className="shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full bg-medical-teal-light text-primary text-sm font-bold">
                          {Number.isFinite(scores[i]) ? scores[i] : "-"}
                        </span>
                      </div>
                      <Slider
                        min={1}
                        max={10}
                        step={1}
                        value={[Number.isFinite(scores[i]) ? scores[i] : 1]}
                        onValueChange={([v]) => handleScoreChange(i, v)}
                      />
                      <div className="flex justify-between text-[11px] text-muted-foreground mt-1">
                        <span>Not at all</span><span>Extremely</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {allSurveyAnswered && (
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center">
                  <Button onClick={() => setStep("scan")} size="lg" className="px-8">
                    Continue to AI Emotional Scan <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </motion.div>
              )}
            </motion.div>
          )}

          {/* ---------- STEP 3: AI SCAN ---------- */}
          {step === "scan" && (
            <motion.div key="scan" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.3 }}>
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 rounded-lg bg-medical-blue-light">
                  <Activity className="w-5 h-5 text-medical-blue" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-foreground">AI Emotional Scan</h2>
                  <p className="text-sm text-muted-foreground">Facial emotion detection & voice sentiment analysis</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Camera Preview */}
                <Card className="medical-card overflow-hidden">
                  <CardContent className="p-0">
                    <div className="relative aspect-video bg-muted flex items-center justify-center overflow-hidden rounded-t-xl">
                      <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
                      <canvas ref={canvasRef} className="hidden" />
                      {!cameraReady && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted">
                          <Camera className="w-12 h-12 text-muted-foreground mb-3" />
                          <p className="text-sm text-muted-foreground">Camera preview will appear here</p>
                        </div>
                      )}
                      {scanning && (
                        <div className="absolute inset-0 border-4 border-primary/50 rounded-t-xl scan-ring" />
                      )}
                    </div>
                    <div className="p-4 flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${scanning ? "bg-medical-green scan-pulse" : "bg-muted-foreground/30"}`} />
                      <span className="text-sm text-muted-foreground">{scanning ? "Camera active" : "Camera standby"}</span>
                      <div className={`w-3 h-3 rounded-full ml-4 ${scanning ? "bg-medical-green scan-pulse" : "bg-muted-foreground/30"}`} />
                      <span className="text-sm text-muted-foreground">{scanning ? "Microphone active" : "Mic standby"}</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Scan Controls */}
                <Card className="medical-card">
                  <CardContent className="p-6 flex flex-col justify-between h-full">
                    {!scanStarted ? (
                      <div className="flex flex-col items-center justify-center text-center flex-1 space-y-6">
                        <div className="w-20 h-20 rounded-full bg-medical-teal-light flex items-center justify-center">
                          <Play className="w-8 h-8 text-primary ml-1" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-semibold text-foreground mb-1">Ready to Scan</h3>
                          <p className="text-sm text-muted-foreground max-w-xs">
                            The AI will analyze your facial expressions and voice tone for {SCAN_DURATION_SECONDS} seconds to evaluate your emotional state.
                          </p>
                        </div>
                        <div className="flex gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><Camera className="w-3.5 h-3.5" /> Webcam</span>
                          <span className="flex items-center gap-1"><Mic className="w-3.5 h-3.5" /> Microphone</span>
                        </div>
                        <div className="flex flex-col gap-3 w-full">

                          {/* Webcam Scan */}
                          <Button onClick={startScan} className="w-full" disabled={scanning || scanStarted}>
                            <Camera className="w-4 h-4 mr-2" />
                            Start Live Scan (Webcam)
                          </Button>

                          {/* Upload Video */}
                           <Button
                              onClick={() => fileInputRef.current.click()}
                              style={{ background: palette.blue, color: "#ffffff" }}
                              className="w-full"
                              disabled={scanning || scanStarted}
                            >
                            <Upload className="w-4 h-4 mr-2" />
                            Upload Video for Analysis
                          </Button>

                          <input
                            type="file"
                            accept="video/*"
                            ref={fileInputRef}
                            style={{ display: "none" }}
                            onChange={handleVideoUpload}
                          />

                        </div>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        <div className="text-center">
                          <div className="inline-flex items-center justify-center w-24 h-24 rounded-full border-4 border-primary/20 mb-3">
                            <span className="text-3xl font-bold text-primary">{countdown}</span>
                          </div>
                          <p className="text-sm font-medium text-foreground">seconds remaining</p>
                        </div>
                        <div className="space-y-2">
                          <Progress value={scanProgressPct} className="h-2.5" />
                          <p className="text-xs text-muted-foreground text-center">{Math.round(scanProgressPct)}% complete</p>
                        </div>
                        <div className="bg-medical-teal-light rounded-lg p-4 text-center">
                          <div className="flex items-center justify-center gap-2 mb-1">
                            <Activity className="w-4 h-4 text-primary scan-pulse" />
                            <span className="text-sm font-semibold text-primary">Scanning in Progress</span>
                          </div>
                          <p className="text-xs text-muted-foreground">AI analyzing facial expression and voice tone</p>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          {EMOTIONS.map((e) => (
                            <div key={e} className="text-center py-2 rounded-md bg-muted text-xs font-medium text-muted-foreground">{e}</div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </motion.div>
          )}

          {/* ---------- STEP 4: REPORT ---------- */}
          {step === "report" && scanResult && (
            <motion.div key="report" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
              {(() => {
                const { emotion, emotionScore, voiceSentiment } = scanResult;
                const stressRisk = getStressRisk(emotion, avgScore);
                const wellbeingScore = clampPercent(
                  (100 - avgScore * 8 + emotionScore * 0.2 + stabilityScore * 2) / 1.2
                );
                const stabilityPercent = getStabilityPercent(stabilityScore);
                const stressCardTone =
                  stressScore >= 7
                    ? {
                        shell: "border-[#f5c9bf] bg-[linear-gradient(180deg,#fff3ef_0%,#ffffff_100%)]",
                        value: "text-[#d65b42]",
                        chip: "bg-[#fde7e1] text-[#d65b42]",
                      }
                    : stressScore >= 4
                      ? {
                          shell: "border-[#f4dfb1] bg-[linear-gradient(180deg,#fff8eb_0%,#ffffff_100%)]",
                          value: "text-[#d59a19]",
                          chip: "bg-[#fff1cf] text-[#c98b00]",
                        }
                      : {
                          shell: "border-[#cfe8df] bg-[linear-gradient(180deg,#f2fbf7_0%,#ffffff_100%)]",
                          value: "text-[#0f9f7a]",
                          chip: "bg-[#daf5ec] text-[#0f9f7a]",
                        };
                const depressionCardTone =
                  depression.label === "High Depression"
                    ? {
                        shell: "border-[#f5c9bf] bg-[linear-gradient(180deg,#fff3ef_0%,#ffffff_100%)]",
                        chip: "bg-[#fde7e1]",
                      }
                    : depression.label === "Moderate Depression"
                      ? {
                          shell: "border-[#f4dfb1] bg-[linear-gradient(180deg,#fff8eb_0%,#ffffff_100%)]",
                          chip: "bg-[#fff1cf]",
                        }
                      : depression.label === "Low Depression"
                        ? {
                            shell: "border-[#f3e7bb] bg-[linear-gradient(180deg,#fffbed_0%,#ffffff_100%)]",
                            chip: "bg-[#fff5d8]",
                          }
                        : {
                            shell: "border-[#cfe8df] bg-[linear-gradient(180deg,#f2fbf7_0%,#ffffff_100%)]",
                            chip: "bg-[#daf5ec]",
                          };
                const stabilityCardTone =
                  stabilityPercent >= 75
                    ? {
                        shell: "border-[#cbdaf8] bg-[linear-gradient(180deg,#edf3ff_0%,#ffffff_100%)]",
                        value: "text-[#315efb]",
                        chip: "bg-[#dfe8ff] text-[#315efb]",
                      }
                    : stabilityPercent >= 45
                      ? {
                          shell: "border-[#e0dbf7] bg-[linear-gradient(180deg,#f7f3ff_0%,#ffffff_100%)]",
                          value: "text-[#6d59d8]",
                          chip: "bg-[#eee7ff] text-[#6d59d8]",
                        }
                      : {
                          shell: "border-[#f3d4cc] bg-[linear-gradient(180deg,#fff4f1_0%,#ffffff_100%)]",
                          value: "text-[#c8654a]",
                          chip: "bg-[#ffe5de] text-[#c8654a]",
                        };
                const { recommendations, group } = getMusicTherapy(
                  emotion,
                  Number(age),
                  stressScore,
                  depression.label,
                  stabilityScore
                );

                return (
                  <>
                    {/* Header */}
                    <div className="mb-6 flex flex-col gap-4 rounded-xl border border-[#dce5f8] bg-[linear-gradient(135deg,#f8fbff_0%,#ffffff_100%)] p-5 shadow-[0_18px_42px_rgba(34,48,70,0.05)] sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[#eef3fb]">
                          <FileText className="w-5 h-5 text-[#315efb]" />
                        </div>
                        <div>
                          <h2 className="text-xl font-bold text-[#223046]">AI Wellbeing Report</h2>
                          <p className="text-sm text-muted-foreground">{name} • Age {age} • {new Date().toLocaleDateString()}</p>
                        </div>
                      </div>
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <Button onClick={handleRetest} variant="outline" size="sm">
                          Retest
                        </Button>
                        <Button onClick={downloadPDF} variant="outline" size="sm">
                          <Download className="w-4 h-4 mr-1" /> Download PDF
                        </Button>
                      </div>
                    </div>

                    <div className="mb-3">
                      <h3 className="text-sm font-semibold text-foreground">AI Face and Voice Scan Results</h3>
                      <p className="text-xs text-muted-foreground">
                        These results are based on webcam face detection and live voice-tone analysis.
                      </p>
                    </div>

                    {/* Stat Cards */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                      {[
                        { icon: Brain, label: "Scan Wellbeing Score", value: `${Math.round(wellbeingScore)}%`, bg: "bg-medical-teal-light", ic: "text-primary" },
                        { icon: Smile, label: "Face Detection Emotion", value: emotion, bg: "bg-medical-blue-light", ic: "text-medical-blue" },
                        { icon: ShieldAlert, label: "AI Stress Risk", value: stressRisk.label, bg: stressRisk.label === "High" ? "bg-medical-red-light" : stressRisk.label === "Moderate" ? "bg-medical-amber-light" : "bg-medical-green-light", ic: stressRisk.color },
                        { icon: Mic, label: "Voice Analysis Tone", value: voiceSentiment.tone, bg: "bg-medical-blue-light", ic: "text-medical-blue" },
                      ].map((stat, i) => {
                        const SIcon = stat.icon;
                        return (
                          <Card key={i} className="medical-card">
                            <CardContent className="p-4 flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${stat.bg}`}>
                                <SIcon className={`w-5 h-5 ${stat.ic}`} />
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">{stat.label}</p>
                                <p className="text-lg font-bold text-foreground">{stat.value}</p>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      {/* Survey & Stability */}
                      <Card className="medical-card overflow-hidden rounded-xl border border-[#d8e1f0] shadow-[0_20px_44px_rgba(34,48,70,0.07)] lg:col-span-2">
                        <CardHeader className="border-b border-[#e8eef7] bg-[linear-gradient(180deg,#fbfdff_0%,#f6f9fd_100%)] pb-4">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex items-start gap-3">
                              <span className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-[#d6e2f5] bg-white text-[#315efb]">
                                <TrendingUp className="w-4 h-4" />
                              </span>
                              <div>
                                <CardTitle className="text-[17px] font-bold text-[#223046]">Survey & Stability Analysis</CardTitle>
                                <p className="mt-1 text-sm text-[#70839b]">
                                  Survey response overview and stability indicators.
                                </p>
                              </div>
                            </div>
                            <div className="inline-flex w-fit rounded-md border border-[#dbe5f3] bg-white px-3 py-1 text-[11px] font-semibold text-[#5f7590] shadow-[0_6px_16px_rgba(34,48,70,0.04)]">
                              10 Questions
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-5 bg-white p-5">
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                            <div className="rounded-lg border border-[#d8e5f8] bg-[#fbfdff] p-4 shadow-[0_10px_22px_rgba(34,48,70,0.04)]">
                              <div className="mb-4 flex items-center justify-between">
                                <div className="inline-flex rounded-md bg-[#e8efff] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#315efb]">
                                  Survey
                                </div>
                              </div>
                              <div className="flex min-h-[72px] flex-col justify-between">
                                <p className="text-3xl font-extrabold leading-none text-[#223046]">{avgScore}</p>
                                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#7b8ca1]">Average Score</p>
                              </div>
                            </div>
                            <div className={`rounded-lg border bg-white p-4 shadow-[0_10px_22px_rgba(34,48,70,0.04)] ${stressCardTone.shell}`}>
                              <div className="mb-4 flex items-center justify-between">
                                <div className={`inline-flex rounded-md px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${stressCardTone.chip}`}>
                                  Stress
                                </div>
                              </div>
                              <div className="flex min-h-[72px] flex-col justify-between">
                                <p className={`text-3xl font-extrabold leading-none ${stressCardTone.value}`}>{stressScore}</p>
                                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#7b8ca1]">Stress Score</p>
                              </div>
                            </div>
                            <div className={`rounded-lg border bg-white p-4 shadow-[0_10px_22px_rgba(34,48,70,0.04)] ${depressionCardTone.shell}`}>
                              <div className="mb-4 flex items-center justify-between gap-2">
                                <div className={`inline-flex rounded-md px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${depressionCardTone.chip} ${depression.color}`}>
                                  Mood Risk
                                </div>
                              </div>
                              <div className="flex min-h-[72px] flex-col justify-between">
                                <p className={`text-[25px] font-extrabold leading-[1.1] ${depression.color}`}>{depression.label}</p>
                                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#7b8ca1]">Depression Signal</p>
                              </div>
                            </div>
                            <div className={`rounded-lg border bg-white p-4 shadow-[0_10px_22px_rgba(34,48,70,0.04)] ${stabilityCardTone.shell}`}>
                              <div className="mb-4 flex items-center justify-between">
                                <div className={`inline-flex rounded-md px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${stabilityCardTone.chip}`}>
                                  Balance
                                </div>
                              </div>
                              <div className="flex min-h-[72px] flex-col justify-between">
                                <p className={`text-3xl font-extrabold leading-none ${stabilityCardTone.value}`}>{stabilityPercent}%</p>
                                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#7b8ca1]">Stability Score</p>
                              </div>
                            </div>
                          </div>

                          <div className="rounded-lg border border-[#e7edf6] bg-[#fbfcfe] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                            <div className="mb-4 flex items-center justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold text-[#223046]">Question Responses</p>
                                <p className="mt-1 text-xs text-[#74869a]">Each response is scored on a scale of 1 to 10.</p>
                              </div>
                            </div>
                            <div className="space-y-3">
                              {scores.map((s, i) => {
                                const displayScore = Number.isFinite(s) ? s : 0;
                                const questionBarColor =
                                  displayScore >= 8
                                    ? "linear-gradient(90deg, #d76c52 0%, #f09b7d 100%)"
                                    : displayScore >= 5
                                      ? "linear-gradient(90deg, #d6a431 0%, #f2c45e 100%)"
                                      : "linear-gradient(90deg, #315efb 0%, #6d8dff 100%)";

                                return (
                                  <div key={i} className="rounded-lg border border-[#e8eef7] bg-white px-3 py-3 shadow-[0_8px_18px_rgba(34,48,70,0.04)]">
                                    <div className="mb-2 flex items-start gap-3">
                                      <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#eef3fb] text-[11px] font-bold text-[#48617b]">
                                        {i + 1}
                                      </span>
                                      <p className="flex-1 text-sm font-medium leading-6 text-[#2b3c50]">{QUESTIONS[i]}</p>
                                      <span className="inline-flex min-w-[48px] justify-center rounded-md border border-[#d8e2ef] bg-[#f7f9fc] px-2.5 py-1 text-xs font-semibold text-[#44586f]">
                                        {displayScore}/10
                                      </span>
                                    </div>
                                    <div className="ml-10 h-2.5 overflow-hidden rounded-full bg-[#e9eef6]">
                                      <div
                                        className="h-full rounded-full transition-all"
                                        style={{ width: `${displayScore * 10}%`, background: questionBarColor }}
                                      />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* AI Insight */}
                          <div className="p-4 rounded-lg bg-medical-teal-light border border-primary/10">
                            <p className="text-xs font-semibold text-primary mb-1">AI Insight</p>
                            <p className="text-sm text-foreground leading-relaxed">{getInsight(name, emotion, avgScore, stressScore, depression.label, stabilityScore)}</p>
                            {depression.label === "High Depression" && (
                              <div className="mt-3 inline-flex items-center rounded-md bg-[#fff1ec] px-3 py-1 text-xs font-semibold text-[#c95a3f]">
                                Recommended: Connect with a psychologist through CareConnect as soon as possible.
                              </div>
                            )}
                          </div>

                          {/* Voice */}
                          <div className="flex items-center gap-4 p-3 rounded-lg bg-medical-blue-light">
                            <Mic className="w-5 h-5 text-medical-blue" />
                            <div>
                              <p className="text-sm font-semibold text-foreground">Voice Sentiment: {voiceSentiment.tone}</p>
                              <p className="text-xs text-muted-foreground">Confidence: {voiceSentiment.confidence}%</p>
                            </div>
                            <div className="ml-auto">
                              <Progress value={voiceSentiment.confidence} className="w-24 h-2" />
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Music Therapy */}
                      <Card className="medical-card overflow-hidden rounded-xl border border-[#d9e1fb] shadow-[0_18px_42px_rgba(34,48,70,0.06)]">
                        <CardHeader className="pb-4 border-b border-[#e7edff] bg-[linear-gradient(135deg,#eff3ff_0%,#f9fbff_100%)]">
                          <CardTitle className="flex items-center gap-3 text-base">
                            <span className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-[#315efb] text-white">
                              <Headphones className="w-5 h-5" />
                            </span>
                            <div>
                              <p className="text-[17px] font-bold text-[#223046]">Music Therapy</p>
                              <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#5f74c9]">Personalized recommendation</p>
                            </div>
                          </CardTitle>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <span className="inline-flex rounded-md border border-[#d9e3f5] bg-white px-3 py-1 text-xs font-semibold text-[#52677f]">
                              Mood: {emotion}
                            </span>
                            <span className="inline-flex rounded-md border border-[#d9e3f5] bg-white px-3 py-1 text-xs font-semibold text-[#52677f]">
                              Survey: {stressScore >= 5 ? "Higher stress pattern" : depression.label === "High Depression" ? "Low mood pattern" : "Stable pattern"}
                            </span>
                            <span className="inline-flex rounded-md border border-[#d9e3f5] bg-white px-3 py-1 text-xs font-semibold text-[#52677f]">
                              Age Group: {group}
                            </span>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4 bg-[linear-gradient(180deg,#ffffff_0%,#fbfcff_100%)]">
                          {recommendations.map((r, i) => (
                            <div key={i} className="rounded-lg border border-[#dfe6fb] bg-[linear-gradient(180deg,#f4f7ff_0%,#ffffff_100%)] p-4 shadow-[0_12px_28px_rgba(34,48,70,0.05)]">

                              <div className="flex flex-wrap items-center gap-2">
                                <div className="inline-flex rounded-md bg-[#dfe8ff] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#315efb]">
                                  Recommended Session
                                </div>
                                <div className="inline-flex rounded-md border border-[#cad8ff] bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#315efb]">
                                  Frequency: {r.freq}
                                </div>
                                <div className="inline-flex rounded-md border border-[#d8e1f2] bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#60748e]">
                                  {r.brainwave}
                                </div>
                              </div>

                              <div className="mt-4">
                                <p className="text-lg font-bold leading-tight text-[#223046]">{r.therapy}</p>
                                <p className="mt-2 text-sm leading-6 text-[#64748b]">{r.purpose}</p>
                                <p className="mt-3 rounded-lg border border-[#e4ebfb] bg-white/90 px-3 py-3 text-sm leading-6 text-[#4d627a]">
                                  {r.userMessage}
                                </p>
                              </div>

                              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                <div className="rounded-lg border border-[#e8edfb] bg-white/80 p-3">
                                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6b7fd6]">Brainwave</p>
                                  <p className="mt-2 text-sm font-semibold text-[#223046]">{r.brainwave}</p>
                                  <p className="mt-2 text-sm leading-6 text-[#6a7b91]">{r.brainwaveBenefit}</p>
                                </div>
                                <div className="rounded-lg border border-[#e8edfb] bg-white/80 p-3">
                                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6b7fd6]">Frequency</p>
                                  <p className="mt-2 text-sm font-semibold text-[#223046]">{r.freq}</p>
                                  <p className="mt-2 text-sm leading-6 text-[#6a7b91]">{r.frequencyBenefit}</p>
                                </div>
                                <div className="rounded-lg border border-[#e8edfb] bg-white/80 p-3">
                                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6b7fd6]">Benefits</p>
                                  <p className="mt-2 text-sm font-semibold text-[#223046]">{r.helps}</p>
                                </div>
                                <div className="rounded-lg border border-[#e8edfb] bg-white/80 p-3">
                                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6b7fd6]">Duration</p>
                                  <p className="mt-2 text-sm font-semibold text-[#223046]">{r.duration}</p>
                                </div>
                                <div className="rounded-lg border border-[#e8edfb] bg-white/80 p-3">
                                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6b7fd6]">Sessions</p>
                                  <p className="mt-2 text-sm font-semibold text-[#223046]">{r.schedule}</p>
                                </div>
                                <div className="rounded-lg border border-[#e8edfb] bg-white/80 p-3 sm:col-span-2">
                                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#6b7fd6]">Why This Recommendation</p>
                                  <p className="mt-2 text-sm font-semibold leading-6 text-[#223046]">{r.explanation}</p>
                                </div>
                              </div>

                              <div className="mt-4 rounded-lg border border-[#e5ebff] bg-white/90 p-4">
                                <div className="flex items-center gap-2">
                                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-[#edf2ff] text-[#315efb]">
                                    <Music className="w-4 h-4" />
                                  </span>
                                  <p className="text-sm font-semibold text-[#223046]">Listening Method</p>
                                </div>
                                <p className="mt-3 text-sm leading-6 text-[#6c7b8f]">{r.listeningMethod}</p>
                              </div>
                              <Button
                                onClick={() => navigate("/harmony-therapy")}
                                className="w-full mt-4 flex items-center justify-center gap-2 rounded-lg"
                              >
                                Start Therapy
                                <ArrowRight className="w-4 h-4" />
                              </Button>

                            </div>
                          ))}
                          <p className="text-[11px] text-muted-foreground mt-1 px-1">
                            Ethical sources used for this guidance: AMTA, WFMT, and NCCIH music-and-health guidance.
                          </p>
                        </CardContent>
                      </Card>
                    </div>
                  </>
                );
              })()}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
