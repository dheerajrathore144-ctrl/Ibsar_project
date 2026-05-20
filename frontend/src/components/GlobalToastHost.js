import React, { useEffect, useState } from "react";

const palette = {
  success: { bg: "#eaf6ef", border: "#bcdcc6", text: "#1f6b45" },
  error: { bg: "#fdeceb", border: "#f1c7c1", text: "#b54737" },
  info: { bg: "#edf2ff", border: "#d3dcff", text: "#315efb" },
};

export default function GlobalToastHost() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const handleToast = (event) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const nextToast = {
        id,
        type: event.detail?.type || "info",
        message: event.detail?.message || "",
      };

      setToasts((prev) => [...prev, nextToast]);

      window.setTimeout(() => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id));
      }, 2800);
    };

    window.addEventListener("melomind-toast", handleToast);
    return () => window.removeEventListener("melomind-toast", handleToast);
  }, []);

  return (
    <div style={hostStyle}>
      {toasts.map((toast) => {
        const colors = palette[toast.type] || palette.info;
        return (
          <div
            key={toast.id}
            style={{
              ...toastStyle,
              background: colors.bg,
              borderColor: colors.border,
              color: colors.text,
            }}
          >
            {toast.message}
          </div>
        );
      })}
    </div>
  );
}

const hostStyle = {
  position: "fixed",
  top: 92,
  right: 20,
  zIndex: 5000,
  display: "flex",
  flexDirection: "column",
  gap: 10,
};

const toastStyle = {
  minWidth: 280,
  maxWidth: 360,
  padding: "12px 14px",
  borderRadius: 14,
  border: "1px solid",
  boxShadow: "0 16px 40px rgba(15, 23, 42, 0.12)",
  fontSize: 14,
  fontWeight: 600,
};
