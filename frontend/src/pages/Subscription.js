import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Check, Crown, ShieldCheck, Sparkles, Zap } from "lucide-react";
import PremiumCheckoutModal from "../components/PremiumCheckoutModal";
import { useAuth } from "../context/AuthContext";
import { apiUrl } from "../lib/api";

const DEMO_PREMIUM_RUNTIME_KEY = "__melomindDemoPremiumAccess";

const activateDemoPremiumAccess = (plan, paymentResult = {}) => {
  window[DEMO_PREMIUM_RUNTIME_KEY] = {
    active: true,
    credits: 999,
    planId: plan?.id || "",
    planName: plan?.name || "",
    amount: plan?.amount || "",
    billingCycle: plan?.period || "",
    paymentId: paymentResult.paymentId || "",
    orderId: paymentResult.orderId || "",
    paymentMethod: paymentResult.payment?.method || paymentResult.method || "Razorpay",
    purchasedAt: new Date().toISOString(),
  };
};

const plans = [
  {
    id: "free",
    name: "Starter",
    amount: "Rs 0",
    numericPrice: 0,
    period: "forever",
    description: "A calm starting point for exploring guided emotional well-being tools.",
    badge: "For first-time users",
    icon: Zap,
    accent: "bg-[#223046]",
    features: [
      "3 guided sessions each week",
      "Basic mood tracking",
      "Community access",
      "1 healing sound collection",
    ],
  },
  {
    id: "pro",
    name: "MeloMind Pro",
    amount: "Rs 199",
    numericPrice: 199,
    period: "per month",
    description: "A premium membership for people who want deeper tools and more consistency.",
    badge: "Most popular",
    icon: Sparkles,
    accent: "bg-[#315EFB]",
    highlight: true,
    features: [
      "Unlimited guided sessions",
      "Advanced well-being insights",
      "Premium sound therapy library",
      "Personalized therapy recommendations",
      "Priority support access",
      "Offline content availability",
    ],
  },
  {
    id: "premium",
    name: "MeloMind Premium",
    amount: "Rs 499",
    numericPrice: 499,
    period: "per month",
    description: "The full platform experience with premium features and higher-value support.",
    badge: "Best for complete access",
    icon: Crown,
    accent: "bg-[#315EFB]",
    features: [
      "Everything in Pro",
      "Therapist priority matching",
      "AI-powered well-being insights",
      "Custom session builder",
      "Family access support",
      "Exclusive early feature access",
    ],
  },
];

