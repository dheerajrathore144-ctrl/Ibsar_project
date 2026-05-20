export const notify = (type, message) => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("melomind-toast", {
      detail: { type, message },
    })
  );
};

export const toast = {
  success: (message) => notify("success", message),
  error: (message) => notify("error", message),
  info: (message) => notify("info", message),
};
