import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "../lib/notify";
import { format, startOfDay } from "date-fns";
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, where } from "firebase/firestore";
import {
  Search, Brain, HeartPulse, Flame, Shield, Heart, Moon,
  Star, Video, Phone, Calendar as CalendarIcon, X,
  Mic, MicOff, VideoOff, PhoneOff, Timer,
  CheckCircle2, User, MessageCircle,
} from "lucide-react";

import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from "../components/ui/dialog";
import { Calendar } from "../components/ui/calendar";
import {
  Popover, PopoverContent, PopoverTrigger
} from "../components/ui/popover";
import { cn } from "../lib/utils";
import { apiUrl } from "../lib/api";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import PremiumCheckoutModal from "../components/PremiumCheckoutModal";


/* ─── data ─── */
const categories = [
  { name: "Anxiety Therapy", icon: Brain, color: "bg-care-lavender/20 text-care-lavender-dark" },
  { name: "Depression Support", icon: HeartPulse, color: "bg-care-blue/20 text-care-blue-dark" },
  { name: "Stress Management", icon: Flame, color: "bg-care-green/20 text-care-green-dark" },
  { name: "Trauma Counseling", icon: Shield, color: "bg-care-lavender/20 text-care-lavender-dark" },
  { name: "Relationship Therapy", icon: Heart, color: "bg-care-blue/20 text-care-blue-dark" },
  { name: "Sleep & Burnout", icon: Moon, color: "bg-care-green/20 text-care-green-dark" },
];

const staticPsychologists = [
  { id: 1, name: "Dr. Aditi Mehra", spec: "Anxiety & Stress", exp: 12, rating: 4.9, qual: "PhD Clinical Psychology", approach: "CBT, Mindfulness", langs: "English, Hindi", price: "₹1200", desc: "Specializes in evidence-based anxiety treatment." },
  { id: 2, name: "Dr. Arjun Verma", spec: "Depression & Mood", exp: 8, rating: 4.8, qual: "PsyD Clinical Psychology", approach: "Psychodynamic, ACT", langs: "English, Hindi", price: "₹1000", desc: "Compassionate support for mood disorders." },
  { id: 3, name: "Dr. Priya Sharma", spec: "Trauma & PTSD", exp: 15, rating: 4.9, qual: "PhD Counseling Psychology", approach: "EMDR, Somatic", langs: "English, Hindi", price: "₹1400", desc: "Expert in trauma recovery and resilience." },
  { id: 4, name: "Dr. Rohan Menon", spec: "Relationship Issues", exp: 10, rating: 4.7, qual: "PhD Marriage & Family", approach: "EFT, Gottman Method", langs: "English, Malayalam", price: "₹1100", desc: "Helping couples build stronger connections." },
  { id: 5, name: "Dr. Nisha Kapoor", spec: "Sleep & Burnout", exp: 7, rating: 4.8, qual: "PsyD Health Psychology", approach: "CBT-I, Behavioral", langs: "English, Hindi", price: "₹950", desc: "Sleep specialist and burnout prevention." },
  { id: 6, name: "Dr. Karan Iyer", spec: "Stress Management", exp: 9, rating: 4.6, qual: "PhD Clinical Psychology", approach: "Mindfulness, DBT", langs: "English, Tamil", price: "₹1050", desc: "Evidence-based stress reduction techniques." },
];

const timeSlots = ["9:00 AM", "10:00 AM", "11:00 AM", "1:00 PM", "2:00 PM", "3:00 PM", "4:00 PM", "5:00 PM"];
const LOCAL_PSY_PROFILE_PREFIX = "melomind_psychologist_profile_";
const LOCAL_BOOKING_PREFIX = "melomind_careconnect_booking_";
const LOCAL_AVAILABILITY_PREFIX = "melomind_psychologist_availability_";
const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const extractPriceValue = (value) => {
  const numeric = String(value || "").replace(/[^0-9.]/g, "");
  return numeric ? Number(numeric) : 0;
};
const formatPsychologistPrice = (value) => `₹${extractPriceValue(value) || 1000}`;

