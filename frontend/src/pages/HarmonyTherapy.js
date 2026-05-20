import { useNavigate } from "react-router-dom";
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Play, Pause, SkipBack, SkipForward, Search,
  Plus, Bell, BarChart2, BookOpen, Music,
  Wind, CloudRain, TreePine, Activity,
  Heart, Brain
} from 'lucide-react';
import { toast } from "../lib/notify";
import { db } from "../firebase";
import { auth } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, addDoc, getDoc, getDocs, setDoc, deleteDoc, doc, updateDoc } from "firebase/firestore";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import tone528 from "../assets/music/528hz.mp3";
import alphaMeditation from "../assets/music/alpha-meditation.mp3";
import binaural16hz from "../assets/music/binaural-16hz.mp3";
import delta25hz from "../assets/music/delta-25hz.mp3";
import healingMix from "../assets/music/healing-mix.mp3";

const resolveAudibleFrequency = (sound) => {
  const raw = Number(sound?.frequencyHz) || 220;
  if (raw < 20) return 196;
  if (raw < 40) return 392;
  if (raw < 80) return 285;
  if (raw > 880) return 660;
  return raw;
};



// --- Data ---
const frequencies = [
  { id: 1, name: 'Gamma', value: '35 Hz', desc: 'Awareness and learning', cat: 'Focus', audio: binaural16hz, frequencyHz: 35, waveform: 'triangle' },
  { id: 2, name: 'Beta', value: '15 Hz', desc: 'Focus and productivity', cat: 'Focus', audio: binaural16hz, frequencyHz: 15, waveform: 'triangle' },
  { id: 3, name: 'Alpha', value: '10 Hz', desc: 'Relaxation and stress reduction', cat: 'Relax', audio: alphaMeditation, frequencyHz: 10, waveform: 'sine' },
  { id: 4, name: 'Theta', value: '7.5 Hz', desc: 'Deep meditation and creativity', cat: 'Meditation', audio: healingMix, frequencyHz: 7.5, waveform: 'sine' },
  { id: 5, name: 'Delta', value: '2 Hz', desc: 'Deep sleep and recovery', cat: 'Sleep', audio: delta25hz, frequencyHz: 2, waveform: 'sine' },
  { id: 6, name: 'Crown Chakra', value: '963 Hz', desc: 'Spiritual connection', cat: 'Chakra', audio: tone528, frequencyHz: 963, waveform: 'sine' },
  { id: 7, name: 'Third Eye Chakra', value: '852 Hz', desc: 'Intuition and inner wisdom', cat: 'Chakra', audio: healingMix, frequencyHz: 852, waveform: 'sine' },
  { id: 8, name: 'Throat Chakra', value: '741 Hz', desc: 'Communication and expression', cat: 'Chakra', audio: alphaMeditation, frequencyHz: 741, waveform: 'sine' },
  { id: 9, name: 'Heart Chakra', value: '639 Hz', desc: 'Love and relationships', cat: 'Chakra', audio: tone528, frequencyHz: 639, waveform: 'sine' },
  { id: 10, name: 'Sacral Chakra', value: '417 Hz', desc: 'Change and creativity', cat: 'Chakra', audio: healingMix, frequencyHz: 417, waveform: 'sine' },
  { id: 11, name: 'Root Chakra', value: '396 Hz', desc: 'Grounding and safety', cat: 'Chakra', audio: delta25hz, frequencyHz: 396, waveform: 'sine' },
];

const buildSamplePlaylist = (id, name, soundIds, duration) => ({
  id,
  name,
  sounds: soundIds
    .map((soundId) => frequencies.find((sound) => sound.id === soundId))
    .filter(Boolean)
    .map((sound) => ({
      id: sound.id,
      name: sound.name,
      value: sound.value,
      audio: sound.audio,
      frequencyHz: sound.frequencyHz,
      waveform: sound.waveform,
      desc: sound.desc,
      cat: sound.cat,
    })),
  count: soundIds.length,
  duration,
});

const SAMPLE_PLAYLISTS = [
  buildSamplePlaylist("demo_focus_flow", "Morning Focus Flow", [2, 1, 3], "15m"),
  buildSamplePlaylist("demo_evening_reset", "Evening Calm Reset", [3, 4, 5], "15m"),
];

const SAMPLE_REMINDERS = [
  {
    id: "demo_reminder_morning",
    title: "Morning Focus Session",
    time: "07:30",
    days: ["Mon", "Tue", "Wed", "Thu", "Fri"],
    enabled: true,
  },
  {
    id: "demo_reminder_evening",
    title: "Evening Relax Reset",
    time: "21:00",
    days: ["Mon", "Wed", "Fri", "Sun"],
    enabled: true,
  },
];

const surveyQuestions = [
  "Did the music therapy help you feel calmer?",
  "Did the sounds reduce your stress?",
  "Did you feel more relaxed after listening?",
  "Did the therapy improve your mood?",
  "Did the session help you feel emotionally balanced?",
  "Did the therapy reduce anxiety?",
  "Did the session improve your focus?",
  "Did you feel emotionally refreshed after listening?",
  "Would you like to continue using music therapy?",
  "Overall, how helpful was the session?"
];

const filters = ['All', 'Meditation', 'Focus', 'Relax', 'Sleep', 'Chakra'];

const navItems = [
  { id: 'explore', icon: Search, label: 'Explore' },
  { id: 'player', icon: Play, label: 'Player' },
  { id: 'playlists', icon: Music, label: 'Playlists' },
  { id: 'mood-diary', icon: BookOpen, label: 'Mood Diary' },
  { id: 'reminders', icon: Bell, label: 'Reminders' },
  { id: 'statistics', icon: BarChart2, label: 'Statistics' },
];

const DAILY_GOAL_MINUTES = 20;
const SURVEY_UNLOCK_TRACKS = 2;
const LOCAL_HARMONY_PREFIX = "melomind_harmony";
const DEMO_PREMIUM_RUNTIME_KEY = "__melomindDemoPremiumAccess";
const REMINDER_DAY_OPTIONS = [
  { id: "Sun", label: "Su", legacy: ["S", "Sun"] },
  { id: "Mon", label: "M", legacy: ["M", "Mon"] },
  { id: "Tue", label: "Tu", legacy: ["T", "Tu", "Tue"] },
  { id: "Wed", label: "W", legacy: ["W", "Wed"] },
  { id: "Thu", label: "Th", legacy: ["T", "Th", "Thu"] },
  { id: "Fri", label: "F", legacy: ["F", "Fri"] },
  { id: "Sat", label: "Sa", legacy: ["S", "Sa", "Sat"] },
];

const isFirestorePermissionError = (error) => {
  const code = String(error?.code || "").toLowerCase();
  const message = String(error?.message || "").toLowerCase();
  return code.includes("permission-denied") || message.includes("missing or insufficient permissions");
};

const getStorageOwner = (user) => user?.uid || user?.email || "guest";

const getHarmonyStorageKey = (section, user, suffix = "") =>
  `${LOCAL_HARMONY_PREFIX}_${section}_${getStorageOwner(user)}${suffix ? `_${suffix}` : ""}`;

const readLocalValue = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const writeLocalValue = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
};

const createLocalId = (prefix) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const readDemoPremiumAccess = () => {
  try {
    const premium = window[DEMO_PREMIUM_RUNTIME_KEY];
    return premium?.active ? premium : null;
  } catch {
    return null;
  }
};

const readDemoCredits = () => {
  const premium = readDemoPremiumAccess();
  if (premium?.active) {
    return Number.isFinite(Number(premium.credits)) ? Number(premium.credits) : 999;
  }
  return 5;
};

const writeDemoCredits = (value) => {
  try {
    const premium = readDemoPremiumAccess();
    if (premium?.active) {
      window[DEMO_PREMIUM_RUNTIME_KEY] = {
        ...premium,
        credits: value,
      };
    }
  } catch {}
};

const reminderHasDay = (days = [], dayId) => {
  const option = REMINDER_DAY_OPTIONS.find((day) => day.id === dayId);
  if (!option) return false;
  return (days || []).some((value) => option.legacy.includes(value));
};

// --- Sub-components ---
const SectionHeading = ({ title, subtitle }) => (
  <div className="mb-8">
    <h2 className="text-2xl font-semibold text-foreground tracking-tight">{title}</h2>
    {subtitle && <p className="text-muted-foreground text-sm mt-1">{subtitle}</p>}
  </div>
);

const WellnessCard = ({ children, className = "" }) => (
  <div className={`bg-card border border-border rounded-2xl p-6 shadow-sm transition-shadow duration-300 ${className}`}>
    {children}
  </div>
);

