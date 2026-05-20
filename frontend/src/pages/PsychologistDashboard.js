import React, { useEffect, useMemo, useState } from "react";
import { collection, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { format } from "date-fns";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const LOCAL_AVAILABILITY_PREFIX = "melomind_psychologist_availability_";
const LOCAL_BOOKING_PREFIX = "melomind_careconnect_booking_";

const isFirestorePermissionError = (err) =>
  err?.code === "permission-denied" ||
  err?.code === "firestore/permission-denied" ||
  /missing or insufficient permissions/i.test(err?.message || "");

const saveLocalAvailability = (uid, data) => {
  if (!uid) return;
  try {
    localStorage.setItem(`${LOCAL_AVAILABILITY_PREFIX}${uid}`, JSON.stringify(data));
  } catch {
    // Ignore local storage issues.
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
      if (parsed?.psychologistUid === uid) {
        results.push(parsed);
      }
    }
    return results.sort((a, b) => {
      const at = new Date(a.createdAt || 0).getTime() || 0;
      const bt = new Date(b.createdAt || 0).getTime() || 0;
      return bt - at;
    });
  } catch {
    return [];
  }
};

const saveLocalBooking = (booking) => {
  if (!booking?.id) return;
  try {
    localStorage.setItem(`${LOCAL_BOOKING_PREFIX}${booking.id}`, JSON.stringify(booking));
  } catch {
    // Ignore local storage failures.
  }
};

const parseTimeLabel = (timeValue) => {
  const match = String(timeValue || "").match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;

  const [, hourRaw, minuteRaw, meridiemRaw] = match;
  let hours = Number(hourRaw);
  const minutes = Number(minuteRaw);
  const meridiem = meridiemRaw.toUpperCase();

  if (meridiem === "PM" && hours !== 12) hours += 12;
  if (meridiem === "AM" && hours === 12) hours = 0;

  return { hours, minutes };
};

const buildMeetingTimestamp = (dateValue, timeValue) => {
  const parsedTime = parseTimeLabel(timeValue);
  if (!dateValue || !parsedTime) return null;

  const nextDate = new Date(dateValue);
  nextDate.setHours(parsedTime.hours, parsedTime.minutes, 0, 0);
  return nextDate.getTime();
};

const getBookingBaseDate = (booking) => {
  if (typeof booking?.sessionStartsAt === "number") {
    const nextDate = new Date(booking.sessionStartsAt);
    if (!Number.isNaN(nextDate.getTime())) return nextDate;
  }

  if (!booking?.date) return null;

  const normalizedDate = String(booking.date).replace(/(\d+)(st|nd|rd|th)/gi, "$1");
  const parsedDate = new Date(normalizedDate);
  if (Number.isNaN(parsedDate.getTime())) return null;
  return parsedDate;
};

const getNextAvailableMeeting = (booking, availability) => {
  const availableDays = availability?.days || [];
  const availableSlots = availability?.slots || [];
  const currentBaseDate = getBookingBaseDate(booking);

  if (!currentBaseDate || availableDays.length === 0 || availableSlots.length === 0) {
    return null;
  }

  const nextTime = availableSlots.includes(booking.time) ? booking.time : availableSlots[0];

  for (let dayOffset = 1; dayOffset <= 35; dayOffset += 1) {
    const candidateDate = new Date(currentBaseDate);
    candidateDate.setDate(candidateDate.getDate() + dayOffset);
    const weekday = DAYS[(candidateDate.getDay() + 6) % 7];

    if (!availableDays.includes(weekday)) continue;

    return {
      date: format(candidateDate, "PPP"),
      time: nextTime,
      sessionStartsAt: buildMeetingTimestamp(candidateDate, nextTime),
      movedToDay: weekday,
    };
  }

  return null;
};

