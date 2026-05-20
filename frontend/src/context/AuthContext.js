import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from "firebase/auth";
import { auth, db } from "../firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";

const DEFAULT_ADMIN_EMAILS = ["admin@emowellbeing.test"];
const TEST_ADMIN_EMAIL = "admin@emowellbeing.test";
const TEST_ADMIN_PASSWORD = "Admin@12345";
const LOCAL_ADMIN_KEY = "melomind_local_admin";
const LOCAL_PROFILE_PREFIX = "melomind_profile_";

const ADMIN_EMAILS = Array.from(
  new Set([
    ...DEFAULT_ADMIN_EMAILS,
    ...(process.env.REACT_APP_ADMIN_EMAILS || "")
      .split(",")
      .map((v) => v.trim().toLowerCase())
      .filter(Boolean),
  ])
);

const AuthContext = createContext(null);

const decodeJwtPayload = (token) => {
  const base64Url = token.split(".")[1];
  const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
  const json = decodeURIComponent(
    atob(base64)
      .split("")
      .map((c) => `%${`00${c.charCodeAt(0).toString(16)}`.slice(-2)}`)
      .join("")
  );
  return JSON.parse(json);
};

const normalizeUser = (authUser) => {
  if (!authUser) return null;
  return {
    uid: authUser.uid,
    email: authUser.email || "",
    displayName: authUser.displayName || authUser.email || "User",
    photoURL: authUser.photoURL || "",
    provider: "firebase",
  };
};

