export const isFirebasePermissionError = (err) => {
  const code = String(err?.code || "").toLowerCase();
  const message = String(err?.message || "").toLowerCase();

  return (
    code === "permission-denied" ||
    code === "firestore/permission-denied" ||
    message.includes("missing or insufficient permissions")
  );
};

export const suppressFirebasePermissionRuntimeErrors = () => {
  if (typeof window === "undefined") return;

  const shouldSuppress = (value) => isFirebasePermissionError(value?.reason || value?.error || value);

  window.addEventListener(
    "unhandledrejection",
    (event) => {
      if (!shouldSuppress(event)) return;
      event.preventDefault();
      event.stopImmediatePropagation?.();
      console.warn("Cloud data access was restricted. MeloMind continued with local fallback data.");
    },
    true
  );

  window.addEventListener(
    "error",
    (event) => {
      if (!shouldSuppress(event)) return;
      event.preventDefault();
      event.stopImmediatePropagation?.();
      console.warn("Cloud data access was restricted. MeloMind continued with local fallback data.");
    },
    true
  );
};