// --- Helpers ---
const formatTime = (s) => {
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const scrollToSection = (id) => {
  const el = document.getElementById(id);
  if (el) {
    const top = el.getBoundingClientRect().top + window.scrollY - 20;
    window.scrollTo({ top, behavior: 'smooth' });
  }
};

// --- Main Page ---
const HarmonyTherapy = () => {
  const navigate = useNavigate();

  const [playlists, setPlaylists] = useState(SAMPLE_PLAYLISTS);

  const [currentPlaylist, setCurrentPlaylist] = useState(null);
  const [playlistIndex, setPlaylistIndex] = useState(0);

  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [playlistName, setPlaylistName] = useState("");
  const [selectedSounds, setSelectedSounds] = useState([]);

  const [credits, setCredits] = useState(() => readDemoCredits());
  const [showCreditPopup, setShowCreditPopup] = useState(false);
  const [hasDemoPremium, setHasDemoPremium] = useState(() => Boolean(readDemoPremiumAccess()));

  const [isCreatingPlaylist, setIsCreatingPlaylist] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentSound, setCurrentSound] = useState(null);
  const [timer, setTimer] = useState(0);
  const [currentUser, setCurrentUser] = useState(null);
  const [, setPageNotice] = useState("");
  const [dailyCompletedSeconds, setDailyCompletedSeconds] = useState(0);
  const [listenedTrackIds, setListenedTrackIds] = useState([]);

  const audioRef = useRef(null);
  const audioContextRef = useRef(null);
  const synthNodesRef = useRef(null);
  const currentPlaylistRef = useRef(null);
  const playlistIndexRef = useRef(0);
  const loadedAudioSrcRef = useRef("");

  const [layers, setLayers] = useState({
    rain: false,
    wind: false,
    forest: false
  });

  const stopSynth = React.useCallback(() => {
    const nodes = synthNodesRef.current;
    if (!nodes) return;

    try {
      nodes.oscillators?.forEach((osc) => osc.stop());
    } catch {}

    try {
      nodes.masterGain?.disconnect();
      nodes.lfo?.disconnect();
      nodes.lfoGain?.disconnect();
    } catch {}

    synthNodesRef.current = null;
  }, []);

  const startSynth = React.useCallback(async (sound) => {
    if (!sound?.frequencyHz) return;

    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    if (!audioContextRef.current) {
      audioContextRef.current = new AudioCtx();
    }

    const ctx = audioContextRef.current;
    if (ctx.state === "suspended") {
      await ctx.resume();
    }

    stopSynth();

    const baseFreq = resolveAudibleFrequency(sound);
    const waveform = sound.waveform || "sine";
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.0001, ctx.currentTime);
    masterGain.connect(ctx.destination);

    const osc1 = ctx.createOscillator();
    osc1.type = waveform;
    osc1.frequency.setValueAtTime(baseFreq, ctx.currentTime);

    const osc2 = ctx.createOscillator();
    osc2.type = waveform === "triangle" ? "sine" : waveform;
    osc2.frequency.setValueAtTime(Math.min(baseFreq * 1.5, 880), ctx.currentTime);

    const osc3 = ctx.createOscillator();
    osc3.type = "sine";
    osc3.frequency.setValueAtTime(Math.max(baseFreq / 2, 130), ctx.currentTime);

    const gain1 = ctx.createGain();
    const gain2 = ctx.createGain();
    const gain3 = ctx.createGain();
    gain1.gain.value = 0.12;
    gain2.gain.value = 0.055;
    gain3.gain.value = 0.03;

    const lfo = ctx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = 0.24;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = Math.max(baseFreq * 0.008, 0.55);

    osc1.connect(gain1);
    osc2.connect(gain2);
    osc3.connect(gain3);
    gain1.connect(masterGain);
    gain2.connect(masterGain);
    gain3.connect(masterGain);
    lfo.connect(lfoGain);
    lfoGain.connect(osc1.frequency);

    osc1.start();
    osc2.start();
    osc3.start();
    lfo.start();
    masterGain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.25);

    synthNodesRef.current = {
      oscillators: [osc1, osc2, osc3],
      masterGain,
      lfo,
      lfoGain,
    };
  }, [stopSynth]);

  const handleClose = () => {
    setShowCreditPopup(false);
  };

  const [reminders, setReminders] = useState(SAMPLE_REMINDERS);

  const [stats, setStats] = useState({
    sessions: 0,
    totalSeconds: 0,
    mostPlayed: null
  });

  const [surveyScores, setSurveyScores] = useState({});
  const [surveyResult, setSurveyResult] = useState(null);

  const [moodEntries, setMoodEntries] = useState([]);

  const [selectedDate, setSelectedDate] = useState(new Date());

  const [showMoodModal, setShowMoodModal] = useState(false);

  const [showCreateMoodModal, setShowCreateMoodModal] = useState(false);
  const [showReminderModal, setShowReminderModal] = useState(false);

  const [isCreatingReminder, setIsCreatingReminder] = useState(false);

  const [newReminder, setNewReminder] = useState({
    title: "",
    time: "",
    days: []
  });


  const [moodForm, setMoodForm] = useState({
    emotion: "",
    rating: 3,
    note: "",
    tags: ""
  });
  const storageOwner = useMemo(() => getStorageOwner(currentUser), [currentUser]);
  const localKey = useCallback(
    (section, suffix = "") => getHarmonyStorageKey(section, currentUser, suffix),
    [currentUser]
  );

  const applyLocalFallbackNotice = () => {
    setPageNotice("");
  };

  const getTodayKey = () => new Date().toISOString().slice(0, 10);

  const hydratePlaylistSounds = (playlist) => ({
    ...playlist,
    sounds: (playlist.sounds || []).map((sound) => {
      const freq = frequencies.find((f) => String(f.id) === String(sound.id));
        return {
          ...sound,
          audio: sound.audio || freq?.audio || "",
          frequencyHz: sound.frequencyHz || freq?.frequencyHz || null,
          waveform: sound.waveform || freq?.waveform || "sine",
          desc: sound.desc || freq?.desc || "",
          cat: sound.cat || freq?.cat || "",
        };
    }),
  });

  const markTrackListened = (sound) => {
    if (!sound?.id) return;
    setListenedTrackIds((prev) => {
      const key = String(sound.id);
      if (prev.includes(key)) return prev;
      return [...prev, key];
    });
  };

  const activateSound = (sound, options = {}) => {
    const {
      playlist = null,
      index = 0,
      countSession = false,
    } = options;

    if (!sound) return;

    loadedAudioSrcRef.current = "";
    setCurrentPlaylist(playlist);
    setPlaylistIndex(index);
    setCurrentSound(sound);
    markTrackListened(sound);
    setIsPlaying(true);
    setTimer(0);

    if (countSession) {
      setStats((prev) => ({
        ...prev,
        sessions: prev.sessions + 1,
        mostPlayed: sound.name,
      }));
    }
  };

  const movePlayback = (direction) => {
    if (!currentSound) return;

    if (currentPlaylist?.sounds?.length) {
      const nextIndex =
        (playlistIndex + direction + currentPlaylist.sounds.length) % currentPlaylist.sounds.length;
      activateSound(currentPlaylist.sounds[nextIndex], {
        playlist: currentPlaylist,
        index: nextIndex,
      });
      return;
    }

    const library = filteredFrequencies.length ? filteredFrequencies : frequencies;
    const currentIndex = library.findIndex((sound) => String(sound.id) === String(currentSound.id));
    const safeIndex = currentIndex >= 0 ? currentIndex : 0;
    const nextIndex = (safeIndex + direction + library.length) % library.length;
    activateSound(library[nextIndex], { countSession: false });
  };

  // --- Delete Playlist ---
  const toggleReminder = async (id) => {
    const reminder = reminders.find((r) => r.id === id);
    if (!reminder) return;

    const newState = !reminder.enabled;
    const nextReminders = reminders.map((r) =>
      r.id === id ? { ...r, enabled: newState } : r
    );

    try {
      await updateDoc(doc(db, "reminders", id), { enabled: newState });
    } catch (error) {
      console.error("Reminder toggle failed:", error);
      if (isFirestorePermissionError(error)) {
        applyLocalFallbackNotice();
      } else {
        toast.error("Could not update the reminder right now.");
      }
    }

    setReminders(nextReminders);
    writeLocalValue(localKey("reminders"), nextReminders);
  };

  const deletePlaylist = async (id) => {

    try {
      await deleteDoc(doc(db, "playlists", id));
    } catch (error) {
      console.error("Playlist delete failed:", error);
      if (isFirestorePermissionError(error)) {
        applyLocalFallbackNotice();
      } else {
        toast.info("Removing the playlist from local data instead.");
      }
    }

    const nextPlaylists = playlists.filter((pl) => pl.id !== id);
    setPlaylists(nextPlaylists);
    writeLocalValue(localKey("playlists"), nextPlaylists);

  };

  // --- Toggle Sound Selection ---
  const toggleSound = (sound) => {

    setSelectedSounds(prev => {

      const exists = prev.find(s => s.id === sound.id);

      if (exists) {
        return prev.filter(s => s.id !== sound.id);
      }

      return [...prev, sound];

    });

  };

  const deleteReminder = async (id) => {

    try {
      await deleteDoc(doc(db, "reminders", id));
    } catch (error) {
      console.error("Error deleting reminder:", error);
      if (isFirestorePermissionError(error)) {
        applyLocalFallbackNotice();
      } else {
        toast.info("Removing the reminder from local data instead.");
      }
    }

    const nextReminders = reminders.filter((r) => r.id !== id);
    setReminders(nextReminders);
    writeLocalValue(localKey("reminders"), nextReminders);

  };

  // --- Start Playlist ---
  const startPlaylist = (playlist) => {

    if (!hasDemoPremium && credits <= 0) {
      setShowCreditPopup(true);
      return;
    }

    const hydrated = hydratePlaylistSounds(playlist);

    if (!hydrated.sounds || hydrated.sounds.length === 0) return;

    if (!hasDemoPremium) {
      setCredits(prev => prev - 1);
    }

    activateSound(hydrated.sounds[0], {
      playlist: hydrated,
      index: 0,
      countSession: true,
    });
  };

  // --- Create Playlist ---

  const createReminder = async () => {

    if (isCreatingReminder) return;

    if (!newReminder.title || !newReminder.time) {
      toast.error("Please enter a reminder title and time.");
      return;
    }

    if (newReminder.days.length === 0) {
      toast.error("Please choose at least one day for the reminder.");
      return;
    }

    setIsCreatingReminder(true);

    try {

      const reminderData = {
        title: newReminder.title,
        time: newReminder.time,
        days: newReminder.days,
        enabled: true
      };

      let reminderRecord;

      try {
        const docRef = await addDoc(collection(db, "reminders"), reminderData);
        reminderRecord = { id: docRef.id, ...reminderData };
      } catch (error) {
        console.error("Error creating reminder:", error);
        if (!isFirestorePermissionError(error)) {
          toast.error("Could not create the reminder right now.");
          return;
        }
        applyLocalFallbackNotice();
        reminderRecord = { id: createLocalId("reminder"), ...reminderData };
      }

      const nextReminders = [...reminders, reminderRecord];
      setReminders(nextReminders);
      writeLocalValue(localKey("reminders"), nextReminders);

      setShowReminderModal(false);

      setNewReminder({
        title: "",
        time: "",
        days: []
      });

    } catch (error) {
      console.error("Error creating reminder:", error);
    }

    setIsCreatingReminder(false);
  };

  const createPlaylist = async () => {

    if (isCreatingPlaylist) return;

    if (!playlistName || selectedSounds.length === 0) {
      toast.error("Please enter a playlist name and select sounds.");
      return;
    }

    setIsCreatingPlaylist(true);

    try {

      const newPlaylist = {
        name: playlistName,
        sounds: selectedSounds.map(s => ({
          id: s.id,
          name: s.name,
          value: s.value,
          audio: s.audio,
          frequencyHz: s.frequencyHz,
          waveform: s.waveform,
          desc: s.desc,
          cat: s.cat,
        })),
        count: selectedSounds.length,
        duration: `${selectedSounds.length * 5}m`
      };

      let playlistRecord;

      try {
        const docRef = await addDoc(collection(db, "playlists"), newPlaylist);
        playlistRecord = hydratePlaylistSounds({ id: docRef.id, ...newPlaylist });
      } catch (error) {
        console.error("Error creating playlist:", error);
        if (!isFirestorePermissionError(error)) {
          toast.error("Could not create the playlist right now.");
          return;
        }
        applyLocalFallbackNotice();
        playlistRecord = hydratePlaylistSounds({ id: createLocalId("playlist"), ...newPlaylist });
      }

      const nextPlaylists = [...playlists, playlistRecord];
      setPlaylists(nextPlaylists);
      writeLocalValue(localKey("playlists"), nextPlaylists);

      setPlaylistName("");
      setSelectedSounds([]);
      setShowPlaylistModal(false);
    } catch (error) {
      console.error("Playlist flow failed:", error);
    }

    setIsCreatingPlaylist(false);
  };


  const filteredFrequencies = useMemo(() => {
    return frequencies.filter(f => {
      const matchesSearch = f.name.toLowerCase().includes(searchQuery.toLowerCase()) || f.cat.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesFilter = activeFilter === 'All' || f.cat === activeFilter;
      return matchesSearch && matchesFilter;
    });
  }, [searchQuery, activeFilter]);

  useEffect(() => {
    currentPlaylistRef.current = currentPlaylist;
  }, [currentPlaylist]);

  useEffect(() => {
    playlistIndexRef.current = playlistIndex;
  }, [playlistIndex]);

  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.preload = "auto";
      audioRef.current.crossOrigin = "anonymous";
    }

    const onEnded = () => {
      const activePlaylist = currentPlaylistRef.current;
      const activeIndex = playlistIndexRef.current;

      if (activePlaylist && activeIndex + 1 < activePlaylist.sounds.length) {
        const nextIndex = activeIndex + 1;
        const nextSound = activePlaylist.sounds[nextIndex];
        setPlaylistIndex(nextIndex);
        setCurrentSound(nextSound);
        markTrackListened(nextSound);
        setTimer(0);
        setIsPlaying(true);
      } else {
        setIsPlaying(false);
      }
    };

    audioRef.current.addEventListener("ended", onEnded);

    return () => {
      if (audioRef.current) {
        audioRef.current.removeEventListener("ended", onEnded);
        audioRef.current.pause();
      }
      stopSynth();
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        audioContextRef.current.close().catch(() => {});
      }
    };
  }, [stopSynth]);

  useEffect(() => {
    const readLocalGoogleUser = () => {
      try {
        const raw = localStorage.getItem("melomind_google_user");
        return raw ? JSON.parse(raw) : null;
      } catch {
        return null;
      }
    };

    const unsub = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user || readLocalGoogleUser());
    });

    if (!auth.currentUser) setCurrentUser(readLocalGoogleUser());

    return () => unsub();
  }, []);

  useEffect(() => {
    const premium = readDemoPremiumAccess();
    if (premium) {
      setHasDemoPremium(true);
      setCredits(Number.isFinite(Number(premium.credits)) ? Number(premium.credits) : 999);
      return;
    }

    setHasDemoPremium(false);
    setCredits(5);
  }, []);

  useEffect(() => {
    if (hasDemoPremium) {
      writeDemoCredits(999);
    }
  }, [credits, hasDemoPremium]);

  useEffect(() => {
    const loadDailyProgress = async () => {
      if (!storageOwner) return;
      const dailyKey = localKey("daily_progress", getTodayKey());
      if (!currentUser?.uid) {
        const localProgress = readLocalValue(dailyKey, {
          completedSeconds: 0,
          listenedTrackIds: [],
        });
        setDailyCompletedSeconds(localProgress.completedSeconds || 0);
        setListenedTrackIds(localProgress.listenedTrackIds || []);
        return;
      }

      try {
        const key = `${currentUser.uid}_${getTodayKey()}`;
        const ref = doc(db, "harmony_daily_progress", key);
        const snapshot = await getDoc(ref);
        if (!snapshot.exists()) {
          setDailyCompletedSeconds(0);
          setListenedTrackIds([]);
          writeLocalValue(dailyKey, {
            completedSeconds: 0,
            listenedTrackIds: [],
          });
          return;
        }

        const data = snapshot.data() || {};
        setDailyCompletedSeconds(data.completedSeconds || 0);
        setListenedTrackIds(data.listenedTrackIds || []);
        writeLocalValue(dailyKey, {
          completedSeconds: data.completedSeconds || 0,
          listenedTrackIds: data.listenedTrackIds || [],
        });
      } catch (error) {
        console.error("Daily progress fetch failed:", error);
        if (isFirestorePermissionError(error)) {
          applyLocalFallbackNotice();
        }
        const localProgress = readLocalValue(dailyKey, {
          completedSeconds: 0,
          listenedTrackIds: [],
        });
        setDailyCompletedSeconds(localProgress.completedSeconds || 0);
        setListenedTrackIds(localProgress.listenedTrackIds || []);
      }
    };

    loadDailyProgress();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.uid, storageOwner, localKey]);

  useEffect(() => {
    const saveDailyProgress = async () => {
      if (!storageOwner) return;
      const payload = {
        uid: currentUser?.uid || "",
        email: currentUser?.email || "",
        date: getTodayKey(),
        completedSeconds: dailyCompletedSeconds,
        completedMinutes: Math.floor(dailyCompletedSeconds / 60),
        listenedTrackIds,
        listenedTrackCount: listenedTrackIds.length,
        updatedAt: new Date().toISOString(),
      };
      writeLocalValue(localKey("daily_progress", getTodayKey()), payload);

      if (!currentUser?.uid) return;

      try {
        const key = `${currentUser.uid}_${getTodayKey()}`;
        await setDoc(doc(db, "harmony_daily_progress", key), payload, { merge: true });
      } catch (error) {
        console.error("Daily progress save failed:", error);
        if (isFirestorePermissionError(error)) {
          applyLocalFallbackNotice();
        }
      }
    };

    saveDailyProgress();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.uid, dailyCompletedSeconds, listenedTrackIds, storageOwner, localKey]);

  useEffect(() => {
    if (!audioRef.current) return;
    if (!currentSound) {
      audioRef.current.pause();
      stopSynth();
      return;
    }

    const hasAudio = Boolean(currentSound?.audio);

    if (!hasAudio && currentSound.frequencyHz) {
      audioRef.current.pause();
      if (isPlaying) {
        startSynth(currentSound).catch((err) => {
          console.error("Synth play failed:", err);
          setIsPlaying(false);
        });
      } else {
        stopSynth();
      }
      return;
    }

    stopSynth();

    if (!hasAudio) {
      audioRef.current.pause();
      return;
    }

    if (loadedAudioSrcRef.current !== currentSound.audio) {
      audioRef.current.src = currentSound.audio;
      audioRef.current.currentTime = 0;
      loadedAudioSrcRef.current = currentSound.audio;
    }

    if (isPlaying) {
      audioRef.current.play().catch((err) => {
        console.error("Audio play failed:", err);
        setIsPlaying(false);
      });
    } else {
      audioRef.current.pause();
    }
  }, [currentSound, isPlaying, startSynth, stopSynth]);

  useEffect(() => {
    const fetchPlaylists = async () => {
      const localPlaylists = readLocalValue(localKey("playlists"), []);
      try {
        const querySnapshot = await getDocs(collection(db, "playlists"));
        const data = querySnapshot.docs.map((item) => ({
          id: item.id,
          ...item.data()
        }));
        const sourcePlaylists = data.length ? data : (localPlaylists.length ? localPlaylists : SAMPLE_PLAYLISTS);
        const hydrated = sourcePlaylists.map(hydratePlaylistSounds);
        setPlaylists(hydrated);
        writeLocalValue(localKey("playlists"), hydrated);
      } catch (error) {
        console.error("Playlist fetch failed:", error);
        if (isFirestorePermissionError(error)) {
          applyLocalFallbackNotice();
        }
        const fallbackPlaylists = (localPlaylists.length ? localPlaylists : SAMPLE_PLAYLISTS).map(hydratePlaylistSounds);
        setPlaylists(fallbackPlaylists);
        writeLocalValue(localKey("playlists"), fallbackPlaylists);
      }
    };

    fetchPlaylists();
  }, [storageOwner, localKey]);

  useEffect(() => {

    const fetchReminders = async () => {
      const localReminders = readLocalValue(localKey("reminders"), []);
      try {
        const querySnapshot = await getDocs(collection(db, "reminders"));
        const data = querySnapshot.docs.map((item) => ({
          id: item.id,
          ...item.data()
        }));
        const sourceReminders = data.length ? data : (localReminders.length ? localReminders : SAMPLE_REMINDERS);
        setReminders(sourceReminders);
        writeLocalValue(localKey("reminders"), sourceReminders);
      } catch (error) {
        console.error("Reminder fetch failed:", error);
        if (isFirestorePermissionError(error)) {
          applyLocalFallbackNotice();
        }
        const fallbackReminders = localReminders.length ? localReminders : SAMPLE_REMINDERS;
        setReminders(fallbackReminders);
        writeLocalValue(localKey("reminders"), fallbackReminders);
      }

    };

    fetchReminders();

  }, [storageOwner, localKey]);

  useEffect(() => {

    const fetchEntries = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "moodDiary"));
        const data = querySnapshot.docs.map((item) => ({
          id: item.id,
          ...item.data()
        }));
        setMoodEntries(data);
        writeLocalValue(localKey("mood_entries"), data);
      } catch (error) {
        console.error("Mood diary fetch failed:", error);
        if (isFirestorePermissionError(error)) {
          applyLocalFallbackNotice();
        }
        setMoodEntries(readLocalValue(localKey("mood_entries"), []));
      }
    };

    fetchEntries();

  }, [storageOwner, localKey]);

  useEffect(() => {

    const interval = setInterval(() => {

      const now = new Date();

      const currentTime =
        now.getHours().toString().padStart(2, "0") +
        ":" +
        now.getMinutes().toString().padStart(2, "0");

      reminders.forEach(rem => {

        const today = REMINDER_DAY_OPTIONS[now.getDay()].id;

        if (rem.enabled && rem.time === currentTime && reminderHasDay(rem.days, today)) {
          toast.info(`Meditation reminder: ${rem.title}`);
        }

      });

    }, 60000);

    return () => clearInterval(interval);

  }, [reminders]);

  useEffect(() => {

    let interval;

    if (isPlaying) {

      interval = setInterval(() => {

        setTimer(prev => {

          if (prev >= 1200) { // 20 minutes

            if (currentPlaylist) {

              const nextIndex = playlistIndex + 1;

              if (nextIndex < currentPlaylist.sounds.length) {

                setPlaylistIndex(nextIndex);
                setCurrentSound(currentPlaylist.sounds[nextIndex]);
                return 0;

              } else {

                setIsPlaying(false);
                return 0;

              }

            }

            return 0;
          }

          return prev + 1;

        });

        setStats(prev => ({
          ...prev,
          totalSeconds: prev.totalSeconds + 1
        }));

        setDailyCompletedSeconds((prev) => prev + 1);

      }, 1000);

    }

    return () => clearInterval(interval);

  }, [isPlaying, playlistIndex, currentPlaylist]);

  const handleSurveySubmit = () => {
    const values = Object.values(surveyScores);
    if (values.length < surveyQuestions.length) {
      toast.error("Please answer all questions before submitting.");
      return;
    }
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    setSurveyResult(avg);
  };

  const createMoodEntry = async () => {
    if (!moodForm.emotion) {
      toast.error("Please choose an emotion before saving your mood entry.");
      return;
    }

    const todayString = selectedDate.toDateString();

    const existing = moodEntries.find(
      e => new Date(e.date).toDateString() === todayString
    );

    if (existing) {
      toast.error("Mood entry already exists for this day.");
      return;
    }

    const entry = {
      date: selectedDate.toISOString(),
      emotion: moodForm.emotion,
      rating: moodForm.rating,
      note: moodForm.note,
      tags: moodForm.tags.split(",").map((t) => t.trim()).filter(Boolean)
    };

    let moodRecord;

    try {
      const docRef = await addDoc(collection(db, "moodDiary"), entry);
      moodRecord = { id: docRef.id, ...entry };
    } catch (error) {
      console.error("Mood entry create failed:", error);
      if (!isFirestorePermissionError(error)) {
        toast.error("Could not save the mood entry right now.");
        return;
      }
      applyLocalFallbackNotice();
      moodRecord = { id: createLocalId("mood"), ...entry };
    }

    const nextMoodEntries = [...moodEntries, moodRecord];
    setMoodEntries(nextMoodEntries);
    writeLocalValue(localKey("mood_entries"), nextMoodEntries);

    setShowCreateMoodModal(false);
    setMoodForm({
      emotion: "",
      rating: 3,
      note: "",
      tags: ""
    });

  };

  const getMoodClass = ({ date, view }) => {

    if (view !== "month") return;

    const entry = moodEntries.find(
      e => new Date(e.date).toDateString() === date.toDateString()
    );

    if (!entry) return;

    switch (entry.emotion) {
      case "Happy":
        return "mood-happy";

      case "Sad":
        return "mood-sad";

      case "Stressed":
        return "mood-stressed";

      case "Angry":
        return "mood-angry";

      case "Neutral":
        return "mood-neutral";

      default:
        return "";
    }
  };

  const getMoodStyle = (emotion) => {
    const key = (emotion || "").toLowerCase();

    switch (key) {
      case "happy":
        return {
          dotClass: "bg-[#ffc83d]",
          badgeClass: "bg-[#fff3c6] text-[#8a5d00] border-[#ffd36d]",
          label: "Happy",
        };
      case "sad":
        return {
          dotClass: "bg-[#8b6b4a]",
          badgeClass: "bg-[#f2e5d6] text-[#6d5035] border-[#d9b998]",
          label: "Sad",
        };
      case "stressed":
        return {
          dotClass: "bg-[#ff9f43]",
          badgeClass: "bg-[#ffe8cf] text-[#9a5400] border-[#ffc98a]",
          label: "Stressed",
        };
      case "angry":
        return {
          dotClass: "bg-[#ff6257]",
          badgeClass: "bg-[#ffe1df] text-[#b8352c] border-[#ffb0aa]",
          label: "Angry",
        };
      default:
        return {
          dotClass: "bg-[#63a9ff]",
          badgeClass: "bg-[#e0f0ff] text-[#225d9f] border-[#9bcbff]",
          label: "Neutral",
        };
    }
  };

  const dailyGoalPct = Math.min(100, Math.round((dailyCompletedSeconds / (DAILY_GOAL_MINUTES * 60)) * 100));
  const listenedTrackCount = listenedTrackIds.length;
  const surveyUnlocked = listenedTrackCount >= SURVEY_UNLOCK_TRACKS;
  const completedGoalMinutes = Math.min(DAILY_GOAL_MINUTES, Math.floor(dailyCompletedSeconds / 60));
  const dailyMinutesLabel = `${completedGoalMinutes}/${DAILY_GOAL_MINUTES} mins completed`;
  const remainingGoalMinutes = Math.max(0, DAILY_GOAL_MINUTES - Math.floor(dailyCompletedSeconds / 60));

  return (
    <div className="harmony-theme min-h-screen bg-background text-foreground font-sans selection:bg-[#dff8ed]">

      <style>{`
        .harmony-theme {
          --background: 190 54% 96%;
          --foreground: 207 36% 20%;
          --card: 0 0% 100%;
          --card-foreground: 207 36% 20%;
          --popover: 0 0% 100%;
          --popover-foreground: 207 36% 20%;
          --primary: 171 76% 36%;
          --primary-foreground: 0 0% 100%;
          --secondary: 196 80% 93%;
          --secondary-foreground: 207 36% 20%;
          --muted: 190 50% 94%;
          --muted-foreground: 206 18% 42%;
          --accent: 51 92% 86%;
          --accent-foreground: 207 36% 20%;
          --border: 190 31% 82%;
          --input: 190 31% 82%;
          --ring: 171 76% 36%;
          background:
            radial-gradient(circle at 12% 10%, rgba(56, 163, 209, 0.18), transparent 30%),
            radial-gradient(circle at 88% 18%, rgba(31, 95, 153, 0.14), transparent 32%),
            linear-gradient(135deg, #f8fbfd 0%, #eef5f9 42%, #f7fafc 100%);
      }

      .harmony-theme .enchanted-panel {
        background:
          linear-gradient(135deg, rgba(255, 255, 255, 0.94), rgba(242, 248, 252, 0.92)),
          linear-gradient(225deg, rgba(31, 95, 153, 0.12), transparent 38%);
        border: 1px solid rgba(31, 95, 153, 0.22);
      }

      .harmony-theme .enchanted-button {
        background: transparent !important;
        color: #1f5f99 !important;
        border: 1px solid rgba(31, 95, 153, 0.6) !important;
      }

      .harmony-theme .alpine-gradient {
        background: linear-gradient(135deg, #0b2f55 0%, #1f5f99 54%, #38a3d1 100%);
      }

      .harmony-theme .harmony-player-gradient {
        background:
          radial-gradient(circle at 18% 18%, rgba(56, 163, 209, 0.32), transparent 28%),
          radial-gradient(circle at 82% 16%, rgba(231, 242, 255, 0.24), transparent 30%),
          linear-gradient(135deg, #081c30 0%, #0b2f55 48%, #1f5f99 100%);
      }

      .harmony-theme .alpine-text {
        color: #1f5f99;
      }

      .harmony-theme .harmony-sidebar-button {
        min-height: 52px;
        background: transparent !important;
        border: 1.5px solid #2394ff !important;
        color: #0f6f8f !important;
        border-radius: 14px !important;
        font-weight: 700;
      }

      .harmony-theme .harmony-sidebar-icon {
        background: #ffffff !important;
        border: 1px solid rgba(35, 148, 255, 0.34);
        color: #1f5f99 !important;
        border-radius: 12px !important;
      }

      .harmony-theme .harmony-sidebar-button:hover,
      .harmony-theme .harmony-sidebar-button:focus-visible {
        background: #143452 !important;
        border-color: #9fd3ff !important;
        color: #ffffff !important;
        box-shadow:
          0 0 0 1px rgba(159, 211, 255, 0.72),
          0 0 10px rgba(159, 211, 255, 0.34) !important;
      }

      .harmony-theme .harmony-filter-button,
      .harmony-theme .harmony-layer-button {
        background: transparent !important;
        border: 1.5px solid #2394ff !important;
        color: #0f6f8f !important;
        border-radius: 14px !important;
      }

      .harmony-theme .harmony-filter-button:hover,
      .harmony-theme .harmony-layer-button:hover,
      .harmony-theme .harmony-filter-button:focus-visible,
      .harmony-theme .harmony-layer-button:focus-visible {
        background: #143452 !important;
        border-color: #9fd3ff !important;
        color: #ffffff !important;
        box-shadow:
          0 0 0 1px rgba(159, 211, 255, 0.72),
          0 0 10px rgba(159, 211, 255, 0.34) !important;
      }

      .harmony-theme .harmony-play-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 9999px !important;
        border: 1.5px solid #2394ff !important;
        background: transparent !important;
        color: #2394ff !important;
        box-shadow: none !important;
      }

      .harmony-theme .harmony-play-button:hover,
      .harmony-theme .harmony-play-button:focus-visible {
        background: #143452 !important;
        border-color: #9fd3ff !important;
        color: #ffffff !important;
        box-shadow:
          0 0 0 1px rgba(159, 211, 255, 0.72),
          0 0 10px rgba(159, 211, 255, 0.34) !important;
      }

      .harmony-theme .harmony-player-gradient button:not(:hover):not(:focus-visible) {
        background: transparent !important;
        border-color: rgba(255, 255, 255, 0.72) !important;
        color: #ffffff !important;
      }

      .harmony-theme .harmony-player-gradient button:hover,
      .harmony-theme .harmony-player-gradient button:focus-visible {
        background: #143452 !important;
        border-color: #9fd3ff !important;
        color: #ffffff !important;
      }

      .harmony-theme .harmony-sidebar-button:hover .harmony-sidebar-icon,
      .harmony-theme .harmony-sidebar-button:focus-visible .harmony-sidebar-icon {
        background: #ffffff !important;
        border-color: #ffffff !important;
        color: #2b100b !important;
      }

      .logo {
        height: 6em;
        padding: 1.5em;
        will-change: filter;
        transition: filter 300ms;
      }

      .logo:hover {
        filter: drop-shadow(0 0 2em #646cffaa);
      }

      .logo.react:hover {
        filter: drop-shadow(0 0 2em #61dafbaa);
      }

      @keyframes logo-spin {
        from {
          transform: rotate(0deg);
        }
        to {
          transform: rotate(360deg);
        }
      }

      @media (prefers-reduced-motion: no-preference) {
        .logo.spin {
          animation: logo-spin infinite 20s linear;
        }
      }

      .card {
        padding: 2em;
      }

      .read-the-docs {
        color: #888;
      }

      .mood-happy {
        background: #ffc83d !important;
        color: #111827 !important;
        border-radius: 8px;
        font-weight: 700;
      }

      .mood-sad {
        background: #8b6b4a !important;
        color: #ffffff !important;
        border-radius: 8px;
        font-weight: 700;
      }

      .mood-stressed {
        background: #ff9f43 !important;
        color: #1f2937 !important;
        border-radius: 8px;
        font-weight: 700;
      }

      .mood-angry {
        background: #ff6257 !important;
        color: #ffffff !important;
        border-radius: 8px;
        font-weight: 700;
      }

      .mood-neutral {
        background: #63a9ff !important;
        color: #ffffff !important;
        border-radius: 8px;
        font-weight: 700;
      }

      .mood-calendar.react-calendar {
        width: 100%;
        max-width: 340px;
        border: 1px solid #b9dfdf;
        border-radius: 14px;
        background: #fbfffb;
        padding: 10px;
        font-family: inherit;
        box-shadow: 0 8px 24px rgba(15, 23, 42, 0.08);
      }

      .mood-calendar .react-calendar__navigation {
        display: grid;
        grid-template-columns: 32px 1fr 32px;
        gap: 8px;
        align-items: center;
        margin-bottom: 10px;
      }

      .mood-calendar .react-calendar__navigation button {
        min-width: 0;
        height: 32px;
        border-radius: 8px;
        border: 1px solid #b9dfdf;
        background: #ffffff;
        color: #2f3b44;
        font-weight: 600;
      }

      .mood-calendar .react-calendar__navigation button:hover {
        background: #e7f2ff;
      }

      .mood-calendar .react-calendar__navigation__prev2-button,
      .mood-calendar .react-calendar__navigation__next2-button {
        display: none;
      }

      .mood-calendar .react-calendar__month-view__weekdays {
        margin-bottom: 8px;
      }

      .mood-calendar .react-calendar__month-view__weekdays__weekday {
        text-align: center;
        padding: 6px 0;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: #6d7882;
      }

      .mood-calendar .react-calendar__month-view__weekdays__weekday abbr {
        text-decoration: none;
      }

      .mood-calendar .react-calendar__tile {
        height: 38px;
        border-radius: 8px;
        border: 1px solid transparent;
        font-size: 13px;
        font-weight: 600;
        color: #2f3b44;
        background: transparent;
      }

      .mood-calendar .react-calendar__tile:hover {
        background: #e7f2ff;
      }

      .mood-calendar .react-calendar__tile--active {
        background: #1f5f99 !important;
        color: #ffffff !important;
      }

      .mood-calendar .react-calendar__tile--now {
        border-color: #1f5f99;
        background: #e7f2ff;
      }
    `}</style>
      <div className="max-w-[1400px] mx-auto px-6 py-12 flex gap-12">

        {/* MAIN CONTENT */}
        <main className="w-[80%] space-y-20 pb-32">

          {/* HEADER */}
          <header id="explore" className="space-y-3 enchanted-panel rounded-lg px-6 py-5">
            <p className="text-sm alpine-text font-semibold">
              {hasDemoPremium ? "Premium access active" : `Credits left: ${credits}`}
            </p>
            <h1 className="text-4xl font-bold enchanted-text tracking-tight">Harmony Therapy</h1>
            <p className="text-lg text-muted-foreground max-w-2xl">
              Sound therapy for emotional balance, relaxation and focus.
              Precision-tuned frequencies designed for your wellbeing.
            </p>
          </header>

          {/* SEARCH & FILTERS */}
          <section className="space-y-6">
            <div className="relative max-w-xl">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" />
              <input
                type="text"
                placeholder="Search sounds (e.g. Meditation, Focus, Chakra)..."
                className="w-full pl-12 pr-4 py-3.5 bg-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-foreground placeholder:text-muted-foreground"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {filters.map(filter => (
                <button
                  key={filter}
                  onClick={() => setActiveFilter(filter)}
                  className={`harmony-filter-button px-5 py-2 text-sm font-medium transition-colors ${activeFilter === filter ? 'font-bold' : ''}`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </section>

          {/* SOUND LIBRARY */}
          <section>
            <SectionHeading title="Healing Sound Library" subtitle="Select a frequency to begin your session" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredFrequencies.map(sound => (
                <WellnessCard key={sound.id} className="group relative overflow-hidden enchanted-panel">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-[#5a4210] bg-[#f8e7ad] px-2 py-1 rounded">
                        {sound.value}
                      </span>
                      <h3 className="text-lg font-semibold mt-2 text-foreground">{sound.name}</h3>
                    </div>
                    <button
                      onClick={() => {

                        // 🚫 Check credits first
                        if (!hasDemoPremium && credits <= 0) {
                          setShowCreditPopup(true);
                          return;
                        }

                        // ✅ Deduct credit
                        if (!hasDemoPremium) {
                          setCredits(prev => prev - 1);
                        }

                        // ▶️ Play sound
                        loadedAudioSrcRef.current = "";
                        setCurrentPlaylist(null);
                        setPlaylistIndex(0);
                        setCurrentSound(sound);
                        markTrackListened(sound);
                        setIsPlaying(true);
                        setTimer(0);

                        setStats(prev => ({
                          ...prev,
                          sessions: prev.sessions + 1,
                          mostPlayed: sound.name
                        }));
                      }}
                      className="harmony-play-button h-12 w-12 transition-colors"
                    >
                      <Play className="w-5 h-5 fill-current" />
                    </button>
                  </div>
                  <p className="text-muted-foreground text-sm leading-relaxed">{sound.desc}</p>
                </WellnessCard>
              ))}
            </div>
          </section>

          {/* PLAYER */}
          <section id="player">
            <SectionHeading title="Meditation Player" />
            <div className="rounded-2xl harmony-player-gradient p-8 text-white border border-[#ffe66d]/70">
              <div className="flex flex-col md:flex-row gap-12 items-center">
                <div className="flex-1 text-center md:text-left">
                  <p className="mb-1 font-medium text-white/82">Now Playing</p>
                  <h3 className="text-3xl font-bold mb-2">{currentSound?.name || "Select a Sound"}</h3>
                  <div className="text-5xl font-mono tracking-tighter text-white">
                    {formatTime(timer)} <span className="text-lg text-white/68">/ 20:00</span>
                  </div>
                </div>

                <div className="flex flex-col items-center gap-6">
                  <div className="flex items-center gap-8">
                    <button
                      onClick={() => movePlayback(-1)}
                      disabled={!currentSound}
                      className="harmony-play-button h-12 w-12 transition-colors disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      <SkipBack />
                    </button>
                    <button
                      onClick={() => {
                        if (!currentSound) {
                          return;
                        }
                        setIsPlaying(!isPlaying);
                      }}
                      className="harmony-play-button h-16 w-16 transition-transform"
                    >
                      {isPlaying ? <Pause className="fill-current" /> : <Play className="fill-current ml-1" />}
                    </button>
                    <button
                      onClick={() => movePlayback(1)}
                      disabled={!currentSound}
                      className="harmony-play-button h-12 w-12 transition-colors disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      <SkipForward />
                    </button>
                  </div>

                  <div className="flex gap-4">
                    {([
                      { id: 'rain', icon: CloudRain, label: 'Rain' },
                      { id: 'wind', icon: Wind, label: 'Wind' },
                      { id: 'forest', icon: TreePine, label: 'Forest' },
                    ]).map(layer => (
                      <button
                        key={layer.id}
                        onClick={() => setLayers(prev => ({ ...prev, [layer.id]: !prev[layer.id] }))}
                        className={`harmony-layer-button flex items-center gap-2 px-3 py-1.5 text-xs font-medium transition-colors ${layers[layer.id] ? 'font-bold' : ''}`}
                      >
                        <layer.icon className="w-4 h-4" /> {layer.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {showMoodModal && (

            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">

              <div className="bg-card p-8 rounded-2xl w-[500px]">

                <h2 className="text-xl font-bold mb-4">
                  Mood on {selectedDate.toDateString()}
                </h2>

                {(() => {

                  const entry = moodEntries.find(
                    e => new Date(e.date).toDateString() === selectedDate.toDateString()
                  );

                  return entry ? (

                    <div className="space-y-2">

                      <p className="flex items-center gap-2">
                        <b>Emotion:</b>
                        <span className={`px-2.5 py-1 rounded-full border text-xs font-semibold ${getMoodStyle(entry.emotion).badgeClass}`}>
                          {getMoodStyle(entry.emotion).label}
                        </span>
                      </p>

                      <p><b>Rating:</b> {entry.rating}/5</p>

                      <p><b>Note:</b> {entry.note}</p>

                      <p><b>Tags:</b> {entry.tags.join(", ")}</p>

                    </div>

                  ) : (

                    <p className="text-muted-foreground">
                      No mood recorded for this day.
                    </p>

                  );

                })()}

                <button
                  onClick={() => setShowMoodModal(false)}
                  className="mt-4 px-4 py-2 bg-primary text-white rounded"
                >
                  Close
                </button>

              </div>

            </div>

          )}

          {/* PLAYLISTS */}
          <section id="playlists">
            <div className="flex justify-between items-end mb-8">

              <SectionHeading
                title="Playlists"
                subtitle="Your curated therapy collections"
              />

              <button
                onClick={() => setShowPlaylistModal(true)}
                  className="mb-8 inline-flex items-center gap-2 rounded-lg bg-[#e7f2ff] px-4 py-2 text-sm font-semibold text-[#1f5f99] shadow-sm"
              >
                <Plus className="w-4 h-4" /> Create New
              </button>

            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {playlists.length === 0 ? (
                <div className="col-span-full rounded-2xl border border-border bg-card px-5 py-8 text-center text-sm text-muted-foreground">
                  No playlists yet. Create one to keep your favorite healing sounds together.
                </div>
              ) : null}

              {playlists.map(pl => (
                <WellnessCard
                  key={pl.id}
                  className="flex h-full flex-col hover:shadow-lg transition-shadow"
                >

                  <div className="w-10 h-10 bg-secondary rounded-lg flex items-center justify-center mb-4">
                    <Music className="w-5 h-5 text-muted-foreground" />
                  </div>

                  <h4 className="font-bold text-foreground">{pl.name}</h4>

                  <p className="text-xs text-muted-foreground mt-1">
                    {pl.count || 0} sounds / {pl.duration || "0m"}
                  </p>

                  <div className="mt-3 space-y-1">
                    {(pl.sounds || []).slice(0, 4).map((sound) => (
                      <p key={`${pl.id}-${sound.id}`} className="text-xs text-muted-foreground truncate">
                        - {sound.name}
                      </p>
                    ))}
                    {(pl.sounds || []).length > 4 ? (
                      <p className="text-xs text-muted-foreground">+ {(pl.sounds || []).length - 4} more</p>
                    ) : null}
                  </div>

                  <button
                    onClick={() => startPlaylist(pl)}
                    className="mt-4 inline-flex h-10 flex-1 items-center justify-center rounded-lg bg-[#1f5f99] px-3 py-2 text-xs font-semibold text-white hover:bg-[#0b2f55]"
                  >
                    Play Playlist
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();

                      if (window.confirm("Delete this playlist?")) {
                        deletePlaylist(pl.id);
                      }

                    }}
                    className="danger-button mt-4 inline-flex h-10 items-center justify-center self-start rounded-xl px-3 py-2 text-xs font-semibold"
                  >
                    Delete
                  </button>

                </WellnessCard>
              ))}


            </div>
          </section>

          {showCreateMoodModal && (

            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">

              <div className="bg-card p-8 rounded-2xl w-[600px] space-y-6">

                <h2 className="text-2xl font-bold">
                  Create Mood Entry
                </h2>

                {/* Emotion */}

                <select
                  value={moodForm.emotion}
                  onChange={(e) =>
                    setMoodForm(prev => ({
                      ...prev,
                      emotion: e.target.value
                    }))
                  }
                  className={`w-full p-3 border rounded-lg ${moodForm.emotion ? getMoodStyle(moodForm.emotion).badgeClass : "border-border bg-background text-foreground"}`}
                >

                  <option value="">Select Emotion</option>
                  <option>Happy</option>
                  <option>Sad</option>
                  <option>Stressed</option>
                  <option>Angry</option>
                  <option>Neutral</option>

                </select>

                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {["Happy", "Sad", "Stressed", "Angry", "Neutral"].map((emotion) => (
                    <span key={emotion} className="flex items-center gap-1">
                      <span className={`inline-block w-2.5 h-2.5 rounded-full ${getMoodStyle(emotion).dotClass}`} />
                      {emotion}
                    </span>
                  ))}
                </div>

                {/* Rating */}

                <div>

                  <p className="mb-2">Rate your mood</p>

                  <div className="flex gap-3">

                    {[1, 2, 3, 4, 5].map(num => (

                      <button
                        key={num}
                        onClick={() =>
                          setMoodForm(prev => ({
                            ...prev,
                            rating: num
                          }))
                        }
                        className={`w-10 h-10 rounded-lg border
${moodForm.rating === num ? "bg-primary text-white" : ""}
`}
                      >
                        {num}
                      </button>

                    ))}

                  </div>

                </div>

                {/* Note */}

                <textarea
                  placeholder="Write how you feel..."
                  value={moodForm.note}
                  onChange={(e) =>
                    setMoodForm(prev => ({
                      ...prev,
                      note: e.target.value
                    }))
                  }
                  className="w-full p-3 border rounded"
                />

                {/* Tags */}

                <input
                  type="text"
                  placeholder="tags separated by comma (family, stress, exam)"
                  value={moodForm.tags}
                  onChange={(e) =>
                    setMoodForm(prev => ({
                      ...prev,
                      tags: e.target.value
                    }))
                  }
                  className="w-full p-3 border rounded"
                />

                <div className="flex justify-end gap-4">

                  <button
                    onClick={() => setShowCreateMoodModal(false)}
                    className="px-4 py-2 border rounded"
                  >
                    Cancel
                  </button>

                  <button
                    onClick={createMoodEntry}
                    className="px-6 py-2 bg-primary text-white rounded"
                  >
                    Save
                  </button>

                </div>

              </div>

            </div>

          )}

          {/* MOOD DIARY */}
          <section id="mood-diary">

            <SectionHeading
              title="Mood Diary"
              subtitle="Track your emotional journey"
            />

            <div className="grid md:grid-cols-2 gap-8">

              {/* Calendar */}

              <WellnessCard className="flex justify-center">

                <div className="w-[320px]">

                  <Calendar
                    onChange={(date) => {
                      setSelectedDate(date);
                      setShowMoodModal(true);
                    }}
                    value={selectedDate}
                    tileClassName={getMoodClass}
                    className="mood-calendar"
                    formatShortWeekday={(locale, date) =>
                      date.toLocaleDateString(locale, { weekday: "short" }).slice(0, 3)
                    }
                    next2Label={null}
                    prev2Label={null}
                  />

                </div>

              </WellnessCard>

              {/* Create Button */}

              <WellnessCard className="flex flex-col justify-center items-center text-center">

                <p className="text-muted-foreground mb-4">
                  Log today's emotional state
                </p>

                <button
                  onClick={() => setShowCreateMoodModal(true)}
                    className="rounded-xl border border-[#1f5f99] bg-primary px-6 py-3 text-primary-foreground"
                >
                  + Create Mood Diary
                </button>

              </WellnessCard>

            </div>

          </section>

          {/* REMINDERS */}
          <section id="reminders">
            <SectionHeading title="Meditation Reminders" />
            <button
              onClick={() => setShowReminderModal(true)}
              className="mb-6 rounded-xl border border-[#1f5f99] bg-primary px-4 py-2 text-primary-foreground"
            >
              + Add Reminder
            </button>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {reminders.length === 0 ? (
                <div className="col-span-full rounded-2xl border border-border bg-card px-5 py-8 text-center text-sm text-muted-foreground">
                  No reminders yet. Add one to get a gentle nudge for your next session.
                </div>
              ) : null}
              {reminders.map(rem => (
                <WellnessCard key={rem.id} className="flex justify-between items-center">

                  {/* LEFT SIDE */}
                  <div>
                    <h4 className="font-bold text-foreground">{rem.title}</h4>

                    <p className="mt-1 text-2xl font-mono text-[#1f5f99]">
                      {rem.time}
                    </p>

                    <div className="flex gap-1 mt-3">
                      {REMINDER_DAY_OPTIONS.map((day) => (
                        <span
                          key={day.id}
                          className={`min-w-[28px] h-7 rounded-full px-2 flex items-center justify-center text-[10px] font-bold ${reminderHasDay(rem.days, day.id)
                            ? "bg-primary text-primary-foreground"
                            : "bg-secondary text-muted-foreground"
                            }`}
                        >
                          {day.label}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* RIGHT SIDE */}
                  <div className="flex flex-col items-end gap-3">

                    {/* TOGGLE */}
                    <label className="relative inline-flex items-center cursor-pointer">

                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={rem.enabled}
                        onChange={() => toggleReminder(rem.id)}
                      />

                      <div className="w-11 h-6 bg-secondary rounded-full
        peer-checked:after:translate-x-full
        peer-checked:bg-primary
        after:content-['']
        after:absolute
        after:top-[2px]
        after:left-[2px]
        after:bg-card
        after:border
        after:rounded-full
        after:h-5
        after:w-5
        after:transition-all">
                      </div>

                    </label>

                    {/* DELETE BUTTON BELOW TOGGLE */}
                    <button
                      onClick={() => deleteReminder(rem.id)}
                      className="danger-button text-xs px-3 py-1 rounded-lg"
                    >
                      Delete
                    </button>

                  </div>

                </WellnessCard>
              ))}
            </div>
          </section>

          {/* SURVEY */}
          <section className="bg-accent rounded-3xl p-10 border border-[#ddd2c7]">
            <SectionHeading title="Therapy Progress Survey" subtitle="Help us evaluate your emotional wellbeing" />
            {!surveyUnlocked ? (
              <div className="bg-card p-6 rounded-2xl border border-border">
                <p className="text-sm text-muted-foreground">
                  Listen to at least {SURVEY_UNLOCK_TRACKS} tracks in Healing Sound Library to unlock this survey.
                </p>
                <p className="mt-2 text-xs font-semibold text-[#1f5f99]">
                  Progress: {listenedTrackCount}/{SURVEY_UNLOCK_TRACKS} tracks listened
                </p>
              </div>
            ) : !surveyResult ? (
              <div className="space-y-8">
                {surveyQuestions.map((q, idx) => (
                  <div key={idx} className="space-y-3">
                    <p className="text-foreground font-medium">{idx + 1}. {q}</p>
                    <div className="flex gap-4">
                      {[1, 2, 3, 4, 5].map(num => (
                        <button
                          key={num}
                          onClick={() => setSurveyScores(prev => ({ ...prev, [idx]: num }))}
                          className={`w-12 h-12 rounded-xl border-2 transition-colors font-bold ${surveyScores[idx] === num
                            ? 'bg-primary border-primary text-primary-foreground'
                            : 'bg-card border-border text-muted-foreground'
                            }`}
                        >
                          {num}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                <div className="pt-6">
                  <button
                    onClick={handleSurveySubmit}
                    className="px-8 py-4 bg-primary text-primary-foreground rounded-xl font-bold transition-colors border border-[#1f5f99]"
                  >
                    Submit Survey
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 space-y-6">
                <div className="w-20 h-20 bg-accent text-accent-foreground rounded-full flex items-center justify-center mx-auto">
                  <Activity className="w-10 h-10" />
                </div>
                <h3 className="text-2xl font-bold text-foreground">Analysis Complete</h3>
                <p className="text-lg text-muted-foreground max-w-md mx-auto">
                  {surveyResult >= 3
                    ? "Your responses suggest that music therapy is helping improve your wellbeing."
                    : "Your responses suggest that music therapy may not be helping enough."}
                </p>
                {surveyResult < 3 && (
                  <div className="bg-card p-6 rounded-2xl border border-[#ddd2c7] max-w-md mx-auto">
                    <p className="text-sm text-muted-foreground mb-4">
                      It may be helpful to consult a qualified emotional well-being professional for additional support.
                    </p>
                    <a
                      href="/care-connect"
                      className="inline-flex items-center gap-2 px-6 py-3 bg-foreground text-background rounded-xl font-bold transition-colors"
                    >
                      Consult a Doctor
                    </a>
                  </div>
                )}
                <button
                  onClick={() => { setSurveyResult(null); setSurveyScores({}); }}
                    className="font-semibold text-[#1f5f99]"
                >
                  Retake Survey
                </button>
              </div>
            )}
          </section>

          {/* STATISTICS */}
          <section id="statistics">
            <SectionHeading title="Listening Statistics" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <WellnessCard className="flex items-center gap-4">
                <div className="rounded-lg bg-[#e7f2ff] p-3 text-[#1f5f99]"><Brain className="w-6 h-6" /></div>
                <div>
                  <p className="text-xs font-bold text-muted-foreground uppercase">Most Played</p>
                  <p className="text-lg font-bold text-foreground">{stats.mostPlayed || "None yet"}</p>
                </div>
              </WellnessCard>
              <WellnessCard className="flex items-center gap-4">
                <div className="p-3 bg-accent text-accent-foreground rounded-xl"><Activity className="w-6 h-6" /></div>
                <div>
                  <p className="text-xs font-bold text-muted-foreground uppercase">Total Hours</p>
                  <p className="text-lg font-bold text-foreground">{Math.floor(stats.totalSeconds / 3600)} Hours</p>
                </div>
              </WellnessCard>
              <WellnessCard className="flex items-center gap-4">
                <div className="rounded-lg bg-[#e7f2ff] p-3 text-[#1f5f99]"><BarChart2 className="w-6 h-6" /></div>
                <div>
                  <p className="text-xs font-bold text-muted-foreground uppercase">Sessions</p>
                  <p className="text-lg font-bold text-foreground">{stats.sessions} Total</p>
                </div>
              </WellnessCard>
            </div>
          </section>
        </main>

        {/* STICKY NAV */}
        <aside className="w-[20%]">
          <nav className="sticky top-8 space-y-1">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-4 mb-4">Menu</p>
            {navItems.map(item => (
              <button
                key={item.id}
                onClick={() => scrollToSection(item.id)}
                className="harmony-sidebar-button flex w-full items-center justify-start gap-3 px-4 py-3 text-sm font-medium transition-colors"
              >
                <span className="harmony-sidebar-icon inline-flex h-9 w-9 items-center justify-center">
                  <item.icon className="w-4 h-4" />
                </span>
                <span>{item.label}</span>
              </button>
            ))}

            <div className="mt-12 rounded-2xl harmony-player-gradient p-5 text-white border border-[#ffe66d]/70">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white/16">
                    <Heart className="h-5 w-5 text-[#ffe66d]" />
                  </div>
                  <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.18em] text-[#fff3a3]">Daily Goal</p>
                  <p className="mt-1 text-3xl font-bold leading-none text-white">{dailyGoalPct}%</p>
                  <p className="mt-2 text-sm font-semibold text-white">{dailyMinutesLabel}</p>
                  <p className="mt-1 text-xs font-medium text-white/90">
                    {remainingGoalMinutes > 0 ? `${remainingGoalMinutes} mins remaining` : "Goal reached for today"}
                  </p>
                </div>

                <div className="relative h-28 w-12 overflow-hidden rounded-full border border-white/18 bg-white/14 p-1">
                  <div
                    className="absolute bottom-1 left-1 right-1 rounded-full bg-[#ffe66d] transition-all duration-500"
                    style={{ height: `calc(${Math.max(dailyGoalPct, 8)}% - 4px)` }}
                  ></div>
                  <div className="absolute inset-x-2 top-3 h-1.5 rounded-full bg-white/22"></div>
                  <div className="absolute inset-x-2 top-7 h-1.5 rounded-full bg-white/14"></div>
                  <div className="absolute inset-x-2 top-11 h-1.5 rounded-full bg-white/10"></div>
                </div>
              </div>

              <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-white/16">
                <div
                  className="h-full rounded-full bg-[#ffe66d] transition-all duration-500"
                  style={{ width: `${dailyGoalPct}%` }}
                ></div>
              </div>

              <div className="mt-2 flex justify-between text-[10px] font-semibold uppercase tracking-[0.14em] text-white/90">
                <span>0 min</span>
                <span>{DAILY_GOAL_MINUTES} min goal</span>
              </div>
            </div>
          </nav>
        </aside>
      </div>
      {
        showReminderModal && (

          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">

            <div className="bg-card p-8 rounded-2xl w-[500px] space-y-6">

              <h2 className="text-2xl font-bold">Create Reminder</h2>

              <input
                type="text"
                placeholder="Reminder Title"
                value={newReminder.title}
                onChange={(e) => setNewReminder(prev => ({ ...prev, title: e.target.value }))}
                className="w-full p-3 border rounded"
              />

              <input
                type="time"
                value={newReminder.time}
                onChange={(e) => setNewReminder(prev => ({ ...prev, time: e.target.value }))}
                className="w-full p-3 border rounded"
              />
              <div className="flex gap-2 mt-2">

                {REMINDER_DAY_OPTIONS.map((day) => (

                  <button
                    key={day.id}
                    onClick={() => {

                      setNewReminder(prev => {

                        const exists = prev.days.includes(day.id)

                        return {
                          ...prev,
                          days: exists
                            ? prev.days.filter(d => d !== day.id)
                            : [...prev.days, day.id]
                        }

                      })

                    }}

                    className={`w-8 h-8 rounded-full text-xs font-bold
${newReminder.days.includes(day.id)
                        ? "bg-primary text-white"
                        : "bg-gray-200"
                      }`}
                  >

                    {day.label}

                  </button>

                ))}

              </div>

              <div className="flex justify-end gap-4">

                <button
                  onClick={() => setShowReminderModal(false)}
                  className="px-4 py-2 border rounded"
                >
                  Cancel
                </button>

                <button
                  onClick={createReminder}
                  disabled={isCreatingReminder}
                  className="px-6 py-2 bg-primary text-white rounded disabled:opacity-50"
                >
                  {isCreatingReminder ? "Creating..." : "Create"}
                </button>

              </div>

            </div>

          </div>

        )
      }
      {
        showPlaylistModal && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">

            <div className="bg-card border border-border w-[600px] rounded-2xl p-8 shadow-2xl max-h-[80vh] overflow-y-auto">

              <h2 className="text-2xl font-bold mb-6">
                Create Playlist
              </h2>

              {/* Playlist Name */}
              <input
                type="text"
                placeholder="Playlist Name"
                value={playlistName}
                onChange={(e) => setPlaylistName(e.target.value)}
                className="w-full mb-6 px-4 py-3 border border-border rounded-xl bg-background"
              />

              {/* Song List */}
              <div className="grid grid-cols-2 gap-3">

                {frequencies.map(sound => {

                  const selected = selectedSounds.find(s => s.id === sound.id);

                  return (
                    <button
                      key={sound.id}
                      onClick={() => toggleSound(sound)}
                      className={`p-4 rounded-xl border text-left transition
              ${selected
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-card border-border hover:border-primary/40"}
              `}
                    >

                      <p className="font-semibold">{sound.name}</p>
                      <p className="text-xs opacity-70">{sound.value}</p>

                    </button>
                  );

                })}

              </div>

              {/* Buttons */}
              <div className="flex justify-end gap-4 mt-6">

                <button
                  onClick={() => setShowPlaylistModal(false)}
                  className="px-4 py-2 rounded-lg border border-border"
                >
                  Cancel
                </button>

                <button
                  onClick={createPlaylist}
                  disabled={isCreatingPlaylist}
                  className="px-6 py-2 bg-primary text-primary-foreground rounded-lg disabled:opacity-50"
                >
                  {isCreatingPlaylist ? "Creating..." : "Create"}
                </button>

              </div>

            </div>

          </div>
        )
      }
      {showCreditPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.24)]">
            <div className="bg-[#fffaf5] px-8 pb-6 pt-8 text-center">
              <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-full bg-rose-100 text-rose-500">
                <span className="text-2xl font-bold">!</span>
              </div>
              <h2 className="text-3xl font-bold tracking-tight text-slate-900">
                No Credits Left
              </h2>
              <p className="mt-3 text-base leading-7 text-slate-600">
                You have used all 5 free credits. Upgrade your membership to continue listening and unlock the full Harmony Therapy experience.
              </p>
            </div>

            <div className="border-t border-slate-100 bg-white px-8 py-6">
              <div className="mb-5 rounded-2xl border border-[#bfd3e2] bg-[#e7f2ff] px-4 py-3 text-sm text-[#1f5f99]">
                Premium access gives you unlimited listening, playlists, and full therapy support tools.
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  className="flex-1 rounded-2xl border border-[#bfd3e2] px-4 py-3 text-sm font-semibold text-[#425466] transition hover:bg-[#e7f2ff]"
                  onClick={handleClose}
                >
                  Maybe Later
                </button>

                <button
                  className="flex-1 rounded-lg bg-[#1f5f99] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#0b2f55]"
                  onClick={() => navigate("/subscription")}
                >
                  View Plans
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div >
  );
};

export default HarmonyTherapy;