const normalizePsychologist = (profile, fallbackIndex = 0) => ({
  id: profile.id || profile.uid || `profile-${fallbackIndex}`,
  uid: profile.uid || profile.id || null,
  name: profile.name || "CareConnect Specialist",
  spec: profile.spec || profile.specialization || "Emotional Well-Being Support",
  exp: Number(profile.exp || profile.experience || 5),
  rating: Number(profile.rating || 4.8),
  qual: profile.qual || profile.degree || "Licensed Psychologist",
  approach: profile.approach || "CBT, Mindfulness",
  langs: profile.langs || profile.languages || "English",
  price: formatPsychologistPrice(profile.price || profile.fee || 1000),
  desc: profile.desc || profile.bio || "Experienced support for emotional well-being, resilience, and recovery.",
  approved: profile.approved ?? true,
});

const isPlaceholderPsychologist = (profile) => {
  const combined = [
    profile?.name,
    profile?.spec,
    profile?.specialization,
    profile?.qual,
    profile?.degree,
    profile?.desc,
    profile?.bio,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return (
    combined.includes("xyz") ||
    combined.trim() === "ram" ||
    combined.includes("ram psychologist")
  );
};

const mergePsychologistDirectory = (profiles = []) => {
  const merged = [...staticPsychologists];
  const seen = new Set(
    staticPsychologists.map((profile) => String(profile.uid || profile.id || profile.name).toLowerCase())
  );

  profiles.forEach((profile, index) => {
    if (isPlaceholderPsychologist(profile)) return;

    const normalized = normalizePsychologist(profile, index);
    const key = String(normalized.uid || normalized.id || normalized.name).toLowerCase();
    const nameKey = String(normalized.name).toLowerCase();

    if (seen.has(key) || seen.has(nameKey)) return;

    seen.add(key);
    seen.add(nameKey);
    merged.push(normalized);
  });

  return merged;
};

const isFirestorePermissionError = (err) =>
  err?.code === "permission-denied" ||
  err?.code === "firestore/permission-denied" ||
  /missing or insufficient permissions/i.test(err?.message || "");

const saveLocalBooking = (booking) => {
  if (!booking?.id) return;
  try {
    localStorage.setItem(`${LOCAL_BOOKING_PREFIX}${booking.id}`, JSON.stringify(booking));
  } catch {
    // Ignore local storage failures.
  }
};

const readLocalBookings = (uid) => {
  if (!uid) return [];
  try {
    const results = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(LOCAL_BOOKING_PREFIX)) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (parsed?.userUid === uid) {
        results.push(parsed);
      }
    }
    return results;
  } catch {
    return [];
  }
};

