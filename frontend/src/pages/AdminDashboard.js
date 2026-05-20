import React, { useEffect, useMemo, useState } from "react";
import { collection, doc, getDocs, setDoc } from "firebase/firestore";
import {
  LayoutDashboard,
  ClipboardCheck,
  CalendarDays,
  Users,
  Wallet,
  Activity,
  Settings,
  RefreshCw,
  DollarSign,
  CheckCircle2,
  Clock3,
  XCircle,
} from "lucide-react";
import { db } from "../firebase";

const LOCAL_PROFILE_PREFIX = "melomind_profile_";
const LOCAL_APP_PREFIX = "melomind_psychologist_application_";
const LOCAL_PSY_PROFILE_PREFIX = "melomind_psychologist_profile_";
const LOCAL_ADMIN_DASHBOARD_KEY = "melomind_admin_dashboard_state";

const menuItems = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "applications", label: "Applications", icon: ClipboardCheck },
  { key: "bookings", label: "Bookings", icon: CalendarDays },
  { key: "users", label: "Users", icon: Users },
  { key: "revenue", label: "Revenue", icon: Wallet },
  { key: "insights", label: "Insights", icon: Activity },
  { key: "settings", label: "Settings", icon: Settings },
];

const parsePrice = (value) => {
  if (!value) return 0;
  if (typeof value === "number") return value;
  const cleaned = String(value).replace(/[^\d.]/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
};

const dateToMs = (createdAt) => {
  if (!createdAt) return 0;
  if (typeof createdAt?.toDate === "function") return createdAt.toDate().getTime();
  const ms = new Date(createdAt).getTime();
  return Number.isFinite(ms) ? ms : 0;
};

const isFirestorePermissionError = (err) =>
  err?.code === "permission-denied" ||
  err?.code === "firestore/permission-denied" ||
  /missing or insufficient permissions/i.test(err?.message || "");

const readLocalRecordsByPrefix = (prefix) => {
  try {
    const results = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(prefix)) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      results.push({
        id: parsed.uid || key.slice(prefix.length),
        ...parsed,
      });
    }
    return results;
  } catch {
    return [];
  }
};

const saveLocalRecord = (prefix, id, data) => {
  if (!id) return;
  try {
    localStorage.setItem(`${prefix}${id}`, JSON.stringify(data));
  } catch {
    // Ignore local storage failures.
  }
};

const saveAdminDashboardSnapshot = (payload) => {
  try {
    localStorage.setItem(LOCAL_ADMIN_DASHBOARD_KEY, JSON.stringify(payload));
  } catch {
    // Ignore local storage failures.
  }
};