export default function Subscription() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [showSuccess, setShowSuccess] = useState(false);

  const activePlan = useMemo(() => selectedPlan || plans[1], [selectedPlan]);

  const handleSelectPlan = (plan) => {
    if (plan.numericPrice === 0) {
      activateDemoPremiumAccess(plan);
      setShowSuccess(true);
      return;
    }
    setSelectedPlan(plan);
  };

  const handlePaymentSuccess = async (paymentResult = {}) => {
    const plan = selectedPlan;

    activateDemoPremiumAccess(plan, paymentResult);

    if (user?.email && plan) {
      try {
        await fetch(apiUrl("/api/send_payment_confirmation_email"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userEmail: user.email,
            userName: user.displayName || user.email || "User",
            planName: plan.name,
            amount: plan.amount,
            billingCycle: plan.period,
            paymentId: paymentResult.paymentId || "",
            orderId: paymentResult.orderId || "",
            paymentMethod: paymentResult.payment?.method || paymentResult.method || "Razorpay",
          }),
        });
      } catch (error) {
        console.warn("Payment confirmation email failed:", error);
      }
    }

    setSelectedPlan(null);
    setShowSuccess(true);
  };

  return (
    <div className="min-h-screen bg-[#f5f2ed] text-[#2f3b44]">
      <div className="relative overflow-hidden">
        <div className="absolute -left-24 top-10 h-72 w-72 rounded-full bg-[#f0dfd6] blur-3xl" />
        <div className="absolute right-0 top-0 h-96 w-96 rounded-full bg-[#efe3db] blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-56 w-56 rounded-full bg-[#f6ebe3] blur-3xl" />

        <div className="relative mx-auto max-w-7xl px-5 py-12 sm:px-6 lg:px-8">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 rounded-full border border-[#ddd2c7] bg-white/90 px-4 py-2 text-sm font-medium text-[#6d7882] shadow-sm transition hover:border-[#d96846] hover:text-[#2f3b44]"
          >
            <ArrowLeft className="h-4 w-4" />
            Go Back
          </button>

          <section className="mt-10">
            <span className="inline-flex rounded-full border border-[#dbe3f4] bg-[#edf2ff] px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.24em] text-[#315efb]">
              Premium Membership
            </span>
            <h1 className="mt-5 max-w-4xl font-[Plus_Jakarta_Sans] text-4xl font-extrabold tracking-tight text-[#2f3b44] sm:text-5xl lg:text-6xl">
              Upgrade your emotional well-being experience
            </h1>
            <p className="mt-5 max-w-3xl text-lg leading-8 text-[#6d7882]">
              Choose a cleaner premium pass experience with better tools, more listening access, and stronger support.
            </p>
          </section>

          <div className="mt-12 grid gap-8 xl:grid-cols-[1.45fr_0.9fr]">
            <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {plans.map((plan) => {
                const Icon = plan.icon;
                return (
                  <button
                    key={plan.id}
                    onClick={() => handleSelectPlan(plan)}
                    className={`group relative flex min-h-[460px] flex-col overflow-hidden rounded-[28px] border bg-white p-6 text-left shadow-[0_18px_45px_rgba(15,23,42,0.08)] transition duration-300 hover:shadow-[0_24px_65px_rgba(15,23,42,0.14)] ${
                      plan.highlight ? "border-[#315efb] ring-1 ring-[#dbe3f4]" : "border-[#ddd2c7]"
                    }`}
                  >
                    <div className={`absolute inset-x-0 top-0 h-1.5 ${plan.accent}`} />
                    <div className="flex items-center justify-between gap-3">
                      <div className={`grid h-11 w-11 place-items-center rounded-2xl text-white ${plan.accent}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <span className="rounded-full bg-[#edf2ff] px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-[#5e6d84]">
                        {plan.badge}
                      </span>
                    </div>

                    <h3 className="mt-6 text-[30px] font-bold leading-tight text-[#2f3b44]">{plan.name}</h3>
                    <p className="mt-3 min-h-[78px] text-sm leading-6 text-[#6d7882]">{plan.description}</p>

                    <div className="mt-5 flex items-end gap-2">
                      <span className="text-4xl font-extrabold tracking-tight text-[#2f3b44]">{plan.amount}</span>
                      <span className="pb-1 text-sm text-[#7a6d65]">{plan.period}</span>
                    </div>

                    <ul className="mt-6 flex-1 space-y-3 border-t border-[#eadfd4] pt-5">
                      {plan.features.map((feature) => (
                        <li key={feature} className="flex items-start gap-3 text-sm text-[#425466]">
                          <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#edf2ff] text-[#315efb]">
                            <Check className="h-3.5 w-3.5" />
                          </span>
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>

                    <div className="mt-8">
                      <span
                        className={`inline-flex w-full items-center justify-center rounded-2xl px-4 py-3.5 text-sm font-semibold text-white transition ${
                          plan.highlight ? "bg-[#223046] group-hover:bg-[#182231]" : "bg-[#315efb] group-hover:bg-[#284fe0]"
                        }`}
                      >
                        {plan.numericPrice === 0 ? "Start Free" : "Pay with Razorpay"}
                      </span>
                    </div>
                  </button>
                );
              })}
            </section>

            <aside className="h-fit rounded-[30px] border border-[#ddd2c7] bg-white p-7 shadow-[0_25px_70px_rgba(15,23,42,0.1)] xl:sticky xl:top-24">
              <div className="inline-flex rounded-full bg-[#315efb] px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-white">
                Plan Summary
              </div>
              <h2 className="mt-5 text-3xl font-bold tracking-tight text-[#2f3b44]">{activePlan.name}</h2>
              <p className="mt-3 text-sm leading-6 text-[#6d7882]">{activePlan.description}</p>

              <div className="mt-8 rounded-3xl bg-[#315efb] p-6 text-white">
                <p className="text-sm text-white/70">Current selection</p>
                <p className="mt-2 text-5xl font-semibold tracking-tight">{activePlan.amount}</p>
                <p className="mt-2 text-sm text-white/70">{activePlan.period}</p>
                <div className="mt-6 flex items-center gap-3 rounded-2xl bg-white/10 px-4 py-3 text-sm text-white/85">
                  <ShieldCheck className="h-4 w-4" />
                  Instant activation after successful payment
                </div>
              </div>

              <div className="mt-8 space-y-4">
                <InfoRow label="Billing" value={activePlan.numericPrice === 0 ? "No charge" : activePlan.period} />
                <InfoRow label="Cancellation" value="Cancel anytime" />
                <InfoRow label="Support" value="Priority email support" />
              </div>

              <button
                onClick={() => handleSelectPlan(activePlan)}
                className="mt-8 w-full rounded-2xl bg-[#315efb] px-4 py-4 text-base font-semibold text-white transition hover:bg-[#284fe0]"
              >
                {activePlan.numericPrice === 0 ? "Activate Free Plan" : `Pay ${activePlan.amount} with Razorpay`}
              </button>

              <p className="mt-4 text-center text-xs leading-5 text-[#7a6d65]">
                Secure Razorpay checkout with instant plan activation after successful payment.
              </p>
            </aside>
          </div>
        </div>
      </div>

      <PremiumCheckoutModal
        open={Boolean(selectedPlan)}
        title={selectedPlan?.name || ""}
        subtitle="Secure your MeloMind membership"
        amount={selectedPlan?.amount || ""}
        amountValue={selectedPlan?.numericPrice || 0}
        currency="INR"
        autoStart
        priceLine={selectedPlan?.period || ""}
        customerName={user?.displayName || ""}
        customerEmail={user?.email || ""}
        note="Your premium plan is activated immediately after successful Razorpay payment."
        description={selectedPlan ? `${selectedPlan.name} membership` : "Premium membership"}
        receiptPrefix="subscription"
        notes={{
          purpose: "premium_subscription",
          plan: selectedPlan?.id || "",
        }}
        onClose={() => setSelectedPlan(null)}
        onConfirm={handlePaymentSuccess}
      />

      {showSuccess ? (
        <div className="fixed inset-0 z-[1300] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[28px] border border-[#dbe7ec] bg-white p-8 text-center shadow-[0_24px_80px_rgba(15,23,42,0.24)]">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[#eefaf6] text-[#00a58f]">
              <Check className="h-8 w-8" />
            </div>
            <h3 className="mt-5 text-3xl font-bold text-[#253342]">Payment successful</h3>
            <p className="mt-3 text-sm leading-6 text-[#516f90]">
              Your membership is active now and premium access is available across the platform.
            </p>
            <button
              onClick={() => {
                setShowSuccess(false);
                navigate("/harmony-therapy");
              }}
              className="mt-7 w-full rounded-2xl bg-[#253342] px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-[#1d2c39]"
            >
              Continue to Harmony Therapy
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-[#dbe7ec] bg-[#f6fafb] px-4 py-3">
      <span className="text-sm text-[#6b7f90]">{label}</span>
      <span className="text-sm font-semibold text-[#253342]">{value}</span>
    </div>
  );
}
