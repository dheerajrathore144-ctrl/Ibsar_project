import React from "react";
import { useNavigate } from "react-router-dom";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  Area,
  AreaChart,
  BarChart,
  Bar,
} from "recharts";

/* ---------------- DATA ---------------- */

const patientSummary = {
  emotion: "Happy",
  mood: 82,
  stress: 30,
  anxiety: 28,
};

const lineData = [
  { day: "Mon", mood: 65, stress: 40 },
  { day: "Tue", mood: 70, stress: 38 },
  { day: "Wed", mood: 75, stress: 35 },
  { day: "Thu", mood: 80, stress: 32 },
  { day: "Fri", mood: 82, stress: 30 },
];

const pieData = [
  { name: "Happy", value: 48 },
  { name: "Neutral", value: 28 },
  { name: "Sad", value: 14 },
  { name: "Angry", value: 10 },
];

const barData = [
  { name: "Mood", value: patientSummary.mood },
  { name: "Stress", value: patientSummary.stress },
  { name: "Anxiety", value: patientSummary.anxiety },
];

const COLORS = ["#22c55e", "#3b82f6", "#f59e0b", "#ef4444"];

/* ---------------- DASHBOARD ---------------- */

export default function AppleStyleDashboard() {
  const navigate = useNavigate();

  const downloadJSON = () => {
    const data = {
      patientSummary,
      trends: lineData,
      distribution: pieData,
      generatedAt: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });

    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "emotional-analytics-report.json";
    link.click();
  };

  const downloadTextReport = () => {
    const report = `
EMOTIONAL ANALYTICS REPORT

Dominant Emotion: ${patientSummary.emotion}
Mood Score: ${patientSummary.mood}%
Stress Level: ${patientSummary.stress}%
Anxiety Level: ${patientSummary.anxiety}%

NOTE:
This report can be shared with a medical professional.
    `;
    const blob = new Blob([report], { type: "text/plain" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "emotional-report.txt";
    link.click();
  };

  return (
    <div style={{ all: "initial", fontFamily: "Inter, system-ui" }}>
      <div style={{ minHeight: "100vh", background: "#f8fafc", padding: 32 }}>

        {/* HEADER */}
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <h1 style={{ fontSize: 26, fontWeight: 700 }}>
            Emotional Analytics Dashboard
          </h1>

          <button
            onClick={() => navigate(-1)}
            style={{
              background: "#e5e7eb",
              border: "none",
              padding: "8px 16px",
              borderRadius: 14,
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            ← Back
          </button>
        </div>

        {/* KPI CARDS */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 20,
            margin: "24px 0",
          }}
        >
          <KpiCard
            label="Dominant Emotion"
            value={patientSummary.emotion}
            bg="#ccfbf1"     // bluish-green
          />
          <KpiCard
            label="Mood Score"
            value={`${patientSummary.mood}%`}
            bg="#dbeafe"     // sky blue
          />
          <KpiCard
            label="Stress Level"
            value={`${patientSummary.stress}%`}
            bg="#fef9c3"     // soft yellow / skin tone
          />
          <KpiCard
            label="Anxiety Level"
            value={`${patientSummary.anxiety}%`}
            bg="#fde2e4"     // soft pink
          />
        </div>

        {/* ACTION BUTTONS */}
        <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
          <ActionButton onClick={downloadTextReport}>
            Download Report
          </ActionButton>
          <ActionButton onClick={downloadJSON}>
            Download Raw Data
          </ActionButton>
        </div>

        {/* MAIN CHARTS */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "2fr 1fr",
            gap: 24,
          }}
        >
          <Card title="Mood vs Stress Trend">
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={lineData}>
                <XAxis dataKey="day" />
                <YAxis />
                <Tooltip />
                <Legend verticalAlign="top" align="right" />

                <Area
                  type="monotone"
                  dataKey="mood"
                  stroke="#22c55e"
                  fill="rgba(34,197,94,0.2)"
                  strokeWidth={3}
                  name="Mood"
                />
                <Area
                  type="monotone"
                  dataKey="stress"
                  stroke="#ef4444"
                  fill="rgba(239,68,68,0.2)"
                  strokeWidth={3}
                  name="Stress"
                />
              </AreaChart>
            </ResponsiveContainer>
          </Card>

          <Card title="Emotion Distribution">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  outerRadius={90}
                  label={({ name, percent }) =>
                    `${name} ${(percent * 100).toFixed(0)}%`
                  }
                >
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value, name) => [`${value}%`, name]} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 24,
            marginTop: 24,
          }}
        >
          <Card title="Emotional Comparison">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={barData}>
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#3b82f6" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Card title="AI Insight Summary">
            <p style={{ lineHeight: 1.6, color: "#000000" }}>
              Your emotional trends show a <b>stable and positive mood</b> with
              controlled stress and anxiety levels. No immediate emotional risk
              is detected.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}

/* ---------------- UI COMPONENTS ---------------- */

function Card({ title, children }) {
  return (
    <div
      style={{
        background: "#ffffff",
        padding: 24,
        borderRadius: 22,
        boxShadow: "0 12px 40px rgba(0,0,0,0.08)",
      }}
    >
      <h3 style={{ marginBottom: 16, fontWeight: 600 }}>{title}</h3>
      {children}
    </div>
  );
}

function KpiCard({ label, value, bg }) {
  return (
    <div
      style={{
        background: bg,
        padding: 20,
        borderRadius: 20,
        boxShadow: "0 8px 24px rgba(0,0,0,0.06)",
      }}
    >
      <p style={{ fontSize: 14, color: "#000000" }}>{label}</p>
      <h2 style={{ fontSize: 26, fontWeight: 700 }}>{value}</h2>
    </div>
  );
}

function ActionButton({ children, ...props }) {
  return (
    <button
      {...props}
      style={{
        background: "#3b82f6",
        color: "#fff",
        border: "none",
        padding: "10px 18px",
        borderRadius: 16,
        cursor: "pointer",
        fontWeight: 600,
      }}
    >
      {children}
    </button>
  );
}
