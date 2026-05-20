import React, { useEffect, useMemo, useState } from "react";
import { Search, Play, Lock, Crown, X } from "lucide-react";
import { toast } from "../lib/notify";
import PremiumCheckoutModal from "../components/PremiumCheckoutModal";
import { useAuth } from "../context/AuthContext";
import yoga1 from "../assets/yoga1.jpg";
import yoga2 from "../assets/yoga2.jpg";
import yoga3 from "../assets/yoga3.jpg";
import yoga4 from "../assets/yoga4.jpg";

const FREE_VIDEOS = [
  { id: "v7AYKMP6rOE", title: "Morning Yoga Flow", level: "Beginner" },
  { id: "4pKly2JojMw", title: "Yoga For Complete Beginners", level: "Beginner" },
  { id: "X655B4ISakg", title: "20 Minute Yoga Stretch", level: "Beginner" },
  { id: "OQ6NfFIr2jw", title: "Beginner Yoga Full Body", level: "Beginner" },
  { id: "2L2lnxIcNmo", title: "Yoga For Flexibility", level: "Beginner" },
  { id: "sTANio_2E0Q", title: "Daily Yoga Routine", level: "Beginner" },
  { id: "GLy2rYHwUqY", title: "Relaxing Yoga Flow", level: "Beginner" },
  { id: "LqXZ628YNj4", title: "Gentle Beginner Yoga", level: "Beginner" },
];

const PREMIUM_VIDEOS = [
  { id: "v7AYKMP6rOE", title: "Power Yoga Fat Burn", level: "Advanced" },
  { id: "4pKly2JojMw", title: "Morning Flexibility Yoga", level: "Beginner" },
  { id: "X655B4ISakg", title: "Deep Stretch Yoga Flow", level: "Intermediate" },
  { id: "LqXZ628YNj4", title: "Relaxing Evening Yoga", level: "All Levels" },
];

const MEMBERSHIP_PLANS = [
  {
    name: "Silver Membership",
    price: 30,
    badge: "Starter",
    description: "Perfect for beginners exploring premium yoga classes.",
    theme: "border-[#e6d7cb] bg-[#fffaf5]",
    button: "bg-[#315EFB] hover:bg-[#284fe0]",
    accent: "bg-[#315EFB]",
    image: yoga1,
    imagePosition: "center center",
    features: ["Beginner yoga sessions", "HD yoga videos", "Flexibility training"],
  },
  {
    name: "Gold Membership",
    price: 45,
    badge: "Top Seller",
    description: "Ideal for consistent and serious yoga practitioners.",
    theme: "border-[#e6d7cb] bg-[#fffaf5]",
    button: "bg-[#315EFB] hover:bg-[#284fe0]",
    accent: "bg-[#315EFB]",
    image: yoga2,
    imagePosition: "center center",
    features: [
      "All yoga classes",
      "Advanced yoga training",
      "Meditation sessions",
      "Premium instructor videos",
    ],
  },
  {
    name: "Platinum Membership",
    price: 55,
    badge: "Complete Access",
    description: "Unlimited premium yoga experience with exclusive sessions.",
    theme: "border-[#e6d7cb] bg-[#fffaf5]",
    button: "bg-[#315EFB] hover:bg-[#284fe0]",
    accent: "bg-[#315EFB]",
    image: yoga4,
    imagePosition: "center center",
    features: [
      "Unlimited premium classes",
      "Exclusive masterclasses",
      "Progress tracking",
      "Monthly live yoga workshops",
    ],
  },
];

const HERO_IMAGES = [yoga1, yoga2, yoga3, yoga4];