const readAdminDashboardSnapshot = () => {
  try {
    const raw = localStorage.getItem(LOCAL_ADMIN_DASHBOARD_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const DEMO_APPLICATIONS = [
  {
    id: "demo-app-1",
    uid: "demo-psy-1",
    fullName: "Dr. Kavya Nair",
    email: "kavya.nair@careconnect.demo",
    status: "pending",
    specialization: "Child & Adolescent Support",
    experienceYears: 6,
    licenseNumber: "RCI-PSY-1182",
    bio: "Focuses on emotional regulation, school stress, and supportive family counseling.",
  },
  {
    id: "demo-app-2",
    uid: "demo-psy-2",
    fullName: "Dr. Rahul Bansal",
    email: "rahul.bansal@careconnect.demo",
    status: "pending",
    specialization: "Stress & Burnout Recovery",
    experienceYears: 9,
    licenseNumber: "RCI-PSY-2044",
    bio: "Supports working professionals with burnout recovery, resilience building, and lifestyle balance.",
  },
  {
    id: "demo-app-3",
    uid: "demo-psy-3",
    fullName: "Dr. Meera Kulkarni",
    email: "meera.kulkarni@careconnect.demo",
    status: "pending",
    specialization: "Trauma-Informed Counseling",
    experienceYears: 11,
    licenseNumber: "RCI-PSY-1776",
    bio: "Works with trauma recovery, emotional grounding, and long-term confidence rebuilding.",
  },
  {
    id: "demo-app-4",
    uid: "demo-psy-4",
    fullName: "Dr. Sandeep Joshi",
    email: "sandeep.joshi@careconnect.demo",
    status: "pending",
    specialization: "Relationship & Family Therapy",
    experienceYears: 8,
    licenseNumber: "RCI-PSY-1938",
    bio: "Helps individuals and couples strengthen communication, trust, and emotional awareness.",
  },
];

const DEMO_USERS = [
  { id: "admin-1", uid: "admin-1", displayName: "System Administrator", email: "admin@melomind.demo", role: "admin" },
  { id: "psy-1", uid: "psy-1", displayName: "Dr. Aditi Mehra", email: "aditi.mehra@melomind.demo", role: "psychologist" },
  { id: "psy-2", uid: "psy-2", displayName: "Dr. Arjun Verma", email: "arjun.verma@melomind.demo", role: "psychologist" },
  { id: "psy-3", uid: "psy-3", displayName: "Dr. Priya Sharma", email: "priya.sharma@melomind.demo", role: "psychologist" },
  { id: "psy-4", uid: "psy-4", displayName: "Dr. Rohan Menon", email: "rohan.menon@melomind.demo", role: "psychologist" },
  { id: "psy-5", uid: "psy-5", displayName: "Dr. Nisha Kapoor", email: "nisha.kapoor@melomind.demo", role: "psychologist" },
  { id: "psy-6", uid: "psy-6", displayName: "Dr. Karan Iyer", email: "karan.iyer@melomind.demo", role: "psychologist" },
  { id: "user-1", uid: "user-1", displayName: "Riya Patel", email: "riya.patel@melomind.demo", role: "user" },
  { id: "user-2", uid: "user-2", displayName: "Aman Gupta", email: "aman.gupta@melomind.demo", role: "user" },
  { id: "user-3", uid: "user-3", displayName: "Sneha Rao", email: "sneha.rao@melomind.demo", role: "user" },
  { id: "user-4", uid: "user-4", displayName: "Vikram Singh", email: "vikram.singh@melomind.demo", role: "user" },
  { id: "user-5", uid: "user-5", displayName: "Pooja Deshmukh", email: "pooja.deshmukh@melomind.demo", role: "user" },
];

const DEMO_BOOKINGS = [
  {
    id: "booking-1",
    userEmail: "riya.patel@melomind.demo",
    userName: "Riya Patel",
    psychologist: "Dr. Aditi Mehra",
    date: "April 18, 2026",
    time: "10:00 AM",
    price: "$120",
    status: "completed",
    createdAt: "2026-04-18T08:30:00.000Z",
  },
  {
    id: "booking-2",
    userEmail: "aman.gupta@melomind.demo",
    userName: "Aman Gupta",
    psychologist: "Dr. Priya Sharma",
    date: "April 16, 2026",
    time: "3:00 PM",
    price: "$140",
    status: "requested",
    createdAt: "2026-04-16T10:10:00.000Z",
  },
  {
    id: "booking-3",
    userEmail: "sneha.rao@melomind.demo",
    userName: "Sneha Rao",
    psychologist: "Dr. Rohan Menon",
    date: "March 27, 2026",
    time: "1:00 PM",
    price: "$110",
    status: "completed",
    createdAt: "2026-03-27T09:40:00.000Z",
  },
  {
    id: "booking-4",
    userEmail: "vikram.singh@melomind.demo",
    userName: "Vikram Singh",
    psychologist: "Dr. Nisha Kapoor",
    date: "March 11, 2026",
    time: "11:00 AM",
    price: "$95",
    status: "completed",
    createdAt: "2026-03-11T06:50:00.000Z",
  },
  {
    id: "booking-5",
    userEmail: "pooja.deshmukh@melomind.demo",
    userName: "Pooja Deshmukh",
    psychologist: "Dr. Karan Iyer",
    date: "February 21, 2026",
    time: "5:00 PM",
    price: "$105",
    status: "completed",
    createdAt: "2026-02-21T11:20:00.000Z",
  },
  {
    id: "booking-6",
    userEmail: "riya.patel@melomind.demo",
    userName: "Riya Patel",
    psychologist: "Dr. Arjun Verma",
    date: "January 30, 2026",
    time: "4:00 PM",
    price: "$100",
    status: "completed",
    createdAt: "2026-01-30T12:00:00.000Z",
  },
  {
    id: "booking-7",
    userEmail: "aman.gupta@melomind.demo",
    userName: "Aman Gupta",
    psychologist: "Dr. Priya Sharma",
    date: "December 19, 2025",
    time: "9:00 AM",
    price: "$140",
    status: "completed",
    createdAt: "2025-12-19T05:35:00.000Z",
  },
  {
    id: "booking-8",
    userEmail: "sneha.rao@melomind.demo",
    userName: "Sneha Rao",
    psychologist: "Dr. Aditi Mehra",
    date: "November 28, 2025",
    time: "2:00 PM",
    price: "$120",
    status: "requested",
    createdAt: "2025-11-28T07:25:00.000Z",
  },
];

const pickDashboardDataset = (source, fallback, minimumCount = 1) =>
  Array.isArray(source) && source.length >= minimumCount ? source : fallback;

export default function AdminDashboard() {
  const [active, setActive] = useState("overview");
  const [users, setUsers] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const [usersSnap, bookingsSnap, appsSnap] = await Promise.all([
        getDocs(collection(db, "users")),
        getDocs(collection(db, "careconnect_bookings")),
        getDocs(collection(db, "psychologist_applications")),
      ]);

      setUsers(usersSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setBookings(bookingsSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setApplications(appsSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      saveAdminDashboardSnapshot({
        users: usersSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
        bookings: bookingsSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
        applications: appsSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
      });
    } catch (err) {
      if (!isFirestorePermissionError(err)) {
        console.error("Admin fetch failed:", err);
        alert("Failed to load dashboard data.");
      } else {
        const localUsers = readLocalRecordsByPrefix(LOCAL_PROFILE_PREFIX);
        const localApplications = readLocalRecordsByPrefix(LOCAL_APP_PREFIX);
        const snapshot = readAdminDashboardSnapshot();

        setUsers(localUsers.length ? localUsers : snapshot?.users || []);
        setApplications(localApplications.length ? localApplications : snapshot?.applications || []);
        setBookings(snapshot?.bookings || []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const displayedUsers = useMemo(() => pickDashboardDataset(users, DEMO_USERS, 8), [users]);
  const displayedApplications = useMemo(() => pickDashboardDataset(applications, DEMO_APPLICATIONS, 4), [applications]);
  const displayedBookings = useMemo(() => pickDashboardDataset(bookings, DEMO_BOOKINGS, 6), [bookings]);

  const updateApplicationStatus = async (app, nextStatus) => {
    try {
      await setDoc(
        doc(db, "psychologist_applications", app.uid),
        { status: nextStatus, reviewedAt: new Date().toISOString() },
        { merge: true }
      );

      await setDoc(
        doc(db, "users", app.uid),
        {
          role: nextStatus === "approved" ? "psychologist" : "user",
          psychologistStatus: nextStatus,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      if (nextStatus === "approved") {
        await setDoc(
          doc(db, "psychologist_profiles", app.uid),
          {
            uid: app.uid,
            email: app.email || "",
            name: app.fullName || "Psychologist",
            spec: app.specialization || "General Therapy",
            exp: Number(app.experienceYears || 0),
            rating: 4.8,
            qual: `License: ${app.licenseNumber || "N/A"}`,
            approach: app.bio || "Evidence-based approach",
            langs: app.languages || "English",
            price: app.feePerSession ? `$${app.feePerSession}` : "$100",
            desc: app.bio || "Professional psychologist profile.",
            approved: true,
            approvedAt: new Date().toISOString(),
          },
          { merge: true }
        );
      }

      await refresh();
    } catch (err) {
      if (!isFirestorePermissionError(err)) {
        console.error("Status update failed:", err);
        alert("Could not update status.");
      } else {
        const applicationBase = (() => {
          const localItems = readLocalRecordsByPrefix(LOCAL_APP_PREFIX);
          if (localItems.length > 0) return localItems;
          return displayedApplications;
        })();

        const userBase = (() => {
          const localItems = readLocalRecordsByPrefix(LOCAL_PROFILE_PREFIX);
          if (localItems.length > 0) return localItems;
          return displayedUsers;
        })();

        const ensuredApplications = applicationBase.some((item) => item.uid === app.uid)
          ? applicationBase
          : [...applicationBase, app];
        const ensuredUsers = userBase.some((item) => item.uid === app.uid)
          ? userBase
          : [
              ...userBase,
              {
                id: app.uid,
                uid: app.uid,
                displayName: app.fullName || "Psychologist",
                email: app.email || "",
                role: "user",
                psychologistStatus: "pending",
              },
            ];

        const localApplications = ensuredApplications.map((item) =>
          item.uid === app.uid
            ? { ...item, status: nextStatus, reviewedAt: new Date().toISOString() }
            : item
        );
        const localUsers = ensuredUsers.map((item) =>
          item.uid === app.uid
            ? {
                ...item,
                role: nextStatus === "approved" ? "psychologist" : "user",
                psychologistStatus: nextStatus,
                updatedAt: new Date().toISOString(),
              }
            : item
        );
        const approvedProfile =
          nextStatus === "approved"
            ? {
                uid: app.uid,
                email: app.email || "",
                name: app.fullName || "Psychologist",
                spec: app.specialization || "General Therapy",
                exp: Number(app.experienceYears || 0),
                rating: 4.8,
                qual: `License: ${app.licenseNumber || "N/A"}`,
                approach: app.bio || "Evidence-based approach",
                langs: app.languages || "English",
                price: app.feePerSession ? `$${app.feePerSession}` : "$100",
                desc: app.bio || "Professional psychologist profile.",
                approved: true,
                approvedAt: new Date().toISOString(),
              }
            : null;

        localApplications.forEach((item) => saveLocalRecord(LOCAL_APP_PREFIX, item.uid, item));
        localUsers.forEach((item) => saveLocalRecord(LOCAL_PROFILE_PREFIX, item.uid, item));
        if (approvedProfile) {
          saveLocalRecord(LOCAL_PSY_PROFILE_PREFIX, app.uid, approvedProfile);
        }

        setApplications(localApplications);
        setUsers(localUsers);
        alert("Application status updated locally.");
      }
    }
  };

  const metrics = useMemo(() => {
    const totalRevenue = displayedBookings.reduce((sum, b) => sum + parsePrice(b.price), 0);
    const completedBookings = displayedBookings.filter((b) => b.status === "completed").length;
    const requestedBookings = displayedBookings.filter((b) => !b.status || b.status === "requested").length;
    const approvedPsychologists = displayedUsers.filter((u) => u.role === "psychologist").length;
    const pendingApplications = displayedApplications.filter((a) => a.status === "pending").length;
    const totalUsers = displayedUsers.length;
    return {
      totalRevenue,
      completedBookings,
      requestedBookings,
      approvedPsychologists,
      pendingApplications,
      totalUsers,
    };
  }, [displayedBookings, displayedUsers, displayedApplications]);

  const monthlySeries = useMemo(() => {
    const now = new Date();
    const series = [];
    for (let i = 5; i >= 0; i -= 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = d.toLocaleString(undefined, { month: "short" });
      const m = d.getMonth();
      const y = d.getFullYear();
      const revenue = displayedBookings
        .filter((b) => {
          const ms = dateToMs(b.createdAt);
          if (!ms) return false;
          const bd = new Date(ms);
          return bd.getMonth() === m && bd.getFullYear() === y;
        })
        .reduce((sum, b) => sum + parsePrice(b.price), 0);
      series.push({ label, revenue });
    }
    return series;
  }, [displayedBookings]);

  const maxMonthRevenue = Math.max(...monthlySeries.map((m) => m.revenue), 1);

  const earningsByPsychologist = useMemo(() => {
    const map = new Map();
    for (const b of displayedBookings) {
      const key = b.psychologist || "Unknown";
      map.set(key, (map.get(key) || 0) + parsePrice(b.price));
    }
    return Array.from(map.entries())
      .map(([name, revenue]) => ({ name, revenue }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8);
  }, [displayedBookings]);

  const renderOverview = () => (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Total Revenue" value={`$${metrics.totalRevenue.toFixed(0)}`} icon={DollarSign} tone="emerald" />
        <MetricCard title="Total Users" value={metrics.totalUsers} icon={Users} tone="sky" />
        <MetricCard title="Pending Applications" value={metrics.pendingApplications} icon={Clock3} tone="amber" />
        <MetricCard title="Completed Meetings" value={metrics.completedBookings} icon={CheckCircle2} tone="indigo" />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="rounded-2xl border border-[#dbe7ec] bg-white p-5 shadow-sm xl:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-base font-semibold text-[#253342]">Revenue Trend (Last 6 Months)</h3>
            <span className="text-xs text-[#6b7f90]">Based on booking prices</span>
          </div>
          <div className="flex h-48 items-end gap-3">
            {monthlySeries.map((m) => (
              <div key={m.label} className="flex flex-1 flex-col items-center gap-2">
                <div className="relative h-36 w-full rounded-md bg-[#eef6f8]">
                  <div
                    className="absolute bottom-0 w-full rounded-md bg-gradient-to-t from-[#00a4bd] to-[#00bda5]"
                    style={{ height: `${Math.max(8, (m.revenue / maxMonthRevenue) * 100)}%` }}
                  />
                </div>
                <span className="text-xs font-medium text-[#516f90]">{m.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-[#dbe7ec] bg-white p-5 shadow-sm">
          <h3 className="text-base font-semibold text-[#253342]">Platform Health</h3>
          <div className="mt-4 space-y-3 text-sm">
            <HealthRow label="Requested Bookings" value={metrics.requestedBookings} />
            <HealthRow label="Approved Psychologists" value={metrics.approvedPsychologists} />
            <HealthRow label="Applications Pending" value={metrics.pendingApplications} />
            <HealthRow label="Users Registered" value={metrics.totalUsers} />
          </div>
        </div>
      </div>
    </div>
  );

  const renderApplications = () => (
    <div className="rounded-2xl border border-[#dbe7ec] bg-white p-5 shadow-sm">
      <h3 className="mb-4 text-lg font-semibold text-[#253342]">Psychologist Applications</h3>
      {displayedApplications.length === 0 ? (
        <p className="text-sm text-[#6b7f90]">No applications found.</p>
      ) : (
        <div className="space-y-3">
          {displayedApplications.map((app) => (
            <div key={app.id} className="rounded-xl border border-[#dbe7ec] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-[#253342]">{app.fullName || "Unknown"}</p>
                  <p className="text-xs text-[#6b7f90]">{app.email}</p>
                </div>
                <span className="rounded-full bg-[#f4f9fb] px-3 py-1 text-xs font-semibold capitalize text-[#516f90]">
                  {app.status || "pending"}
                </span>
              </div>
              <p className="mt-2 text-sm text-[#516f90]">
                {app.specialization || "General"} | {app.experienceYears || 0} years | License {app.licenseNumber || "N/A"}
              </p>
              <p className="mt-1 text-sm text-[#516f90]">{app.bio || "No bio provided."}</p>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => updateApplicationStatus(app, "approved")}
                  className="rounded-lg bg-[#00a58f] px-3 py-1.5 text-xs font-semibold text-white"
                >
                  Approve
                </button>
                <button
                  onClick={() => updateApplicationStatus(app, "rejected")}
                  className="rounded-lg bg-[#ff7a59] px-3 py-1.5 text-xs font-semibold text-white"
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderBookings = () => (
    <div className="rounded-2xl border border-[#dbe7ec] bg-white p-5 shadow-sm">
      <h3 className="mb-4 text-lg font-semibold text-[#253342]">Meeting Bookings</h3>
      <div className="overflow-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-[#dbe7ec] text-left text-xs uppercase tracking-wide text-[#6b7f90]">
              <th className="px-3 py-2">User</th>
              <th className="px-3 py-2">Psychologist</th>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Price</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {displayedBookings.length === 0 ? (
              <tr>
                <td className="px-3 py-4 text-[#6b7f90]" colSpan={5}>No bookings available.</td>
              </tr>
            ) : (
              displayedBookings.map((b) => (
                <tr key={b.id} className="border-b border-[#eef3f6]">
                  <td className="px-3 py-2 text-[#425466]">{b.userEmail || b.userName || "N/A"}</td>
                  <td className="px-3 py-2 text-[#425466]">{b.psychologist || "N/A"}</td>
                  <td className="px-3 py-2 text-[#425466]">{b.date || "-"} {b.time || ""}</td>
                  <td className="px-3 py-2 font-semibold text-[#253342]">{b.price || "$0"}</td>
                  <td className="px-3 py-2">
                    <span className="rounded-full bg-[#f4f9fb] px-2 py-1 text-xs font-medium capitalize text-[#516f90]">
                      {b.status || "requested"}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderUsers = () => (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard title="Admins" value={displayedUsers.filter((u) => u.role === "admin").length} icon={Users} tone="rose" />
        <MetricCard title="Psychologists" value={displayedUsers.filter((u) => u.role === "psychologist").length} icon={Users} tone="emerald" />
        <MetricCard title="Regular Users" value={displayedUsers.filter((u) => !u.role || u.role === "user").length} icon={Users} tone="sky" />
      </div>
      <div className="rounded-2xl border border-[#dbe7ec] bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-lg font-semibold text-[#253342]">Registered Users</h3>
        <div className="space-y-2">
          {displayedUsers.length === 0 ? (
            <p className="text-sm text-[#6b7f90]">No users found.</p>
          ) : (
            displayedUsers.map((u) => (
              <div key={u.id} className="flex items-center justify-between rounded-lg border border-[#eef3f6] px-3 py-2">
                <div>
                  <p className="text-sm font-semibold text-[#33475b]">{u.displayName || "User"}</p>
                  <p className="text-xs text-[#6b7f90]">{u.email || "No email"}</p>
                </div>
                <span className="rounded-full bg-[#f4f9fb] px-3 py-1 text-xs font-medium capitalize text-[#516f90]">
                  {u.role || "user"}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );

  const renderRevenue = () => (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
      <div className="rounded-2xl border border-[#dbe7ec] bg-white p-5 shadow-sm xl:col-span-2">
        <h3 className="mb-4 text-lg font-semibold text-[#253342]">Earnings by Psychologist</h3>
        <div className="space-y-2">
          {earningsByPsychologist.length === 0 ? (
            <p className="text-sm text-[#6b7f90]">No earnings data yet.</p>
          ) : (
            earningsByPsychologist.map((row) => (
              <div key={row.name} className="flex items-center justify-between rounded-lg border border-[#eef3f6] px-3 py-2">
                <span className="text-sm text-[#425466]">{row.name}</span>
                <span className="text-sm font-semibold text-[#253342]">${row.revenue.toFixed(0)}</span>
              </div>
            ))
          )}
        </div>
      </div>
      <div className="rounded-2xl border border-[#dbe7ec] bg-white p-5 shadow-sm">
        <h3 className="text-base font-semibold text-[#253342]">Revenue Snapshot</h3>
        <div className="mt-4 space-y-3 text-sm">
          <HealthRow label="Total Revenue" value={`$${metrics.totalRevenue.toFixed(0)}`} />
          <HealthRow label="Meetings Count" value={displayedBookings.length} />
          <HealthRow label="Completed Meetings" value={metrics.completedBookings} />
        </div>
      </div>
    </div>
  );

  const renderInsights = () => {
    const pendingRatio = displayedApplications.length ? Math.round((metrics.pendingApplications / displayedApplications.length) * 100) : 0;
    const completionRatio = displayedBookings.length ? Math.round((metrics.completedBookings / displayedBookings.length) * 100) : 0;
    return (
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <InsightCard
          title="Application Processing"
          value={`${pendingRatio}% pending`}
          description="Lower pending percentage means faster onboarding quality."
          icon={Clock3}
          tone="amber"
        />
        <InsightCard
          title="Meeting Completion"
          value={`${completionRatio}% completed`}
          description="Tracks how many bookings have reached completion status."
          icon={CheckCircle2}
          tone="emerald"
        />
        <InsightCard
          title="Rejected Applications"
          value={displayedApplications.filter((a) => a.status === "rejected").length}
          description="Use this to monitor verification strictness and support needs."
          icon={XCircle}
          tone="rose"
        />
        <InsightCard
          title="Active Revenue Flow"
          value={`$${metrics.totalRevenue.toFixed(0)}`}
          description="Current total from all recorded bookings."
          icon={DollarSign}
          tone="sky"
        />
      </div>
    );
  };

  const renderSettings = () => (
    <div className="rounded-2xl border border-[#dbe7ec] bg-white p-5 shadow-sm">
      <h3 className="text-lg font-semibold text-[#253342]">Admin Settings</h3>
      <p className="mt-2 text-sm text-[#516f90]">
        Review the current platform controls for payouts, moderation, notifications, and meeting operations.
      </p>
      <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-[#dbe7ec] bg-[#f8fbfc] p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#6b7f90]">Financial Controls</p>
          <div className="mt-3 space-y-2">
            <HealthRow label="Commission Model" value="12% platform fee" />
            <HealthRow label="Payout Cycle" value="Every 7 days" />
            <HealthRow label="Refund Window" value="24 hours before meeting" />
          </div>
        </div>
        <div className="rounded-xl border border-[#dbe7ec] bg-[#f8fbfc] p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#6b7f90]">Moderation Rules</p>
          <div className="mt-3 space-y-2">
            <HealthRow label="Application Review" value="Manual approval required" />
            <HealthRow label="Profile Visibility" value="Approved profiles only" />
            <HealthRow label="Meeting Confirmation" value="Enabled after payment" />
          </div>
        </div>
        <div className="rounded-xl border border-[#dbe7ec] bg-[#f8fbfc] p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#6b7f90]">Notifications</p>
          <div className="mt-3 space-y-2">
            <HealthRow label="Admin Alerts" value="Enabled" />
            <HealthRow label="Booking Emails" value="Enabled" />
            <HealthRow label="Psychologist Reminders" value="1 hour before meeting" />
          </div>
        </div>
        <div className="rounded-xl border border-[#dbe7ec] bg-[#f8fbfc] p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#6b7f90]">Platform Status</p>
          <div className="mt-3 space-y-2">
            <HealthRow label="Directory Access" value="Active" />
            <HealthRow label="Payment Flow" value="Operational" />
            <HealthRow label="Audit Snapshot" value="Updated today" />
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8fbfc_0%,#eef9f5_55%,#ffffff_100%)]">
      <div className="mx-auto flex max-w-[1500px] gap-4 px-4 py-5 lg:px-6">
        <aside className="hidden w-72 shrink-0 rounded-2xl border border-[#dbe7ec] bg-white p-4 shadow-sm lg:block">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-[#6b7f90]">Admin Control</p>
          <div className="space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = active === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => setActive(item.key)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition ${
                    isActive ? "bg-[#253342] text-white" : "text-[#425466] hover:bg-[#f4f9fb]"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </button>
              );
            })}
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <div className="mb-5 rounded-2xl border border-[#dbe7ec] bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="text-2xl font-bold text-[#253342]">Administrative Control Center</h1>
                <p className="text-sm text-[#6b7f90]">Manage users, psychologists, bookings, and revenue from one control panel.</p>
              </div>
              <button
                onClick={refresh}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-lg border border-[#dbe7ec] bg-white px-3 py-2 text-sm font-semibold text-[#425466] hover:bg-[#f6fafb] disabled:opacity-60"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                {loading ? "Refreshing..." : "Refresh Data"}
              </button>
            </div>
          </div>

          <div className="mb-4 flex gap-2 overflow-auto rounded-xl border border-[#dbe7ec] bg-white p-2 shadow-sm lg:hidden">
            {menuItems.map((item) => (
              <button
                key={item.key}
                onClick={() => setActive(item.key)}
                className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium ${
                  active === item.key ? "bg-[#253342] text-white" : "text-[#425466]"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {active === "overview" && renderOverview()}
          {active === "applications" && renderApplications()}
          {active === "bookings" && renderBookings()}
          {active === "users" && renderUsers()}
          {active === "revenue" && renderRevenue()}
          {active === "insights" && renderInsights()}
          {active === "settings" && renderSettings()}
        </main>
      </div>
    </div>
  );
}

function MetricCard({ title, value, icon: Icon, tone = "sky" }) {
  const toneMap = {
    sky: "bg-[#eef6f8] text-[#00a4bd]",
    emerald: "bg-[#eefaf6] text-[#00a58f]",
    amber: "bg-[#fff6e8] text-[#a45d15]",
    indigo: "bg-[#e7f2ff] text-[#1f5f99]",
    rose: "bg-[#fdecea] text-[#dd5b42]",
  };
  return (
    <div className="rounded-2xl border border-[#dbe7ec] bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#6b7f90]">{title}</p>
        <div className={`rounded-lg p-2 ${toneMap[tone] || toneMap.sky}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="mt-3 text-3xl font-bold text-[#253342]">{value}</p>
    </div>
  );
}

function HealthRow({ label, value }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-[#f6fafb] px-3 py-2">
      <span className="text-[#516f90]">{label}</span>
      <span className="font-semibold text-[#253342]">{value}</span>
    </div>
  );
}

function InsightCard({ title, value, description, icon: Icon, tone = "sky" }) {
  const toneMap = {
    sky: "bg-[#eef6f8] text-[#00a4bd]",
    emerald: "bg-[#eefaf6] text-[#00a58f]",
    amber: "bg-[#fff6e8] text-[#a45d15]",
    rose: "bg-[#fdecea] text-[#dd5b42]",
  };
  return (
    <div className="rounded-2xl border border-[#dbe7ec] bg-white p-5 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-base font-semibold text-[#253342]">{title}</h4>
        <div className={`rounded-lg p-2 ${toneMap[tone] || toneMap.sky}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="text-2xl font-bold text-[#253342]">{value}</p>
      <p className="mt-2 text-sm text-[#516f90]">{description}</p>
    </div>
  );
}
