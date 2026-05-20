import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  LoaderCircle,
  ShieldCheck,
  X,
} from "lucide-react";

import { apiUrl } from "../lib/api";

const RAZORPAY_SCRIPT_URL = "https://checkout.razorpay.com/v1/checkout.js";
let razorpayScriptPromise = null;

const loadRazorpayScript = () => {
  if (typeof window !== "undefined" && window.Razorpay) {
    return Promise.resolve(true);
  }

  if (razorpayScriptPromise) {
    return razorpayScriptPromise;
  }

  razorpayScriptPromise = new Promise((resolve, reject) => {
    if (typeof document === "undefined") {
      reject(new Error("Razorpay checkout can only run in the browser."));
      return;
    }

    const existingScript = document.querySelector('script[data-razorpay-checkout="true"]');
    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(true), { once: true });
      existingScript.addEventListener("error", () => reject(new Error("Could not load Razorpay checkout.")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = RAZORPAY_SCRIPT_URL;
    script.async = true;
    script.dataset.razorpayCheckout = "true";
    script.onload = () => resolve(true);
    script.onerror = () => reject(new Error("Could not load Razorpay checkout."));
    document.body.appendChild(script);
  });

  return razorpayScriptPromise;
};

const extractAmountValue = (value) => {
  if (typeof value === "number") return value;
  const numeric = String(value || "").replace(/[^0-9.]/g, "");
  return numeric ? Number(numeric) : 0;
};

const buildReceiptId = (prefix) => {
  const safePrefix = String(prefix || "melomind").replace(/[^a-z0-9_-]/gi, "").slice(0, 18) || "melomind";
  return `${safePrefix}_${Date.now()}`.slice(0, 40);
};

const parseJsonSafely = async (response) => {
  const rawText = await response.text();

  if (!rawText) {
    return null;
  }

  try {
    return JSON.parse(rawText);
  } catch {
    return { rawText };
  }
};

const formatCheckoutError = (error) => {
  const message = String(error?.message || "").trim();

  if (/Failed to fetch/i.test(message)) {
    return "We couldn't connect to the payment service. Please restart the backend and try again.";
  }

  if (/not ready yet/i.test(message) || /restart the backend/i.test(message)) {
    return "Payment service is not ready yet. Please restart the backend and try again.";
  }

  if (/not configured/i.test(message) || (/key/i.test(message) && /razorpay/i.test(message))) {
    return "Payment setup is incomplete. Add your Razorpay test keys on the backend and try again.";
  }

  return message || "We couldn't start the payment right now. Please try again.";
};

export default function PremiumCheckoutModal({
  open,
  title,
  subtitle,
  amount,
  amountValue,
  currency = "INR",
  checkoutMode = "razorpay",
  autoStart = false,
  priceLine,
  customerEmail = "",
  customerName = "",
  note,
  description,
  receiptPrefix = "melomind",
  notes = {},
  onClose,
  onConfirm,
}) {
  const [payerName, setPayerName] = useState(customerName || "");
  const [phone, setPhone] = useState("");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");

  const resolvedAmountValue = useMemo(() => {
    const candidate = Number(amountValue);
    if (Number.isFinite(candidate) && candidate > 0) {
      return candidate;
    }
    return extractAmountValue(amount);
  }, [amount, amountValue]);

  const totalLabel = useMemo(() => amount || priceLine || "", [amount, priceLine]);

  useEffect(() => {
    if (!open) return;
    setPayerName(customerName || "");
    setPhone("");
    setProcessing(false);
    setError("");
  }, [customerName, open]);

  useEffect(() => {
    if (!open || !autoStart || checkoutMode !== "razorpay") return;

    const timer = window.setTimeout(() => {
      handleConfirm();
    }, 150);

    return () => window.clearTimeout(timer);
  }, [autoStart, checkoutMode, open]);

  if (!open) return null;

  const validate = () => {
    if (checkoutMode === "instant") {
      setError("");
      return true;
    }

    if (!customerEmail.trim()) {
      setError("Please log in with a valid email before continuing to payment.");
      return false;
    }

    if (!resolvedAmountValue || resolvedAmountValue <= 0) {
      setError("This payment amount is not valid yet.");
      return false;
    }

    setError("");
    return true;
  };

  const handleConfirm = async () => {
    if (!validate()) return;

    setProcessing(true);
    setError("");

    try {
      if (checkoutMode === "instant") {
        await Promise.resolve(
          onConfirm?.({
            gateway: "local",
            method: "manual",
            payment: { status: "captured" },
            payerName: payerName || customerName || "",
          })
        );
        return;
      }

      await loadRazorpayScript();

      const orderResponse = await fetch(apiUrl("/api/payments/razorpay/order"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: Math.round(resolvedAmountValue * 100),
          currency,
          receipt: buildReceiptId(receiptPrefix),
          notes: {
            title,
            email: customerEmail,
            payer_name: payerName || customerName || "",
            ...notes,
          },
        }),
      });

      const orderData = await parseJsonSafely(orderResponse);
      if (!orderResponse.ok || !orderData?.ok) {
        if (orderResponse.status === 404) {
          throw new Error("Payment service is not ready yet. Please restart the backend and try again.");
        }

        if (orderResponse.status === 503) {
          throw new Error("Payment setup is incomplete. Add your Razorpay test keys on the backend and try again.");
        }

        throw new Error(orderData?.message || "Could not create the payment order.");
      }

      await new Promise((resolve, reject) => {
        const checkout = new window.Razorpay({
          key: orderData.keyId,
          amount: orderData.order.amount,
          currency: orderData.order.currency,
          name: "MeloMind",
          description: description || title,
          order_id: orderData.order.id,
          prefill: {
            name: payerName || customerName || customerEmail.split("@")[0] || "",
            email: customerEmail,
            contact: phone || undefined,
          },
          notes: {
            item: title,
            ...notes,
          },
          theme: {
            color: "#315EFB",
            backdrop_color: "#0f172a",
          },
          modal: {
            ondismiss: () => {
              const dismissedError = new Error("Razorpay checkout was closed before payment.");
              dismissedError.code = "checkout_closed";
              reject(dismissedError);
            },
          },
          handler: async (response) => {
            try {
              const verifyResponse = await fetch(apiUrl("/api/payments/razorpay/verify"), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  orderId: orderData.order.id,
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                }),
              });

              const verifyData = await parseJsonSafely(verifyResponse);
              if (!verifyResponse.ok || !verifyData?.ok) {
                throw new Error(verifyData?.message || "Payment verification failed.");
              }

              await Promise.resolve(
                onConfirm?.({
                  gateway: "razorpay",
                  method: verifyData.payment?.method || "razorpay",
                  orderId: orderData.order.id,
                  paymentId: response.razorpay_payment_id,
                  signature: response.razorpay_signature,
                  payment: verifyData.payment,
                  payerName: payerName || customerName || "",
                  phone,
                })
              );

              resolve(true);
            } catch (handlerError) {
              reject(handlerError);
            }
          },
        });

        checkout.on("payment.failed", (event) => {
          const failedError = new Error(
            event?.error?.description || "Razorpay reported a payment failure."
          );
          failedError.code = "payment_failed";
          reject(failedError);
        });

        checkout.open();
      });
    } catch (checkoutError) {
      if (checkoutError?.code !== "checkout_closed") {
        setError(formatCheckoutError(checkoutError));
      }
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1200] overflow-y-auto bg-[#0f172a]/62 p-4 backdrop-blur-md">
      <div className="mx-auto mt-6 max-w-5xl overflow-hidden rounded-[32px] border border-[#ddd2c7] bg-[#fffdf9] shadow-[0_38px_120px_rgba(15,23,42,0.28)]">
        <div className="grid min-h-[640px] md:grid-cols-[1fr_1.08fr]">
          <section className="relative overflow-hidden border-b border-[#e8ddd2] bg-[radial-gradient(circle_at_top_left,_rgba(49,94,251,0.12),_transparent_42%),linear-gradient(180deg,#fffaf5_0%,#fff4eb_100%)] p-8 md:border-b-0 md:border-r">
            <div className="absolute -left-20 top-8 h-52 w-52 rounded-full bg-[#d7e3ff] blur-3xl" />
            <div className="absolute bottom-0 right-0 h-56 w-56 rounded-full bg-[#f7e6da] blur-3xl" />
            <div className="relative">
              <button
                onClick={onClose}
                className="inline-flex items-center gap-2 rounded-full border border-[#ddd2c7] bg-white/90 px-4 py-2 text-sm font-medium text-[#6d7882] transition hover:border-[#cbb9aa] hover:text-[#2f3b44]"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>

              <div className="mt-8 flex items-center gap-4">
                <div className="grid h-14 w-14 place-items-center rounded-3xl bg-[#315efb] text-white shadow-[0_20px_35px_rgba(49,94,251,0.24)]">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[#6d7882]">MeloMind</p>
                  <p className="text-sm text-[#7a6d65]">Premium subscription checkout</p>
                </div>
              </div>

              <div className="mt-12">
                <div className="inline-flex rounded-full border border-[#d7e3ff] bg-white/80 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.22em] text-[#315efb]">
                  Secure Plan Payment
                </div>
                <p className="mt-6 text-sm text-[#7a6d65]">{subtitle}</p>
                <h2 className="mt-2 max-w-md text-4xl font-semibold tracking-tight text-[#2f3b44]">{title}</h2>
                <div className="mt-6 flex items-end gap-3">
                  <span className="text-5xl font-semibold tracking-tight text-[#2f3b44]">{amount}</span>
                  {priceLine ? <span className="pb-1 text-lg text-[#7a6d65]">{priceLine}</span> : null}
                </div>
              </div>

              <div className="mt-12 rounded-[28px] border border-[#eadfd4] bg-white/80 p-6 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
                <div className="flex items-start justify-between gap-4 border-b border-[#efe3d7] pb-5">
                  <div>
                    <p className="text-lg font-semibold text-[#2f3b44]">{title}</p>
                    <p className="mt-1 text-sm text-[#7a6d65]">{subtitle}</p>
                  </div>
                  <div className="rounded-2xl bg-[#f7f9ff] px-4 py-3 text-right">
                    <p className="text-2xl font-semibold text-[#2f3b44]">{amount}</p>
                    <p className="text-sm text-[#7a6d65]">{priceLine || "Billed once"}</p>
                  </div>
                </div>

                <div className="mt-5 space-y-4">
                  <SummaryRow label="Subtotal" value={totalLabel} />
                  <SummaryRow label="Total due today" value={totalLabel} strong />
                </div>

                <div className="mt-5 rounded-2xl border border-[#dbe3f4] bg-[#edf2ff] p-4 text-sm text-[#315479]">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                    <p>{note || "Your purchase is confirmed only after Razorpay verifies the payment."}</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="bg-white p-8">
            <div className="mb-6 flex items-start justify-between">
              <div>
                <div className="inline-flex rounded-full bg-[#f5f7fb] px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-[#6b7f90]">
                  Checkout
                </div>
                <h3 className="mt-4 text-3xl font-semibold tracking-tight text-[#2f3b44]">Payment details</h3>
                <p className="mt-2 max-w-md text-sm leading-6 text-[#7a6d65]">
                  Review your details and continue with a secure Razorpay payment for instant premium access.
                </p>
              </div>
              <button
                onClick={onClose}
                className="rounded-full border border-transparent p-2 text-[#7a6d65] transition hover:border-[#eadfd4] hover:bg-[#fff7f0] hover:text-[#2f3b44]"
                aria-label="Close checkout"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="rounded-[24px] border border-[#e6d9cd] bg-[#fffaf5] px-5 py-4">
                <label className="block text-sm font-medium text-[#7a6d65]">Email</label>
                <div className="mt-2 text-lg font-medium text-[#2f3b44]">{customerEmail || "guest@melomind.app"}</div>
              </div>

              {autoStart ? (
                <div className="rounded-[24px] border border-[#dbe3f4] bg-[linear-gradient(135deg,#edf2ff_0%,#f6f9ff_100%)] px-5 py-4 text-sm leading-6 text-[#315479]">
                  Razorpay checkout opens automatically for a faster payment flow. If it does not appear, you can retry below.
                </div>
              ) : (
                <Field label="Full name (optional)">
                  <input
                    value={payerName}
                    onChange={(e) => setPayerName(e.target.value)}
                    className="w-full rounded-[20px] border border-[#ddd2c7] bg-white px-4 py-3.5 text-sm text-[#2f3b44] outline-none transition focus:border-[#315efb]"
                    placeholder="Full name"
                  />
                </Field>
              )}
            </div>

            {error ? (
              <div className="mt-5 rounded-2xl border border-[#f1c9cf] bg-[#fff4f6] px-4 py-3 text-sm text-rose-600">
                {error}
              </div>
            ) : null}

            <button
              onClick={handleConfirm}
              disabled={processing}
              className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-[22px] bg-[linear-gradient(135deg,#315efb_0%,#2749cf_100%)] px-4 py-4 text-base font-semibold text-white shadow-[0_20px_40px_rgba(49,94,251,0.24)] transition hover:translate-y-[-1px] hover:shadow-[0_24px_44px_rgba(49,94,251,0.28)] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {processing ? (
                <>
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  {checkoutMode === "instant" ? "Activating..." : "Starting payment..."}
                </>
              ) : (
                checkoutMode === "instant"
                  ? "Activate Plan"
                  : autoStart
                    ? `Pay ${totalLabel || amount} with Razorpay`
                    : "Continue to Payment"
              )}
            </button>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-[22px] border border-[#e8edf4] bg-[#f8fafc] px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#6b7f90]">Gateway</p>
                <p className="mt-2 text-lg font-semibold text-[#2f3b44]">Razorpay Checkout</p>
              </div>
              <div className="rounded-[22px] border border-[#e8edf4] bg-[#f8fafc] px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#6b7f90]">Access</p>
                <p className="mt-2 text-lg font-semibold text-[#2f3b44]">Instant after payment</p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function SummaryRow({ label, value, strong = false, muted = false }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className={`text-sm ${strong ? "font-semibold text-[#253342]" : muted ? "text-[#6b7f90]" : "text-[#425466]"}`}>
        {label}
      </span>
      <span className={`${strong ? "text-2xl font-semibold text-[#253342]" : "text-lg text-[#33475b]"}`}>{value}</span>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-[#516f90]">{label}</span>
      {children}
    </label>
  );
}
