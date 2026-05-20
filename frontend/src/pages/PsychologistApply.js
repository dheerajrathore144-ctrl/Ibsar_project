import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";

const LOCAL_APP_PREFIX = "melomind_psychologist_application_";

const isFirestorePermissionError = (err) =>
  err?.code === "permission-denied" ||
  err?.code === "firestore/permission-denied" ||
  /missing or insufficient permissions/i.test(err?.message || "");

const saveLocalApplication = (uid, data) => {
  if (!uid) return;
  try {
    localStorage.setItem(`${LOCAL_APP_PREFIX}${uid}`, JSON.stringify(data));
  } catch {
    // Ignore local storage issues.
  }
};

const readLocalApplication = (uid) => {
  if (!uid) return null;
  try {
    const raw = localStorage.getItem(`${LOCAL_APP_PREFIX}${uid}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export default function PsychologistApply() {
  const { user, profile, refreshProfile } = useAuth();
  const [form, setForm] = useState({
    fullName: "",
    specialization: "",
    licenseNumber: "",
    experienceYears: "",
    feePerSession: "",
    bio: "",
    languages: "",
  });
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [permissionNotice, setPermissionNotice] = useState("");

  useEffect(() => {
    const loadExisting = async () => {
      if (!user?.uid) return;
      try {
        const snap = await getDoc(doc(db, "psychologist_applications", user.uid));
        if (snap.exists()) {
          const data = snap.data();
          saveLocalApplication(user.uid, data);
          setForm((prev) => ({ ...prev, ...data }));
          setSubmitted(true);
        }
      } catch (err) {
        if (!isFirestorePermissionError(err)) {
          console.error("Psychologist apply load failed:", err);
          return;
        }

        const localData = readLocalApplication(user.uid);
        if (localData) {
          setForm((prev) => ({ ...prev, ...localData }));
          setSubmitted(true);
        }
        setPermissionNotice("Cloud profile access is restricted right now. You can still fill the form locally.");
      }
    };
    loadExisting();
  }, [user?.uid]);

  const status = profile?.psychologistStatus || "none";
  const isApproved = status === "approved";
  const isPending = status === "pending";

  const handleSubmit = async () => {
    if (!user?.uid) return;
    if (!form.fullName || !form.specialization || !form.licenseNumber) {
      alert("Please fill required fields: name, specialization, license.");
      return;
    }

    setLoading(true);
    try {
      const application = {
        ...form,
        uid: user.uid,
        email: user.email || "",
        submittedAt: new Date().toISOString(),
        status: "pending",
      };

      saveLocalApplication(user.uid, application);

      await setDoc(doc(db, "psychologist_applications", user.uid), application, { merge: true });
      await setDoc(
        doc(db, "users", user.uid),
        { psychologistStatus: "pending", updatedAt: new Date().toISOString() },
        { merge: true }
      );
      await refreshProfile();
      setSubmitted(true);
      setPermissionNotice("");
      alert("Application submitted successfully.");
    } catch (err) {
      if (!isFirestorePermissionError(err)) {
        console.error("Application submit failed:", err);
        alert("Could not submit application.");
      } else {
        setSubmitted(true);
        setPermissionNotice("Cloud submission is blocked by Firestore permissions. Your application has been saved locally for now.");
        alert("Application saved locally. Firestore permissions need to be updated before cloud submission works.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background px-6 py-10">
      <div className="mx-auto max-w-3xl rounded-2xl border border-border bg-card p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-foreground">Psychologist Onboarding</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Complete this form to appear in CareConnect after admin approval.
        </p>

        {permissionNotice ? (
          <div className="mt-4 rounded-lg border border-[#f4dfb1] bg-[#fff8eb] px-4 py-3 text-sm text-[#8a6612]">
            {permissionNotice}
          </div>
        ) : null}

        <div className="mt-4 rounded-lg border border-border bg-muted px-4 py-3 text-sm">
          Current status:{" "}
          <span className="font-semibold capitalize">
            {isApproved ? "approved" : isPending ? "pending review" : "not submitted"}
          </span>
        </div>

        {isApproved ? (
          <div className="mt-4 rounded-lg border border-[#cfe7df] bg-[#eefaf6] p-4 text-sm text-[#215f57]">
            <p>Your profile is approved and visible in CareConnect.</p>
            <Link to="/psychologist-dashboard" className="mt-2 inline-block font-semibold underline">
              Open Psychologist Dashboard
            </Link>
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input label="Full Name *" value={form.fullName} onChange={(v) => setForm((p) => ({ ...p, fullName: v }))} />
            <Input label="Specialization *" value={form.specialization} onChange={(v) => setForm((p) => ({ ...p, specialization: v }))} />
            <Input label="License Number *" value={form.licenseNumber} onChange={(v) => setForm((p) => ({ ...p, licenseNumber: v }))} />
            <Input label="Experience (Years)" value={form.experienceYears} onChange={(v) => setForm((p) => ({ ...p, experienceYears: v }))} />
            <Input label="Fee Per Session" value={form.feePerSession} onChange={(v) => setForm((p) => ({ ...p, feePerSession: v }))} />
            <Input label="Languages" value={form.languages} onChange={(v) => setForm((p) => ({ ...p, languages: v }))} />

            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-foreground">Professional Bio</label>
              <textarea
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                rows={4}
                value={form.bio}
                onChange={(e) => setForm((p) => ({ ...p, bio: e.target.value }))}
              />
            </div>

            <div className="md:col-span-2">
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                {loading ? "Submitting..." : submitted ? "Update Application" : "Submit Application"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Input({ label, value, onChange }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-foreground">{label}</label>
      <input
        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