export default function YogaProgram() {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [videoId, setVideoId] = useState("");
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [showSubscribeModal, setShowSubscribeModal] = useState(false);
  const [showPlansModal, setShowPlansModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(MEMBERSHIP_PLANS[0]);
  const [isMember, setIsMember] = useState(false);

  const membershipKey = useMemo(() => {
    const email = (user?.email || "").trim().toLowerCase();
    return email ? `yogaMember:${email}` : null;
  }, [user?.email]);

  useEffect(() => {
    if (!membershipKey) {
      setIsMember(false);
      return;
    }

    setIsMember(localStorage.getItem(membershipKey) === "true");
  }, [membershipKey]);

  const filteredFree = useMemo(
    () => FREE_VIDEOS.filter((video) => video.title.toLowerCase().includes(query.trim().toLowerCase())),
    [query]
  );

  const filteredPremium = useMemo(
    () => PREMIUM_VIDEOS.filter((video) => video.title.toLowerCase().includes(query.trim().toLowerCase())),
    [query]
  );

  const openVideo = (id, requiresMembership = false) => {
    if (requiresMembership && !isMember) {
      setShowSubscribeModal(true);
      return;
    }

    setVideoId(id);
    setShowVideoModal(true);
  };

  const openPayment = (plan) => {
    if (!user?.email) {
      toast.error("Please log in first to purchase a yoga membership.");
      return;
    }
    setShowPlansModal(false);
    setSelectedPlan(plan);
    setShowPaymentModal(true);
  };

  const processPayment = () => {
    if (!membershipKey) {
      toast.error("Please log in first to activate premium access.");
      return;
    }

    localStorage.setItem(membershipKey, "true");
    setIsMember(true);
    setShowPaymentModal(false);
    setShowSubscribeModal(false);
    setShowPlansModal(false);
    toast.success("Payment successful! Welcome to Premium Yoga.");
  };

  return (
    <div className="min-h-screen bg-[#f5f2ed] text-[#2f3b44]">
      <section className="relative overflow-visible bg-[#315EFB] pb-16 pt-14">
        <div className="relative mx-auto max-w-7xl px-5">
          <div className="mb-7 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">Yoga Program</h1>
              <p className="mt-2 max-w-2xl text-white/90">
                Modern guided yoga journeys for balance, flexibility, calmness, and stronger daily focus.
              </p>
            </div>
            <div
              className={`rounded-full border px-4 py-2 text-sm font-semibold ${
                isMember
                  ? "border-[#e6d7cb] bg-white text-[#2f3b44]"
                  : "border-white/45 bg-white/20 text-white"
              }`}
            >
              {isMember ? "Premium Member" : "Free Access"}
            </div>
          </div>

          <div className="rounded-2xl border border-white/30 bg-[#f8efe8] p-3">
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8a5d4e]" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search yoga classes..."
                  className="w-full rounded-xl border border-[#d8dfeb] bg-white px-10 py-3 text-sm text-[#2f3b44] outline-none transition focus:border-[#315EFB]"
                />
              </div>
              <button
                type="button"
                className="rounded-xl bg-[#223046] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#182231]"
              >
                Search
              </button>
            </div>
          </div>

          <div className="relative z-10 mt-10 flex translate-y-10 flex-wrap items-center justify-center gap-6">
            {HERO_IMAGES.map((src, idx) => (
              <div
                key={`${src}-${idx}`}
                className="group relative h-52 w-52 overflow-hidden rounded-full bg-white shadow-[0_18px_45px_rgba(15,23,42,0.18)] transition duration-300 hover:-translate-y-2 hover:scale-[1.03] hover:shadow-[0_24px_60px_rgba(15,23,42,0.22)]"
              >
                <img
                  src={src}
                  alt={`Yoga visual ${idx + 1}`}
                  className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 pt-20 pb-12">
        <div className="mb-5 flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-bold">Essentials for Beginners</h2>
            <p className="text-sm text-[#7a6d65]">Start with safe, guided sessions.</p>
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {filteredFree.map((video) => (
            <article
              key={video.id + video.title}
              className="group overflow-hidden rounded-2xl border border-[#e6d7cb] bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
            >
              <div className="relative">
                <img
                  src={`https://img.youtube.com/vi/${video.id}/hqdefault.jpg`}
                  alt={video.title}
                  className="h-44 w-full object-cover"
                />
                <span className="absolute left-3 top-3 rounded-full bg-[#315EFB] px-2.5 py-1 text-xs font-semibold text-white">
                  Free
                </span>
              </div>
              <div className="p-4">
                <h3 className="line-clamp-2 min-h-[42px] text-sm font-bold text-[#2f3b44]">{video.title}</h3>
                <p className="mt-1 text-xs text-[#7a6d65]">{video.level}</p>
                <button
                  onClick={() => openVideo(video.id, false)}
                  className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#315EFB] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#284fe0]"
                >
                  <Play className="h-3.5 w-3.5" />
                  Watch Now
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 pb-12">
        <div className="mb-5 flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-bold">Premium Yoga Classes</h2>
            <p className="text-sm text-[#7a6d65]">Unlock advanced sessions with membership.</p>
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {filteredPremium.map((video) => (
            <article
              key={video.id + video.title}
              className="group overflow-hidden rounded-2xl border border-[#e6d7cb] bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
            >
              <div className="relative">
                <img
                  src={`https://img.youtube.com/vi/${video.id}/hqdefault.jpg`}
                  alt={video.title}
                  className="h-44 w-full object-cover"
                />
                  <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-[#315EFB] px-2.5 py-1 text-xs font-semibold text-white">
                  <Lock className="h-3 w-3" />
                  Premium
                </span>
              </div>
              <div className="p-4">
                <h3 className="line-clamp-2 min-h-[42px] text-sm font-bold text-[#2f3b44]">{video.title}</h3>
                <p className="mt-1 text-xs text-[#7a6d65]">{video.level}</p>
                <button
                  onClick={() => openVideo(video.id, true)}
                  className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#315EFB] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#284fe0]"
                >
                  <Crown className="h-3.5 w-3.5" />
                  Watch Premium
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      {showVideoModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="relative w-full max-w-4xl rounded-2xl bg-black p-3 shadow-2xl">
            <button
              onClick={() => {
                setShowVideoModal(false);
                setVideoId("");
              }}
              className="absolute right-3 top-3 z-10 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
            >
              <X className="h-5 w-5" />
            </button>
            <iframe
              width="100%"
              height="450"
              src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
              frameBorder="0"
              allow="autoplay; encrypted-media"
              allowFullScreen
              title="Yoga Video"
              className="rounded-xl"
            />
          </div>
        </div>
      ) : null}

      {showSubscribeModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-xl font-bold text-[#2f3b44]">Premium Yoga Class</h3>
            <p className="mt-2 text-sm text-[#6d7882]">
              This class is premium. Upgrade your membership to unlock this session.
            </p>
            <div className="mt-5 flex gap-3">
              <button
                onClick={() => {
                  setShowSubscribeModal(false);
                  setShowPlansModal(true);
                }}
                className="flex-1 rounded-lg bg-[#315EFB] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#284fe0]"
              >
                View Plans
              </button>
              <button
                onClick={() => setShowSubscribeModal(false)}
                className="flex-1 rounded-lg border border-[#e6d7cb] px-4 py-2.5 text-sm font-semibold text-[#6d7882] hover:bg-[#f8efe8]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showPlansModal ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/55 p-4">
          <div className="mx-auto mt-8 w-full max-w-6xl rounded-[32px] bg-[#fffaf5] p-6 shadow-2xl">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-3xl font-extrabold text-[#2f3b44]">Yoga Membership Plans</h2>
                <p className="mt-2 text-sm text-[#7a6d65]">Choose the plan that matches your yoga journey.</p>
              </div>
              <button
                onClick={() => setShowPlansModal(false)}
                className="rounded-full border border-[#e6d7cb] p-2 text-[#6d7882] hover:bg-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              {MEMBERSHIP_PLANS.map((plan) => (
                <div
                  key={plan.name}
                  className={`group relative overflow-hidden rounded-[28px] border p-0 shadow-sm transition-shadow duration-300 hover:shadow-[0_22px_55px_rgba(15,23,42,0.12)] ${plan.theme}`}
                >
                  <span className={`absolute left-5 top-5 z-10 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white ${plan.accent}`}>
                    {plan.badge}
                  </span>

                  <div className="relative h-52 overflow-hidden bg-[#f8efe8]">
                    <img
                      src={plan.image}
                      alt={plan.name}
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.02]"
                      style={{ objectPosition: plan.imagePosition || "center center" }}
                      loading="eager"
                      onError={(e) => {
                        e.currentTarget.src = yoga1;
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#2f3b44]/55 via-[#2f3b44]/10 to-transparent" />
                    <div className="absolute bottom-5 left-5 right-5 flex items-end justify-between gap-3">
                      <div>
                        <h3 className="text-xl font-bold text-white">{plan.name}</h3>
                        <p className="mt-1 text-sm text-white/80">Premium wellness access</p>
                      </div>
                      <div className="rounded-2xl border border-white/70 bg-white px-4 py-3 text-right shadow-[0_16px_36px_rgba(15,23,42,0.18)]">
                        <p className="text-2xl font-extrabold leading-none text-[#2f3b44]">₹{plan.price}</p>
                        <p className="mt-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#7a6d65]">per month</p>
                      </div>
                    </div>
                  </div>

                  <div className="p-6">
                    <p className="min-h-[52px] text-sm leading-6 text-[#6d7882]">{plan.description}</p>
                    <button
                      onClick={() => openPayment(plan)}
                      className={`mt-5 w-full rounded-2xl px-4 py-3 text-sm font-bold text-white transition ${plan.button}`}
                    >
                      Choose {plan.name}
                    </button>
                    <ul className="mt-5 space-y-3 border-t border-[#eadfd4] pt-5 text-sm text-[#6d7882]">
                      {plan.features.map((feature) => (
                        <li key={feature} className="flex items-start gap-3">
                          <span className={`mt-0.5 inline-block h-2.5 w-2.5 rounded-full ${plan.accent}`} />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <PremiumCheckoutModal
        open={showPaymentModal}
        title={selectedPlan.name}
        subtitle="Purchase your Yoga membership"
        checkoutMode="instant"
        amount={`₹${selectedPlan.price}`}
        amountValue={selectedPlan.price}
        currency="INR"
        priceLine="per month"
        customerName={user?.displayName || ""}
        customerEmail={user?.email || ""}
        note="Your premium yoga access starts immediately after checkout."
        description={`${selectedPlan.name} yoga membership`}
        receiptPrefix="yoga"
        notes={{
          purpose: "yoga_membership",
          plan: selectedPlan.name,
        }}
        onClose={() => setShowPaymentModal(false)}
        onConfirm={processPayment}
      />
    </div>
  );
}
