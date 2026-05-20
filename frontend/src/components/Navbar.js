import React, { useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { GoogleLogin } from "@react-oauth/google";
import { useAuth } from "../context/AuthContext";

const palette = {
  primary: "#1f5f99",
  primaryHover: "#0b2f55",
  gold: "#d8edf8",
  cyan: "#38a3d1",
  smoky: "#f7fafc",
  smokyDeep: "#e8f1f7",
  border: "#bfd3e2",
  text: "#0b2f55",
  muted: "#617386",
};

export default function Navbar({ darkMode, setDarkMode }) {
  const location = useLocation();
  const isActive = (path) => location.pathname === path;
  const [showAuthModal, setShowAuthModal] = useState(false);

  const { user, profile, isAuthenticated, logout } = useAuth();

  const initials = useMemo(() => {
    const source = user?.displayName || user?.email || "U";
    const parts = source.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
  }, [user]);

  return (
    <>
      <nav style={{ ...nav, background: darkMode ? darkBg : lightBg }}>
        <div style={{ ...logo, color: darkMode ? "#fff" : palette.text }}>
          <span style={logoMark}>M</span>
          MeloMind
        </div>

        <div style={links}>
          <NavItem to="/" label="Home" active={isActive("/")} darkMode={darkMode} />
          <NavItem to="/emotion-wellbeing" label="Emotion Wellbeing" active={isActive("/emotion-wellbeing")} darkMode={darkMode} />
          <NavItem to="/harmony-therapy" label="Harmony Therapy" active={isActive("/harmony-therapy")} darkMode={darkMode} />
          <NavItem to="/care-connect" label="Care Connect" active={isActive("/care-connect")} darkMode={darkMode} />
          {isAuthenticated && profile?.role === "admin" ? (
            <NavItem to="/admin" label="Admin" active={isActive("/admin")} darkMode={darkMode} />
          ) : null}
          {isAuthenticated && profile?.role === "psychologist" ? (
            <NavItem
              to="/psychologist-dashboard"
              label="Psych Dashboard"
              active={isActive("/psychologist-dashboard")}
              darkMode={darkMode}
            />
          ) : null}
        </div>

        <div style={right}>
          <button
            className={`theme-toggle-button ${darkMode ? "is-dark" : "is-light"}`}
            onClick={() => setDarkMode(!darkMode)}
            style={{
              ...themeBtn,
            }}
            aria-label={darkMode ? "Switch to light theme" : "Switch to dark theme"}
          >
            <span className="theme-toggle-track">
              <span className="theme-toggle-sun" />
              <span className="theme-toggle-moon" />
              <span className="theme-toggle-knob" />
            </span>
          </button>

          {isAuthenticated ? (
            <div style={userWrap}>
              <div title={user?.email || ""} style={avatar}>
                {initials}
              </div>
              <div style={userMeta}>
                <p style={userName}>{user?.displayName || user?.email}</p>
                <p style={userEmail}>{user?.email}</p>
              </div>
              <button className="logout-button" style={logoutBtn} onClick={logout}>
                Logout
              </button>
            </div>
          ) : (
            <button className="auth-nav-button" style={cta} onClick={() => setShowAuthModal(true)}>
              Get Started
            </button>
          )}
        </div>
      </nav>

      {showAuthModal && (
        <AuthModal darkMode={darkMode} closeModal={() => setShowAuthModal(false)} />
      )}
    </>
  );
}

function NavItem({ to, label, active, darkMode }) {
  return (
    <Link
      to={to}
      style={{
        ...link,
        color: darkMode ? "#fff" : palette.text,
        borderBottom: active
          ? `2px solid ${darkMode ? "#fff" : palette.primary}`
          : "2px solid transparent",
      }}
    >
      {label}
    </Link>
  );
}

function AuthModal({ closeModal, darkMode }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const { loginWithEmail, signupWithEmail, loginWithGoogleCredential } = useAuth();

  const safeError = (err) => {
    const code = err?.code || "";
    if (code.includes("invalid-credential")) return "Invalid email or password.";
    if (code.includes("user-not-found")) return "No account found for this email.";
    if (code.includes("email-already-in-use")) return "Email already in use.";
    if (code.includes("weak-password")) return "Password should be at least 6 characters.";
    if (code.includes("configuration-not-found")) return "Firebase auth is not fully configured. Use test admin login: admin@emowellbeing.test / Admin@12345.";
    return err?.message || "Authentication failed.";
  };

  const handleEmailAuth = async () => {
    setError("");
    setLoading(true);
    try {
      if (!email || !password) {
        setError("Please enter email and password.");
        return;
      }

      if (mode === "signup") {
        await signupWithEmail({ email, password, displayName: username });
      } else {
        await loginWithEmail({ email, password });
      }
      closeModal();
    } catch (err) {
      setError(safeError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async (credentialResponse) => {
    setError("");
    setLoading(true);
    try {
      const credential = credentialResponse?.credential;
      if (!credential) {
        setError("Google sign-in failed.");
        return;
      }
      await loginWithGoogleCredential(credential);
      closeModal();
    } catch (err) {
      setError(safeError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={modalOverlay}>
      <div style={{ ...modalCard, background: darkMode ? "#111827" : "#fff", color: darkMode ? "#f1f5f9" : "#111827" }}>
        <h2 style={modalTitle}>{mode === "login" ? "Log In" : "Sign Up"}</h2>

        {mode === "signup" && (
          <input
            style={modalInput(darkMode)}
            placeholder="Full name"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        )}

        <input
          style={modalInput(darkMode)}
          type="email"
          placeholder="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          style={modalInput(darkMode)}
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {error ? <p style={errorText}>{error}</p> : null}

        <button className="auth-modal-button" style={modalBtn} onClick={handleEmailAuth} disabled={loading}>
          {loading ? "Please wait..." : mode === "login" ? "Log In" : "Create Account"}
        </button>

        <div style={{ marginTop: 6, marginBottom: 4 }}>
          <GoogleLogin
            onSuccess={handleGoogleAuth}
            onError={() => setError("Google sign-in failed. Try again.")}
          />
        </div>

        <p style={modalSwitchText}>
          {mode === "login" ? "Don't have an account?" : "Already have an account?"}{" "}
          <span style={modalSwitchLink} onClick={() => setMode(mode === "login" ? "signup" : "login")}>
            {mode === "login" ? "Sign Up" : "Log In"}
          </span>
        </p>

        <button className="auth-close-button" onClick={closeModal} style={modalCloseBtn}>Close</button>
      </div>
    </div>
  );
}

const nav = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  height: 70,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "0 22px",
  backdropFilter: "blur(18px)",
  borderBottom: "1px solid rgba(31, 95, 153, 0.22)",
  zIndex: 1000,
};
const darkBg = "linear-gradient(90deg, rgba(8,28,48,0.96), rgba(11,47,85,0.94), rgba(31,95,153,0.82))";
const lightBg = "linear-gradient(90deg, rgba(248,251,253,0.97), rgba(239,246,250,0.94), rgba(231,242,249,0.9), rgba(248,250,252,0.92))";
const logo = { fontSize: 22, fontWeight: 800, display: "flex", alignItems: "center", gap: 8 };
const logoMark = {
  width: 28,
  height: 28,
  borderRadius: 8,
  display: "grid",
  placeItems: "center",
  background: "linear-gradient(135deg, #081c30, #0b2f55 52%, #1f5f99 82%, #38a3d1)",
  color: "#f8fbff",
  fontSize: 14,
  border: "1px solid rgba(191,211,226,0.82)",
};
const links = { display: "flex", gap: 16, alignItems: "center" };
const link = { textDecoration: "none", fontSize: 13, paddingBottom: 4, fontWeight: 600 };
const right = { display: "flex", alignItems: "center", gap: 12 };
const themeBtn = {
  padding: 0,
  borderRadius: 8,
  border: "0",
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 700,
};
const cta = {
  padding: "10px 18px",
  borderRadius: 8,
  border: "1px solid #b42318",
  cursor: "pointer",
  fontSize: 14,
  background: "transparent",
  color: "#b42318",
  fontWeight: 700,
};

const userWrap = { display: "flex", alignItems: "center", gap: 8, maxWidth: 360 };
const avatar = {
  width: 36,
  height: 36,
  borderRadius: 10,
  background: "linear-gradient(135deg, #0b2f55, #1f5f99, #38a3d1)",
  color: "#ffffff",
  display: "grid",
  placeItems: "center",
  fontWeight: 700,
  fontSize: 13,
  border: "1px solid rgba(191,211,226,0.82)",
};
const userMeta = { display: "flex", flexDirection: "column", minWidth: 0 };
const userName = { margin: 0, fontSize: 12, fontWeight: 700, color: palette.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 150 };
const userEmail = { margin: 0, fontSize: 11, color: palette.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 150 };
const logoutBtn = {
  padding: "7px 10px",
  borderRadius: 8,
  border: "1px solid #b42318",
  background: "#ffffff",
  color: "#b42318",
  fontSize: 12,
  cursor: "pointer",
  fontWeight: 600,
};

const modalOverlay = {
  position: "fixed",
  inset: 0,
  background: "rgba(8,28,48,0.62)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  zIndex: 2000,
};
const modalCard = {
  width: 360,
  padding: 24,
  borderRadius: 12,
  display: "flex",
  flexDirection: "column",
  alignItems: "stretch",
  border: `1px solid ${palette.border}`,
  boxShadow: "0 28px 60px rgba(31,95,153,0.18)",
};
const modalTitle = { marginBottom: 16, fontSize: 24, fontWeight: 700, textAlign: "center" };
const modalInput = (darkMode) => ({
  width: "100%",
  padding: 12,
  marginBottom: 10,
  borderRadius: 8,
  border: `1px solid ${palette.border}`,
  background: darkMode ? "#081c30" : palette.smoky,
  color: darkMode ? "#f1f5f9" : "#111827",
});
const modalBtn = {
  width: "100%",
  padding: 12,
  borderRadius: 8,
  border: "1px solid #b42318",
  background: "transparent",
  color: "#b42318",
  fontWeight: 600,
  cursor: "pointer",
  marginBottom: 8,
};
const errorText = { color: "#c5534b", fontSize: 12, margin: "0 0 10px 0" };
const modalSwitchText = { fontSize: 12, marginTop: 12, textAlign: "center", color: palette.muted };
const modalSwitchLink = { color: palette.primary, cursor: "pointer", fontWeight: 700 };
const modalCloseBtn = {
  marginTop: 12,
  padding: "8px 12px",
  borderRadius: 8,
  border: "1px solid #b42318",
  cursor: "pointer",
  fontSize: 12,
  background: "#fff",
  color: "#b42318",
};