const readLocalAvailability = (uid) => {
  if (!uid) return null;
  try {
    const raw = localStorage.getItem(`${LOCAL_AVAILABILITY_PREFIX}${uid}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const readLocalPsychologistProfiles = () => {
  try {
    const results = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(LOCAL_PSY_PROFILE_PREFIX)) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (parsed?.approved) {
        results.push({
          id: parsed.uid || key.slice(LOCAL_PSY_PROFILE_PREFIX.length),
          ...parsed,
        });
      }
    }
    return results;
  } catch {
    return [];
  }
};

const buildSessionTimestamp = (dateValue, timeValue) => {
  if (!dateValue || !timeValue) return null;

  const match = String(timeValue).match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;

  const [, hourRaw, minuteRaw, meridiemRaw] = match;
  let hours = Number(hourRaw);
  const minutes = Number(minuteRaw);
  const meridiem = meridiemRaw.toUpperCase();

  if (meridiem === "PM" && hours !== 12) hours += 12;
  if (meridiem === "AM" && hours === 12) hours = 0;

  const sessionDate = new Date(dateValue);
  sessionDate.setHours(hours, minutes, 0, 0);
  return sessionDate.getTime();
};

const getSessionTimestamp = (session) => {
  if (typeof session?.sessionStartsAt === "number") return session.sessionStartsAt;
  if (!session?.date || !session?.time) return null;

  const normalizedDate = String(session.date).replace(/(\d+)(st|nd|rd|th)/gi, "$1");
  const parsedDate = new Date(`${normalizedDate} ${session.time}`);
  if (Number.isNaN(parsedDate.getTime())) return null;
  return parsedDate.getTime();
};

const isExpiredSession = (session) => {
  const sessionTime = getSessionTimestamp(session);
  if (!sessionTime) return false;
  return sessionTime < Date.now();
};



const fadeUp = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0 } };

/* ─── component ─── */
const CareConnect = () => {
  const { user: currentUser } = useAuth();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState(null);
  const [selectedPsy, setSelectedPsy] = useState(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [bookingDate, setBookingDate] = useState(null);
  const [bookingTime, setBookingTime] = useState("");
  const [sessionType, setSessionType] = useState("video");
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [availableSlots, setAvailableSlots] = useState(timeSlots);
  const [activeSession, setActiveSession] = useState(null);
  const [sessionTimer, setSessionTimer] = useState(0);
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [psychologists, setPsychologists] = useState(staticPsychologists);
  const [bookingNotice, setBookingNotice] = useState("");
  const [availableDays, setAvailableDays] = useState(["Mon", "Tue", "Wed", "Thu", "Fri"]);
  const filtered = useMemo(() => psychologists.filter((p) => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.spec.toLowerCase().includes(search.toLowerCase());
    const matchCat = !activeCategory || p.spec.toLowerCase().includes(activeCategory.toLowerCase().split(" ")[0].toLowerCase());
    return matchSearch && matchCat;
  }), [psychologists, search, activeCategory]);

  useEffect(() => {
    let interval;
    if (activeSession) {
      interval = setInterval(() => setSessionTimer((t) => t + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [activeSession]);

  useEffect(() => {
    const loadApprovedPsychologists = async () => {
      try {
        const q = query(collection(db, "psychologist_profiles"), where("approved", "==", true));
        const snap = await getDocs(q);
        const dynamic = snap.docs.map((d, i) => ({
          id: d.id || i,
          ...d.data(),
        }));
        if (dynamic.length > 0) {
          setPsychologists(mergePsychologistDirectory(dynamic));
          return;
        }
        const localProfiles = readLocalPsychologistProfiles();
        if (localProfiles.length > 0) {
          setPsychologists(mergePsychologistDirectory(localProfiles));
        }
      } catch (err) {
        console.warn("Psychologist profile fetch failed, using defaults.", err);
        const localProfiles = readLocalPsychologistProfiles();
        if (localProfiles.length > 0) {
          setPsychologists(mergePsychologistDirectory(localProfiles));
        }
      }
    };

    loadApprovedPsychologists();
  }, []);

  useEffect(() => {
    const loadUserSessions = async () => {
      if (!currentUser?.uid) {
        setSessions([]);
        return;
      }

      try {
        const bookingsQuery = query(
          collection(db, "careconnect_bookings"),
          where("userUid", "==", currentUser.uid)
        );
        const snapshot = await getDocs(bookingsQuery);
        const userSessions = snapshot.docs.map((bookingDoc) => ({
          id: bookingDoc.id,
          ...bookingDoc.data(),
        }));
        const expiredSessions = userSessions.filter(isExpiredSession);
        const activeSessions = userSessions.filter((session) => !isExpiredSession(session));

        if (expiredSessions.length > 0) {
          await Promise.all(
            expiredSessions.map((session) =>
              deleteDoc(doc(db, "careconnect_bookings", session.id))
            )
          );
        }

        activeSessions.sort((a, b) => {
          const aTime = a.createdAt?.seconds || 0;
          const bTime = b.createdAt?.seconds || 0;
          return bTime - aTime;
        });

        setSessions(activeSessions);
      } catch (err) {
        console.warn("User bookings fetch failed:", err);
        const localBookings = readLocalBookings(currentUser.uid);
        setSessions(localBookings.filter((session) => !isExpiredSession(session)));
        if (localBookings.length > 0) {
          setBookingNotice("");
        }
      }
    };

    loadUserSessions();
  }, [currentUser?.uid]);

  useEffect(() => {
    if (!currentUser?.uid || sessions.length === 0) return undefined;

    const purgeExpiredSessions = async () => {
      const expiredSessions = sessions.filter(isExpiredSession);
      if (expiredSessions.length === 0) return;

      try {
        await Promise.all(
          expiredSessions.map((session) =>
            deleteDoc(doc(db, "careconnect_bookings", session.id))
          )
        );
        setSessions((prev) => prev.filter((session) => !isExpiredSession(session)));
      } catch (err) {
        console.warn("Expired booking cleanup failed:", err);
      }
    };

    purgeExpiredSessions();
    const interval = setInterval(purgeExpiredSessions, 60000);
    return () => clearInterval(interval);
  }, [currentUser?.uid, sessions]);

  useEffect(() => {
    const loadPsychAvailability = async () => {
      if (!selectedPsy?.uid) {
        setAvailableSlots(timeSlots);
        setAvailableDays(["Mon", "Tue", "Wed", "Thu", "Fri"]);
        return;
      }
      try {
        const snap = await getDoc(doc(db, "psychologist_availability", selectedPsy.uid));
        if (!snap.exists()) {
          const localAvailability = readLocalAvailability(selectedPsy.uid);
          if (localAvailability) {
            setAvailableSlots(localAvailability.slots?.length ? localAvailability.slots : timeSlots);
            setAvailableDays(localAvailability.days?.length ? localAvailability.days : ["Mon", "Tue", "Wed", "Thu", "Fri"]);
            return;
          }
          setAvailableSlots(timeSlots);
          setAvailableDays(["Mon", "Tue", "Wed", "Thu", "Fri"]);
          return;
        }
        const availability = snap.data() || {};
        const slots = availability.slots || [];
        const days = availability.days || [];
        setAvailableSlots(slots.length > 0 ? slots : timeSlots);
        setAvailableDays(days.length > 0 ? days : ["Mon", "Tue", "Wed", "Thu", "Fri"]);
      } catch (err) {
        console.warn("Availability fetch failed:", err);
        const localAvailability = readLocalAvailability(selectedPsy.uid);
        if (localAvailability) {
          setAvailableSlots(localAvailability.slots?.length ? localAvailability.slots : timeSlots);
          setAvailableDays(localAvailability.days?.length ? localAvailability.days : ["Mon", "Tue", "Wed", "Thu", "Fri"]);
          return;
        }
        setAvailableSlots(timeSlots);
        setAvailableDays(["Mon", "Tue", "Wed", "Thu", "Fri"]);
      }
    };

    if (bookingOpen) {
      loadPsychAvailability();
    }
  }, [bookingOpen, selectedPsy]);

  useEffect(() => {
    if (!bookingDate) return;
    const selectedDay = WEEKDAY_LABELS[new Date(bookingDate).getDay()];
    if (!availableDays.includes(selectedDay)) {
      setBookingDate(null);
      setBookingTime("");
    } else if (bookingTime && !availableSlots.includes(bookingTime)) {
      setBookingTime("");
    }
  }, [availableDays, availableSlots, bookingDate, bookingTime]);

  const formatTimer = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const handleBook = () => {
    if (!currentUser) {
      toast.error("Please log in first to book a meeting.");
      return;
    }
    if (bookingDate) {
      const selectedDay = WEEKDAY_LABELS[new Date(bookingDate).getDay()];
      if (!availableDays.includes(selectedDay)) {
        toast.error("This psychologist is not available on the selected day.");
        return;
      }
    }
    if (bookingTime && !availableSlots.includes(bookingTime)) {
      toast.error("This time slot is not available.");
      return;
    }
    if (!bookingDate || !bookingTime || !selectedPsy) return;
    setPaymentOpen(true);
    setBookingOpen(false);
  };

  const handlePay = async (paymentResult = {}) => {
    if (!currentUser) {
      toast.error("Please log in first to complete payment.");
      return;
    }

    const finalPaymentMethod = paymentResult.method || "razorpay";
    if (!selectedPsy || !bookingDate) return;

    const sessionSlug = `melomind-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const meetLink = `https://meet.jit.si/${sessionSlug}`;
    const sessionStartsAt = buildSessionTimestamp(bookingDate, bookingTime);
    const bookingRecord = {
      psychologistUid: selectedPsy.uid || selectedPsy.id || null,
      psychologist: selectedPsy.name,
      psychologistSpecialization: selectedPsy.spec,
      date: format(bookingDate, "PPP"),
      time: bookingTime,
      type: sessionType,
      price: selectedPsy.price,
      meetLink,
      paymentMethod: finalPaymentMethod,
      paymentGateway: paymentResult.gateway || "razorpay",
      paymentOrderId: paymentResult.orderId || "",
      paymentId: paymentResult.paymentId || "",
      paymentStatus: paymentResult.payment?.status || "captured",
      status: "requested",
      sessionStartsAt,
      userUid: currentUser.uid,
      userEmail: currentUser.email || "",
      userName: currentUser.displayName || "",
      createdAt: serverTimestamp(),
    };

    try {
      const bookingRef = await addDoc(collection(db, "careconnect_bookings"), bookingRecord);
      const savedBooking = {
        id: bookingRef.id,
        ...bookingRecord,
      };
      saveLocalBooking(savedBooking);

      setSessions((prev) => [
        savedBooking,
        ...prev,
      ]);
      setBookingNotice("");
    } catch (err) {
      if (!isFirestorePermissionError(err)) {
        console.error("Booking save failed:", err);
        toast.error("Could not save booking. Please try again.");
        return;
      }

      const localBooking = {
        id: `local-booking-${Date.now()}`,
        ...bookingRecord,
        createdAt: new Date().toISOString(),
      };
      saveLocalBooking(localBooking);
      setSessions((prev) => [localBooking, ...prev]);
      setBookingNotice("");
    }

    try {
      const res = await fetch(apiUrl("/api/send_booking_email"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bookingRecord),
      });

      if (!res.ok) {
        console.warn("Email notification endpoint returned non-OK status");
      }
    } catch (err) {
      console.warn("Email notification failed:", err);
    }

    setPaymentOpen(false);
    setConfirmed(true);
    setTimeout(() => setConfirmed(false), 4000);
    setBookingDate(undefined);
    setBookingTime("");
  };

  const startSession = (type) => {
    setActiveSession({ type });
    setSessionTimer(0);
    setMuted(false);
    setCameraOff(false);
  };

  const endSession = () => {
    setActiveSession(null);
    setSessionTimer(0);
  };

  /* ─── active session overlay ─── */
  if (activeSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-player p-4">
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full max-w-lg">
          <Card className="bg-card border-border shadow-xl">
            <CardHeader className="text-center pb-2">
              <CardTitle className="text-xl font-semibold text-foreground">
                {activeSession.type === "video" ? "Video Meeting" : "Voice Meeting"}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-6 pb-8">
              {activeSession.type === "video" && (
                <div className="w-full aspect-video rounded-lg bg-muted flex items-center justify-center">
                  {cameraOff ? (
                    <VideoOff className="w-12 h-12 text-muted-foreground" />
                  ) : (
                    <User className="w-16 h-16 text-muted-foreground" />
                  )}
                </div>
              )}
              {activeSession.type === "voice" && (
                <div className="w-32 h-32 rounded-full bg-care-lavender/20 flex items-center justify-center">
                  <Phone className="w-12 h-12 text-care-lavender-dark" />
                </div>
              )}
              <div className="flex items-center gap-2 text-2xl font-mono text-foreground">
                <Timer className="w-5 h-5 text-muted-foreground" />
                {formatTimer(sessionTimer)}
              </div>
              <div className="flex gap-4">
                <Button variant={muted ? "destructive" : "outline"} size="icon" className="rounded-full w-12 h-12" onClick={() => setMuted(!muted)}>
                  {muted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                </Button>
                {activeSession.type === "video" && (
                  <Button variant={cameraOff ? "destructive" : "outline"} size="icon" className="rounded-full w-12 h-12" onClick={() => setCameraOff(!cameraOff)}>
                    {cameraOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
                  </Button>
                )}
                <Button variant="destructive" size="icon" className="rounded-full w-12 h-12" onClick={endSession}>
                  <PhoneOff className="w-5 h-5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  /* ─── main page ─── */
  return (
    <div className="min-h-screen bg-background">
      {/* confirmation toast */}
      <AnimatePresence>
        {confirmed && (
          <motion.div initial={{ opacity: 0, y: -40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -40 }} className="fixed top-4 left-1/2 -translate-x-1/2 z-50">
            <div className="flex items-center gap-3 bg-care-green/20 border border-care-green text-care-green-dark px-6 py-3 rounded-lg shadow-lg">
              <CheckCircle2 className="w-5 h-5" />
              <span className="font-medium">Your meeting is booked. A confirmation email is sent if SMTP is configured.</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 space-y-16">
        {/* ── hero ── */}
        <motion.section variants={fadeUp} initial="hidden" animate="visible" transition={{ duration: 0.5 }} className="text-center space-y-4">
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight">
            Connect with Trusted Emotional Well-Being Professionals
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto text-base sm:text-lg">
            Book private meetings with licensed psychologists and therapists.
          </p>
          {currentUser ? (
            <p className="text-sm text-care-green-dark font-medium">
              Logged in as {currentUser.email}
            </p>
          ) : (
            <p className="text-sm text-[#a45d15] font-medium">
              Please log in from Get Started in the navbar to book meetings.
            </p>
          )}
          <div className="mx-auto mt-3 max-w-xl rounded-xl border border-border bg-card/70 p-3 text-sm text-muted-foreground">
            Psychologist or therapist? Create your profile card from{" "}
            <Link
              to="/professionals/apply"
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-primary underline underline-offset-2"
            >
              Psychologist Onboarding
            </Link>
            . After admin approval, your card appears automatically in CareConnect.
          </div>
          {bookingNotice ? (
            <div className="mx-auto mt-3 max-w-xl rounded-xl border border-[#f4dfb1] bg-[#fff8eb] p-3 text-sm text-[#8a6612]">
              {bookingNotice}
            </div>
          ) : null}
          <div className="max-w-xl mx-auto relative mt-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search psychologists by name or specialization…" className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </motion.section>

        {/* ── categories ── */}
        <motion.section variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} transition={{ duration: 0.4 }}>
          <h2 className="text-xl font-semibold text-foreground mb-5">Therapy Categories</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {categories.map((cat) => {
              const Icon = cat.icon;
              const active = activeCategory === cat.name;
              return (
                <button key={cat.name} onClick={() => setActiveCategory(active ? null : cat.name)} className={cn("flex flex-col items-center gap-2 p-4 rounded-xl border transition-colors", active ? "border-primary bg-accent" : "border-border bg-card hover:border-primary/40")}>
                  <div className={cn("w-10 h-10 rounded-full flex items-center justify-center", cat.color)}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-medium text-card-foreground text-center leading-tight">{cat.name}</span>
                </button>
              );
            })}
          </div>
        </motion.section>

        {/* ── psychologist grid ── */}
        <motion.section variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} transition={{ duration: 0.4 }}>
          <h2 className="text-xl font-semibold text-foreground mb-5">Psychologist Explorer</h2>
          {filtered.length === 0 && <p className="text-muted-foreground">No psychologists match your search.</p>}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((psy) => (
              <Card key={psy.id} className="border-border shadow-sm">
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-care-lavender/20 flex items-center justify-center shrink-0">
                      <User className="w-6 h-6 text-care-lavender-dark" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-card-foreground text-sm truncate">{psy.name}</h3>
                      <p className="text-xs text-muted-foreground">{psy.spec}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{psy.exp} yrs exp</span>
                    <span className="flex items-center gap-0.5"><Star className="w-3 h-3 text-care-green" fill="hsl(var(--care-green))" />{psy.rating}</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{psy.desc}</p>
                  <div className="flex gap-2 pt-1">
                    <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => { setSelectedPsy(psy); setProfileOpen(true); }}>View Profile</Button>
                    <Button size="sm" className="flex-1 text-xs" onClick={() => { setSelectedPsy(psy); setBookingOpen(true); }}>Book Meeting</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </motion.section>

        {/* ── my sessions ── */}
        <motion.section variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} transition={{ duration: 0.4 }}>
          <h2 className="text-xl font-semibold text-foreground mb-5">My Meetings</h2>
          {sessions.length === 0 ? (
            <Card className="border-border"><CardContent className="p-6 text-center text-muted-foreground text-sm">No booked meetings yet. Book a meeting with a psychologist above.</CardContent></Card>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {sessions.map((s, i) => (
                <Card key={i} className="border-border shadow-sm">
                  <CardContent className="p-5 space-y-2">
                    <h3 className="font-semibold text-card-foreground text-sm">{s.psychologist}</h3>
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <Badge variant="secondary">{s.date}</Badge>
                      <Badge variant="secondary">{s.time}</Badge>
                      <Badge variant="secondary" className="capitalize">{s.type}</Badge>
                    </div>
                    {s.meetLink ? (
                      <a
                        href={s.meetLink}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-block text-xs text-primary underline"
                      >
                        Open Meeting Link
                      </a>
                    ) : null}
                    {s.userEmail ? <p className="text-[11px] text-muted-foreground">Booked by: {s.userEmail}</p> : null}
                    <Button size="sm" className="mt-2 text-xs" onClick={() => startSession(s.type)}>
                      {s.type === "video" ? <Video className="w-3.5 h-3.5 mr-1" /> : <Phone className="w-3.5 h-3.5 mr-1" />}
                      Join Meeting
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </motion.section>

        {/* ── support section ── */}
        <motion.section variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true }} transition={{ duration: 0.4 }}>
          <Card className="border-care-lavender/30 bg-care-lavender/10 shadow-none">
            <CardContent className="p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-care-lavender/20 flex items-center justify-center shrink-0">
                <MessageCircle className="w-6 h-6 text-care-lavender-dark" />
              </div>
              <div className="space-y-1">
                <h3 className="font-semibold text-foreground">Emotional Well-Being Support</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Taking care of your emotional well-being is important. Our psychologists are here to help you in a safe and private environment.
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.section>
      </div>

      {/* ── profile modal ── */}
      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg">{selectedPsy?.name}</DialogTitle>
            <DialogDescription>{selectedPsy?.spec}</DialogDescription>
          </DialogHeader>
          {selectedPsy && (
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-16 h-16 rounded-full bg-care-lavender/20 flex items-center justify-center">
                  <User className="w-8 h-8 text-care-lavender-dark" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">{selectedPsy.name}</p>
                  <p className="text-muted-foreground text-xs">{selectedPsy.qual}</p>
                </div>
              </div>
              {[
                ["Specialization", selectedPsy.spec],
                ["Experience", `${selectedPsy.exp} years`],
                ["Approach", selectedPsy.approach],
                ["Languages", selectedPsy.langs],
                ["Meeting Price", selectedPsy.price],
              ].map(([label, val]) => (
                <div key={label} className="flex justify-between border-b border-border pb-2">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-medium text-foreground">{val}</span>
                </div>
              ))}
              <div className="flex flex-col gap-2 pt-2">
                <Button onClick={() => { setProfileOpen(false); setBookingOpen(true); }}>Book Meeting</Button>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => { setProfileOpen(false); startSession("video"); }}>
                    <Video className="w-4 h-4 mr-1" /> Video Meeting
                  </Button>
                  <Button variant="outline" className="flex-1" onClick={() => { setProfileOpen(false); startSession("voice"); }}>
                    <Phone className="w-4 h-4 mr-1" /> Voice Meeting
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── booking modal ── */}
      <Dialog open={bookingOpen} onOpenChange={setBookingOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Book Meeting</DialogTitle>
            <DialogDescription>Choose date, time and meeting type.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Date</label>
              <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !bookingDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {bookingDate ? format(bookingDate, "PPP") : "Select a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-[340px] p-0 bg-white dark:bg-card border border-[#dbe7ec] shadow-xl rounded-xl z-50"
                  align="start"
                >
                  <div className="flex items-center justify-between border-b border-[#dbe7ec] px-3 py-2">
                    <p className="text-sm font-semibold text-foreground">Choose Meeting Date</p>
                    <button
                      type="button"
                      onClick={() => setCalendarOpen(false)}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-[#f4f9fb] hover:text-foreground"
                      aria-label="Close calendar"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <Calendar
                    mode="single"
                    showOutsideDays={false}
                    selected={bookingDate}
                    onSelect={(date) => {
                      if (!date) return;
                      setBookingDate(date);
                      setBookingTime("");
                      setCalendarOpen(false);
                    }}
                    disabled={(d) => {
                      const isPastDay = d < startOfDay(new Date());
                      const weekday = WEEKDAY_LABELS[d.getDay()];
                      return isPastDay || !availableDays.includes(weekday);
                    }}
                    className="pointer-events-auto p-3"
                    classNames={{
                      month: "space-y-3",
                      caption: "flex justify-center pt-1 relative items-center pb-1",
                      caption_label: "text-sm font-semibold text-foreground",
                      table: "w-full border-collapse",
                      head_row: "grid grid-cols-7 gap-1",
                      head_cell:
                        "h-8 w-10 flex items-center justify-center text-[0.72rem] font-semibold uppercase tracking-wide text-[#6b7f90]",
                      row: "grid grid-cols-7 gap-1 mt-1",
                      cell: "h-10 w-10 p-0 text-center text-sm relative",
                      day: "h-10 w-10 rounded-md text-sm font-medium hover:bg-[#f4f9fb]",
                      day_today: "bg-[#eefaf6] text-[#00a58f] ring-1 ring-[#cfe7df]",
                      day_selected:
                        "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
                      day_disabled: "text-[#bfd0d9] opacity-70",
                    }}
                  />
                </PopoverContent>
              </Popover>
              <p className="mt-2 text-xs text-muted-foreground">
                Available days: {availableDays.join(", ")}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Time Slot</label>
              <div className="grid grid-cols-4 gap-2">
                {availableSlots.map((t) => (
                  <button key={t} onClick={() => setBookingTime(t)} className={cn("text-xs py-2 rounded-md border transition-colors", bookingTime === t ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary/40")}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Meeting Type</label>
              <div className="flex gap-2">
                {["video", "voice"].map((t) => (
                  <button key={t} onClick={() => setSessionType(t)} className={cn("flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md border text-sm capitalize transition-colors", sessionType === t ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary/40")}>
                    {t === "video" ? <Video className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
                    {t === "video" ? "Video Call" : "Voice Call"}
                  </button>
                ))}
              </div>
            </div>
            <Button className="w-full" disabled={!bookingDate || !bookingTime} onClick={handleBook}>Confirm Meeting</Button>
          </div>
        </DialogContent>
      </Dialog>

      <PremiumCheckoutModal
        open={paymentOpen}
        title={selectedPsy ? `${selectedPsy.name} Meeting` : "Meeting Booking"}
        subtitle="Complete your CareConnect meeting payment"
        amount={selectedPsy?.price ?? ""}
        amountValue={extractPriceValue(selectedPsy?.price)}
        currency="INR"
        priceLine={bookingDate ? `${format(bookingDate, "PPP")} at ${bookingTime}` : "Private meeting"}
        customerName={currentUser?.displayName || ""}
        customerEmail={currentUser?.email || ""}
        note="After payment, your booking is stored and meeting confirmation is prepared for email delivery."
        description={selectedPsy ? `${selectedPsy.name} consultation meeting` : "CareConnect meeting"}
        receiptPrefix="careconnect"
        notes={{
          purpose: "careconnect_meeting",
          psychologist: selectedPsy?.name || "",
          meeting_type: sessionType,
        }}
        onClose={() => setPaymentOpen(false)}
        onConfirm={handlePay}
      />
    </div>
  );
};

export default CareConnect;