export default function PsychologistDashboard() {
  const { user } = useAuth();
  const [availability, setAvailability] = useState({
    days: ["Mon", "Tue", "Wed", "Thu", "Fri"],
    slots: ["9:00 AM", "10:00 AM", "11:00 AM", "2:00 PM", "3:00 PM"],
  });
  const [bookings, setBookings] = useState([]);
  const [saving, setSaving] = useState(false);
  const [permissionNotice, setPermissionNotice] = useState("");

  const pendingCount = useMemo(
    () => bookings.filter((b) => b.status === "requested").length,
    [bookings]
  );

  const loadData = async () => {
    if (!user?.uid) return;

    try {
      const [availabilitySnap, bookingsSnap] = await Promise.all([
        getDoc(doc(db, "psychologist_availability", user.uid)),
        getDocs(query(collection(db, "careconnect_bookings"), where("psychologistUid", "==", user.uid))),
      ]);

      if (availabilitySnap.exists()) {
        const nextAvailability = { ...availability, ...availabilitySnap.data() };
        setAvailability(nextAvailability);
        saveLocalAvailability(user.uid, nextAvailability);
      }

      setBookings(
        bookingsSnap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => {
          const at = a.createdAt?.seconds || 0;
          const bt = b.createdAt?.seconds || 0;
          return bt - at;
        })
      );
      setPermissionNotice("");
    } catch (err) {
      if (!isFirestorePermissionError(err)) {
        console.error("Psychologist dashboard fetch failed:", err);
        return;
      }

      const localAvailability = readLocalAvailability(user.uid);
      if (localAvailability) {
        setAvailability((prev) => ({ ...prev, ...localAvailability }));
      }
      const localBookings = readLocalBookings(user.uid);
      setBookings(localBookings);
      setPermissionNotice(
        localBookings.length > 0
          ? "Showing your saved meetings and availability on this device."
          : "Showing your saved availability on this device."
      );
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  const toggleDay = (day) => {
    setAvailability((prev) => ({
      ...prev,
      days: prev.days.includes(day) ? prev.days.filter((d) => d !== day) : [...prev.days, day],
    }));
  };

  const saveAvailability = async () => {
    if (!user?.uid) return;
    setSaving(true);
    try {
      saveLocalAvailability(user.uid, {
        uid: user.uid,
        email: user.email || "",
        ...availability,
        updatedAt: new Date().toISOString(),
      });
      await setDoc(
        doc(db, "psychologist_availability", user.uid),
        {
          uid: user.uid,
          email: user.email || "",
          ...availability,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
      setPermissionNotice("");
      alert("Availability saved.");
    } catch (err) {
      if (!isFirestorePermissionError(err)) {
        console.error("Availability save failed:", err);
        alert("Could not save availability.");
      } else {
        setPermissionNotice("Availability was saved on this device.");
        alert("Availability saved.");
      }
    } finally {
      setSaving(false);
    }
  };

  const updateBookingStatus = async (booking, status, extraFields = {}) => {
    try {
      await updateDoc(doc(db, "careconnect_bookings", booking.id), {
        status,
        reviewedAt: new Date().toISOString(),
        ...extraFields,
      });
      await loadData();
    } catch (err) {
      if (!isFirestorePermissionError(err)) {
        console.error("Booking status update failed:", err);
        alert("Could not update meeting.");
      } else {
        const updatedBooking = {
          ...booking,
          status,
          reviewedAt: new Date().toISOString(),
          ...extraFields,
        };
        saveLocalBooking(updatedBooking);
        setBookings((prev) =>
          prev.map((item) => (item.id === booking.id ? updatedBooking : item))
        );
        setPermissionNotice("Meeting update was saved on this device.");
        alert("Meeting updated.");
      }
    }
  };

  const rescheduleBooking = async (booking) => {
    const nextMeeting = getNextAvailableMeeting(booking, availability);

    if (!nextMeeting) {
      alert("No future availability was found. Please update your weekly availability first.");
      return;
    }

    await updateBookingStatus(booking, "rescheduled", {
      date: nextMeeting.date,
      time: nextMeeting.time,
      sessionStartsAt: nextMeeting.sessionStartsAt,
      movedToDay: nextMeeting.movedToDay,
      rescheduledAt: new Date().toISOString(),
    });

    alert(`Meeting moved to ${nextMeeting.date} at ${nextMeeting.time}.`);
  };

  return (
    <div className="min-h-screen bg-background px-6 py-10">
      <div className="mx-auto max-w-6xl space-y-6">
        {permissionNotice ? (
          <div className="rounded-lg border border-[#f4dfb1] bg-[#fff8eb] px-4 py-3 text-sm text-[#8a6612]">
            {permissionNotice}
          </div>
        ) : null}

        <div>
          <h1 className="text-3xl font-bold text-foreground">Psychologist Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage your availability and meeting requests.</p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card label="Total Meetings" value={bookings.length} />
          <Card label="Pending Requests" value={pendingCount} />
          <Card label="Confirmed" value={bookings.filter((b) => b.status === "confirmed").length} />
        </div>

        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="text-lg font-semibold text-foreground">Weekly Availability</h2>
          <p className="mt-1 text-sm text-muted-foreground">Select available days and customize time slots.</p>

          <div className="mt-4 flex flex-wrap gap-2">
            {DAYS.map((day) => {
              const selected = availability.days.includes(day);
              return (
                <button
                  key={day}
                  onClick={() => toggleDay(day)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                    selected ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>

          <div className="mt-4">
            <label className="mb-1 block text-sm font-medium text-foreground">Time Slots (comma separated)</label>
            <input
              value={(availability.slots || []).join(", ")}
              onChange={(e) =>
                setAvailability((prev) => ({
                  ...prev,
                  slots: e.target.value
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                }))
              }
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              placeholder="9:00 AM, 10:00 AM, 11:00 AM"
            />
          </div>

          <button
            onClick={saveAvailability}
            disabled={saving}
            className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Availability"}
          </button>
        </section>

        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="text-lg font-semibold text-foreground">Meeting Requests</h2>
          <p className="mt-1 text-sm text-muted-foreground">Confirm incoming meetings or move them to the next available slot when needed.</p>

          <div className="mt-4 space-y-3">
            {bookings.length === 0 ? (
              <p className="text-sm text-muted-foreground">No meetings yet.</p>
            ) : (
              bookings.map((booking) => (
                <div key={booking.id} className="rounded-xl border border-border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-foreground">{booking.userName || booking.userEmail || "User"}</p>
                    <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium capitalize">
                      {booking.status || "requested"}
                    </span>
                  </div>

                  <p className="mt-1 text-sm text-muted-foreground">
                    {booking.date} • {booking.time} • {booking.type}
                  </p>
                  <p className="text-xs text-muted-foreground">Contact: {booking.userEmail}</p>
                  {booking.status === "rescheduled" && booking.movedToDay ? (
                    <p className="mt-1 text-xs font-medium text-primary">
                      Rescheduled to the next available {booking.movedToDay} slot.
                    </p>
                  ) : null}
                  {booking.meetLink ? (
                    <a href={booking.meetLink} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs text-primary underline">
                      Open meeting link
                    </a>
                  ) : null}

                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => updateBookingStatus(booking, "confirmed")}
                      className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
                    >
                      Confirm Meeting
                    </button>
                    <button
                      onClick={() => rescheduleBooking(booking)}
                      className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold"
                    >
                      Reschedule Meeting
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function Card({ label, value }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-3xl font-bold text-foreground">{value}</p>
    </div>
  );
}