const readLocalGoogleUser = () => {
  try {
    const raw = localStorage.getItem("melomind_google_user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const readLocalAdminUser = () => {
  try {
    const raw = localStorage.getItem(LOCAL_ADMIN_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const buildFallbackProfile = (userLike) => {
  const inferredRole = ADMIN_EMAILS.includes((userLike?.email || "").toLowerCase())
    ? "admin"
    : "user";

  return {
    uid: userLike?.uid || "",
    email: userLike?.email || "",
    displayName: userLike?.displayName || userLike?.email || "User",
    role: inferredRole,
    psychologistStatus: "none",
    updatedAt: new Date().toISOString(),
  };
};

const saveLocalProfile = (profileData) => {
  if (!profileData?.uid) return;
  try {
    localStorage.setItem(`${LOCAL_PROFILE_PREFIX}${profileData.uid}`, JSON.stringify(profileData));
  } catch {
    // Ignore local storage issues and keep auth flow moving.
  }
};

const readLocalProfile = (uid) => {
  if (!uid) return null;
  try {
    const raw = localStorage.getItem(`${LOCAL_PROFILE_PREFIX}${uid}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const isFirestorePermissionError = (err) =>
  err?.code === "permission-denied" ||
  err?.code === "firestore/permission-denied" ||
  /missing or insufficient permissions/i.test(err?.message || "");

const upsertUserProfile = async (userLike) => {
  if (!userLike?.uid) return null;
  const ref = doc(db, "users", userLike.uid);
  const inferredRole = ADMIN_EMAILS.includes((userLike.email || "").toLowerCase())
    ? "admin"
    : "user";

  try {
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      const created = {
        uid: userLike.uid,
        email: userLike.email || "",
        displayName: userLike.displayName || userLike.email || "User",
        role: inferredRole,
        psychologistStatus: "none",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await setDoc(ref, created, { merge: true });
      saveLocalProfile(created);
      return created;
    }

    const data = snap.data();
    const patched = {
      ...data,
      email: userLike.email || data.email || "",
      displayName: userLike.displayName || data.displayName || "User",
      role:
        ADMIN_EMAILS.includes((userLike.email || "").toLowerCase()) && data.role !== "admin"
          ? "admin"
          : data.role || inferredRole,
      updatedAt: new Date().toISOString(),
    };

    await setDoc(ref, patched, { merge: true });
    saveLocalProfile(patched);
    return patched;
  } catch (err) {
    if (!isFirestorePermissionError(err)) {
      throw err;
    }

    console.warn("Profile access was restricted. Using local fallback profile.", err);
    const fallbackProfile = readLocalProfile(userLike.uid) || buildFallbackProfile(userLike);
    saveLocalProfile(fallbackProfile);
    return fallbackProfile;
  }
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        const resolved = normalizeUser(firebaseUser) || readLocalGoogleUser() || readLocalAdminUser();
        setUser(resolved);

        if (!resolved) {
          setProfile(null);
          setLoading(false);
          return;
        }

        if (resolved.provider === "local-admin") {
          setProfile({
            uid: resolved.uid,
            email: resolved.email,
            displayName: resolved.displayName || "Admin",
            role: "admin",
            psychologistStatus: "none",
            updatedAt: new Date().toISOString(),
          });
          setLoading(false);
          return;
        }

        const profileData = await upsertUserProfile(resolved);
        setProfile(profileData);
      } catch (err) {
        console.error("Auth initialization failed:", err);
      } finally {
        setLoading(false);
      }
    });

    return () => unsub();
  }, []);

  const signupWithEmail = async ({ email, password, displayName }) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    if (displayName?.trim()) {
      await updateProfile(cred.user, { displayName: displayName.trim() });
    }
    const normalized = normalizeUser({ ...cred.user, displayName: displayName || cred.user.displayName });
    const profileData = await upsertUserProfile(normalized);
    setUser(normalized);
    setProfile(profileData);
    return normalized;
  };

  const loginWithEmail = async ({ email, password }) => {
    const normalizedEmail = (email || "").trim().toLowerCase();
    if (normalizedEmail === TEST_ADMIN_EMAIL && password === TEST_ADMIN_PASSWORD) {
      const localAdmin = {
        uid: "local-admin",
        email: TEST_ADMIN_EMAIL,
        displayName: "Admin",
        photoURL: "",
        provider: "local-admin",
      };
      localStorage.setItem(LOCAL_ADMIN_KEY, JSON.stringify(localAdmin));
      setUser(localAdmin);
      setProfile({
        uid: localAdmin.uid,
        email: localAdmin.email,
        displayName: localAdmin.displayName,
        role: "admin",
        psychologistStatus: "none",
        updatedAt: new Date().toISOString(),
      });
      return localAdmin;
    }

    const cred = await signInWithEmailAndPassword(auth, email, password);
    const normalized = normalizeUser(cred.user);
    const profileData = await upsertUserProfile(normalized);
    setUser(normalized);
    setProfile(profileData);
    return normalized;
  };

  const loginWithGoogleCredential = async (credential) => {
    const payload = decodeJwtPayload(credential);
    const googleUser = {
      uid: payload.sub,
      email: payload.email,
      displayName: payload.name || payload.email || "Google User",
      photoURL: payload.picture || "",
      provider: "google-oauth",
    };

    localStorage.setItem("melomind_google_user", JSON.stringify(googleUser));
    const profileData = await upsertUserProfile(googleUser);
    setUser(googleUser);
    setProfile(profileData);
    return googleUser;
  };

  const logout = async () => {
    if (auth.currentUser) {
      await signOut(auth);
    }
    localStorage.removeItem("melomind_google_user");
    localStorage.removeItem(LOCAL_ADMIN_KEY);
    setUser(null);
    setProfile(null);
  };

  const value = useMemo(
    () => ({
      user,
      profile,
      loading,
      isAuthenticated: Boolean(user),
      role: profile?.role || "user",
      signupWithEmail,
      loginWithEmail,
      loginWithGoogleCredential,
      logout,
      refreshProfile: async () => {
        if (!user?.uid) return;
        const ref = doc(db, "users", user.uid);
        try {
          const snap = await getDoc(ref);
          if (snap.exists()) {
            const nextProfile = snap.data();
            setProfile(nextProfile);
            saveLocalProfile(nextProfile);
          }
        } catch (err) {
          if (!isFirestorePermissionError(err)) throw err;
          const localProfile = readLocalProfile(user.uid);
          if (localProfile) setProfile(localProfile);
        }
      },
    }),
    [user, profile, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
