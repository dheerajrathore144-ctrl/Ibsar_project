import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";

const initialForm = {
  fullName: "",
  specialization: "",
  licenseNumber: "",
  licenseAuthority: "",
  highestDegree: "",
  experienceYears: "",
  feePerSession: "",
  languages: "",
  consultationModes: "Video, Voice",
  clinicName: "",
  city: "",
  bio: "",
  termsAccepted: false,
};

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

export default function PsychologistPortal() {
  const { user, profile, refreshProfile } = useAuth();
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [permissionNotice, setPermissionNotice] = useState("");

  useEffect(() => {
    const loadExisting = async () => {
      if (!user?.uid) return;
      try {
        const snap = await getDoc(doc(db, "psychologist_applications", user.uid));
        if (!snap.exists()) return;
        const data = snap.data();
        saveLocalApplication(user.uid, data);
        setForm((prev) => ({
          ...prev,
          ...data,
          termsAccepted: Boolean(data.termsAccepted),
        }));
        setSubmitted(true);
      } catch (err) {
        if (!isFirestorePermissionError(err)) {
          console.error("Psychologist portal load failed:", err);
          return;
        }

        const localData = readLocalApplication(user.uid);
        if (localData) {
          setForm((prev) => ({
            ...prev,
            ...localData,
            termsAccepted: Boolean(localData.termsAccepted),
          }));
          setSubmitted(true);
        }
        setPermissionNotice("You can continue filling the form. Your progress is saved on this device.");
      }
    };
    loadExisting();
  }, [user?.uid]);

  const status = profile?.psychologistStatus || "none";
  const isApproved = status === "approved";
  const isPending = status === "pending";

  const handleSubmit = async () => {
    if (!user?.uid) return;

    if (
      !form.fullName ||
      !form.specialization ||
      !form.licenseNumber ||
      !form.licenseAuthority ||
      !form.highestDegree ||
      !form.bio
    ) {
      alert("Please fill all required professional fields.");
      return;
    }

    if (!form.termsAccepted) {
      alert("Please confirm the professional declaration before submission.");
      return;
    }

    setLoading(true);
    try {
      const application = {
        ...form,
        uid: user.uid,
        email: user.email || "",
        status: "pending",
        submittedAt: new Date().toISOString(),
        portalVersion: "v2",
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
      alert("Application submitted. Admin will review your profile.");
    } catch (err) {
      if (!isFirestorePermissionError(err)) {
        console.error("Psychologist portal submit failed:", err);
        alert("Could not submit application.");
      } else {
        setSubmitted(true);
        setPermissionNotice("Your application has been saved on this device.");
        alert("Application saved.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8fbfc_0%,#eef9f5_55%,#ffffff_100%)] px-4 py-10 text-[#253342]">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 rounded-2xl border border-[#dbe7ec] bg-gradient-to-r from-[#ffffff] via-[#f4fbfb] to-[#eefaf6] p-6 shadow-[0_20px_50px_rgba(15,23,42,0.08)]">
          <p className="text-xs uppercase tracking-[0.25em] text-[#00a4bd]">MeloMind Professionals</p>
          <h1 className="mt-2 text-3xl font-bold">Psychologist Partner Portal</h1>
          <p className="mt-2 max-w-3xl text-sm text-[#516f90]">
            This is a dedicated onboarding page for psychologists and therapists. Approved applications are listed automatically in CareConnect.
          </p>
        </div>

        <div className="rounded-2xl border border-[#dbe7ec] bg-white p-6 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
          {permissionNotice ? (
            <div className="mb-5 rounded-lg border border-[#f4dfb1] bg-[#fff8eb] px-4 py-3 text-sm text-[#8a6612]">
              {permissionNotice}
            </div>
          ) : null}

          <div className="mb-5 rounded-lg border border-[#dbe7ec] bg-[#f6fafb] px-4 py-3 text-sm">
            Application status:{" "}
            <span className="font-semibold capitalize text-[#00a58f]">
              {isApproved ? "approved" : isPending ? "pending review" : "not submitted"}
            </span>
          </div>

          {isApproved ? (
            <div className="rounded-lg border border-[#cfe7df] bg-[#eefaf6] p-4 text-sm text-[#215f57]">
              Your profile is approved and visible in CareConnect.
              <Link to="/psychologist-dashboard" className="ml-2 font-semibold underline">
                Open Psychologist Dashboard
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Input label="Full Name *" value={form.fullName} onChange={(v) => patch(setForm, "fullName", v)} />
              <Input label="Specialization *" value={form.specialization} onChange={(v) => patch(setForm, "specialization", v)} />
              <Input label="License Number *" value={form.licenseNumber} onChange={(v) => patch(setForm, "licenseNumber", v)} />
              <Input label="License Authority *" value={form.licenseAuthority} onChange={(v) => patch(setForm, "licenseAuthority", v)} />
              <Input label="Highest Degree *" value={form.highestDegree} onChange={(v) => patch(setForm, "highestDegree", v)} />
              <Input label="Experience (Years)" value={form.experienceYears} onChange={(v) => patch(setForm, "experienceYears", v)} />
              <Input label="Fee Per Session (USD)" value={form.feePerSession} onChange={(v) => patch(setForm, "feePerSession", v)} />
              <Input label="Languages" value={form.languages} onChange={(v) => patch(setForm, "languages", v)} />
              <Input label="Consultation Modes" value={form.consultationModes} onChange={(v) => patch(setForm, "consultationModes", v)} />
              <Input label="Clinic / Practice Name" value={form.clinicName} onChange={(v) => patch(setForm, "clinicName", v)} />
              <Input label="City" value={form.city} onChange={(v) => patch(setForm, "city", v)} />

              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium text-[#33475b]">Professional Bio * </label>
                <textarea
                  className="w-full rounded-lg border border-[#dbe7ec] bg-[#fbfeff] px-3 py-2 text-sm text-[#253342] outline-none focus:border-[#00a4bd]"
                  rows={4}
                  value={form.bio}
                  onChange={(e) => patch(setForm, "bio", e.target.value)}
                />
              </div>

              <label className="md:col-span-2 flex items-start gap-2 rounded-lg border border-[#dbe7ec] bg-[#fbfeff] px-3 py-3 text-sm text-[#516f90]">
                <input
                  type="checkbox"
                  checked={form.termsAccepted}
                  onChange={(e) => patch(setForm, "termsAccepted", e.target.checked)}
                  className="mt-0.5"
                />
                I confirm that all professional details and licensing information provided are accurate and can be verified.
              </label>

              <div className="md:col-span-2 flex items-center gap-3">
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="rounded-lg bg-[#253342] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1d2c39] disabled:opacity-60"
                >
                  {loading ? "Submitting..." : submitted ? "Update Application" : "Submit Application"}
                </button>
                <span className="text-xs text-[#6b7f90]">After approval, your card is listed in CareConnect automatically.</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function patch(setter, key, value) {
  setter((prev) => ({ ...prev, [key]: value }));
}

function Input({ label, value, onChange }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-[#33475b]">{label}</label>
      <input
        className="w-full rounded-lg border border-[#dbe7ec] bg-[#fbfeff] px-3 py-2 text-sm text-[#253342] outline-none focus:border-[#00a4bd]"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
