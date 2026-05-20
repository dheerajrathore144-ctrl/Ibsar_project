import React, { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom";
import Navbar from "./components/Navbar";
import GlobalToastHost from "./components/GlobalToastHost";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { EmotionProvider } from "./context/EmotionContext";

import Home from "./pages/Home";
import EmotionWellbeing from "./pages/EmotionWellbeing";
import HarmonyTherapy from "./pages/HarmonyTherapy";
import YogaProgram from "./pages/YogaProgram";
import CareConnect from "./pages/CareConnect";
import Subscription from "./pages/Subscription";
import AdminDashboard from "./pages/AdminDashboard";
import PsychologistDashboard from "./pages/PsychologistDashboard";
import PsychologistPortal from "./pages/PsychologistPortal";

function RoleRoute({ roles, element }) {
  const { loading, isAuthenticated, role } = useAuth();

  if (loading) {
    return (
      <div style={{ minHeight: "50vh", display: "grid", placeItems: "center", fontWeight: 600 }}>
        Loading...
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div style={{ minHeight: "50vh", display: "grid", placeItems: "center", fontWeight: 600 }}>
        Please login from Get Started to access this page.
      </div>
    );
  }

  if (!roles.includes(role)) {
    return (
      <div style={{ minHeight: "50vh", display: "grid", placeItems: "center", fontWeight: 600 }}>
        You do not have permission to access this page.
      </div>
    );
  }

  return element;
}

function AppShell({ darkMode, setDarkMode }) {
  const location = useLocation();
  const isProfessionalPortal = location.pathname.startsWith("/professionals/");

  return (
    <>
      {!isProfessionalPortal ? <Navbar darkMode={darkMode} setDarkMode={setDarkMode} /> : null}

      <div style={{ marginTop: isProfessionalPortal ? 0 : "70px" }}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/emotion-wellbeing" element={<EmotionWellbeing />} />
          <Route path="/harmony-therapy" element={<HarmonyTherapy />} />
          <Route path="/yoga-program" element={<YogaProgram />} />
          <Route path="/care-connect" element={<CareConnect />} />
          <Route path="/subscription" element={<Subscription />} />

          <Route
            path="/psychologist-apply"
            element={<Navigate to="/professionals/apply" replace />}
          />
          <Route
            path="/professionals/apply"
            element={<RoleRoute roles={["user", "psychologist", "admin"]} element={<PsychologistPortal />} />}
          />
          <Route
            path="/psychologist-dashboard"
            element={<RoleRoute roles={["psychologist", "admin"]} element={<PsychologistDashboard />} />}
          />
          <Route
            path="/admin"
            element={<RoleRoute roles={["admin"]} element={<AdminDashboard />} />}
          />
        </Routes>
      </div>
    </>
  );
}

function App() {
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
  }, [darkMode]);

  return (
    <AuthProvider>
      <EmotionProvider>
        <Router>
          <AppShell darkMode={darkMode} setDarkMode={setDarkMode} />
          <GlobalToastHost />
        </Router>
      </EmotionProvider>
    </AuthProvider>
  );
}

export default App;
