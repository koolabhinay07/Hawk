import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Bell,
  BookOpen,
  Check,
  ClipboardCheck,
  Clock,
  FileText,
  GraduationCap,
  House,
  LogOut,
  Megaphone,
  Mic,
  Moon,
  Send,
  Sparkles,
  Star,
  User,
  Users,
  Wallet,
} from "lucide-react";
import { allowRetroactiveMarking, getNextWorkingDay, getPeriodState, getScheduleMinute, getTodaysAttendanceSummary, hasAttendanceRights, schoolClosedDays, timetable, type AttendanceRecord, type TimetablePeriod } from "./timetable";

const quickActions = [
  { icon: ClipboardCheck, label: "Attendance" },
  { icon: BookOpen, label: "Homework" },
  { icon: Megaphone, label: "Notice" },
  { icon: Star, label: "Appreciate" },
  { icon: FileText, label: "Mock Test" },
];

const navItems = [
  { icon: House, label: "Home" },
  { icon: Users, label: "Classes" },
  { icon: GraduationCap, label: "Academics" },
  { icon: User, label: "Profile" },
];

const firstScheduledPeriod = [...timetable].sort((a, b) => a.startMinute - b.startMinute)[0];

function MetaText({ value, className }: { value: string; className: string }) {
  return (
    <span className={className}>
      {value.split(" · ").map((part, index) => (
        <span key={`${part}-${index}`}>
          {index > 0 && <span aria-hidden="true" className="mx-1.5 inline-block size-1 rounded-full bg-current align-middle" />}
          {part}
        </span>
      ))}
    </span>
  );
}

function getAttendanceDateKey(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return `${year}-${month}-${day}`;
}

function loadAttendanceRecords(dateKey: string): Record<string, AttendanceRecord> {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(`hawk-attendance-records:${dateKey}`) ?? "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).filter(([periodId, value]) => {
      if (!timetable.some((period) => period.period === periodId) || !value || typeof value !== "object") return false;
      const record = value as Partial<AttendanceRecord>;
      const period = timetable.find((item) => item.period === periodId);
      if (!period || !Number.isFinite(record.markedAt)) return false;
      const markedAt = new Date(record.markedAt as number);
      if (getAttendanceDateKey(markedAt) !== dateKey || getScheduleMinute(markedAt) < period.startMinute) return false;
      return Number.isInteger(record.present) && Number.isInteger(record.total) &&
        (record.present ?? -1) >= 0 && (record.total ?? 0) > 0 &&
        (record.present ?? Infinity) <= (record.total ?? -1);
    })) as Record<string, AttendanceRecord>;
  } catch {
    return {};
  }
}

function loadConductedPeriods(dateKey: string): Record<string, number> {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(`hawk-conducted-periods:${dateKey}`) ?? "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).filter(([periodId, value]) => {
      const period = timetable.find((item) => item.period === periodId);
      if (!period || typeof value !== "number" || !Number.isFinite(value)) return false;
      const conductedAt = new Date(value);
      return getAttendanceDateKey(conductedAt) === dateKey && getScheduleMinute(conductedAt) >= period.startMinute;
    }));
  } catch {
    return {};
  }
}

function isPeriodConducted(period: TimetablePeriod, records: Record<string, number>, dateKey: string, scheduleMinute: number) {
  const conductedAt = records[period.period];
  if (!Number.isFinite(conductedAt) || scheduleMinute < period.startMinute) return false;
  const timestamp = new Date(conductedAt);
  return getAttendanceDateKey(timestamp) === dateKey && getScheduleMinute(timestamp) >= period.startMinute;
}

type ProxyRequest = {
  status: "pending" | "accepted" | "expired";
  requestedAt?: number;
  acceptedAt?: number;
  coveringTeacherName?: string;
};

function parseProxyRequests(raw: string | null): Record<string, ProxyRequest> {
  try {
    const parsed: unknown = JSON.parse(raw ?? "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).filter(([periodId, value]) => {
      if (!timetable.some((period) => period.period === periodId) || !value || typeof value !== "object") return false;
      const request = value as Partial<ProxyRequest>;
      return request.status === "pending" || request.status === "accepted" || request.status === "expired";
    }).map(([periodId, value]) => [periodId, {
      status: (value as ProxyRequest).status,
      requestedAt: Number.isFinite((value as ProxyRequest).requestedAt) ? (value as ProxyRequest).requestedAt : undefined,
      acceptedAt: Number.isFinite((value as ProxyRequest).acceptedAt) ? (value as ProxyRequest).acceptedAt : undefined,
      coveringTeacherName: typeof (value as ProxyRequest).coveringTeacherName === "string" ? (value as ProxyRequest).coveringTeacherName : undefined,
    }]));
  } catch {
    return {};
  }
}

function loadProxyRequests(dateKey: string) {
  try {
    return parseProxyRequests(window.localStorage.getItem(`hawk-proxy-requests:${dateKey}`));
  } catch {
    return {};
  }
}

function getProxyRequestStatus(request: ProxyRequest | undefined, period: TimetablePeriod, dateKey: string, scheduleMinute: number) {
  if (!request) return undefined;
  if (request.status === "expired") return "expired" as const;
  if (request.status === "accepted") {
    if (request.acceptedAt === undefined) return scheduleMinute >= period.startMinute ? "expired" as const : "accepted" as const;
    const acceptedAt = new Date(request.acceptedAt);
    if (getAttendanceDateKey(acceptedAt) !== dateKey || getScheduleMinute(acceptedAt) >= period.startMinute) return "expired" as const;
    return "accepted" as const;
  }
  return scheduleMinute >= period.startMinute ? "expired" as const : "pending" as const;
}

export default function Screen1({ onLogout, teacherName }: { onLogout: () => void; teacherName: string }) {
  const [aiOpen, setAiOpen] = useState(false);
  const [showAiHint, setShowAiHint] = useState(true);
  const [aiAtHomeEnd, setAiAtHomeEnd] = useState(false);
  const [activeNav, setActiveNav] = useState("Home");
  const [isDarkMode, setIsDarkMode] = useState(() => {
    try {
      return window.localStorage.getItem("hawk-appearance") === "dark";
    } catch {
      return false;
    }
  });
  const [clock, setClock] = useState(() => new Date());
  const attendanceDateKey = getAttendanceDateKey(clock);
  const [attendanceRecords, setAttendanceRecords] = useState<Record<string, AttendanceRecord>>(() => loadAttendanceRecords(attendanceDateKey));
  const [loadedAttendanceDateKey, setLoadedAttendanceDateKey] = useState(attendanceDateKey);
  const [conductedPeriods, setConductedPeriods] = useState<Record<string, number>>(() => loadConductedPeriods(attendanceDateKey));
  const [loadedConductedDateKey, setLoadedConductedDateKey] = useState(attendanceDateKey);
  const [proxyRequests, setProxyRequests] = useState<Record<string, ProxyRequest>>(() => loadProxyRequests(attendanceDateKey));
  const [loadedProxyDateKey, setLoadedProxyDateKey] = useState(attendanceDateKey);
  const [proxyNotification, setProxyNotification] = useState("");
  const [proxyAttendanceRights] = useState(() => {
    try {
      return window.localStorage.getItem("hawk-proxy-attendance-rights") === "true";
    } catch {
      return false;
    }
  });
  const [attendanceTarget, setAttendanceTarget] = useState<TimetablePeriod | null>(null);
  const [attendanceTotal, setAttendanceTotal] = useState("");
  const [attendancePresent, setAttendancePresent] = useState("");
  const scheduleMinute = getScheduleMinute(clock);
  const activePeriodIndex = timetable.findIndex((period) => scheduleMinute >= period.startMinute && scheduleMinute < period.endMinute);
  const activePeriod = activePeriodIndex >= 0 ? timetable[activePeriodIndex] : undefined;
  const activePeriodAttendance = activePeriod ? attendanceRecords[activePeriod.period] : undefined;
  const activePeriodConducted = activePeriod ? isPeriodConducted(activePeriod, conductedPeriods, attendanceDateKey, scheduleMinute) : false;
  const nextUpcomingPeriod = timetable.find((period) => period.startMinute > scheduleMinute);
  const heroPeriod = activePeriod ?? nextUpcomingPeriod ?? timetable[timetable.length - 1];
  const cancelableProxyRequestPeriod = timetable.find((period) =>
    getProxyRequestStatus(proxyRequests[period.period], period, attendanceDateKey, scheduleMinute) === "pending",
  );
  const attendanceSummary = getTodaysAttendanceSummary(timetable, scheduleMinute, attendanceRecords, proxyAttendanceRights);
  const { dayComplete } = attendanceSummary;
  const nextWorkingDay = getNextWorkingDay(clock, schoolClosedDays);
  const dashboardDate = new Intl.DateTimeFormat("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Asia/Kolkata",
  }).format(clock);
  const mainContentRef = useRef<HTMLElement>(null);
  const attendanceDialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 15_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (loadedAttendanceDateKey === attendanceDateKey) return;
    setAttendanceRecords(loadAttendanceRecords(attendanceDateKey));
    setLoadedAttendanceDateKey(attendanceDateKey);
  }, [attendanceDateKey, loadedAttendanceDateKey]);

  useEffect(() => {
    if (loadedConductedDateKey === attendanceDateKey) return;
    setConductedPeriods(loadConductedPeriods(attendanceDateKey));
    setLoadedConductedDateKey(attendanceDateKey);
  }, [attendanceDateKey, loadedConductedDateKey]);

  useEffect(() => {
    if (loadedProxyDateKey === attendanceDateKey) return;
    setProxyRequests(loadProxyRequests(attendanceDateKey));
    setLoadedProxyDateKey(attendanceDateKey);
  }, [attendanceDateKey, loadedProxyDateKey]);

  useEffect(() => {
    setProxyRequests((requests) => {
      let changed = false;
      const next = { ...requests };
      for (const period of timetable) {
        if (next[period.period]?.status === "pending" && scheduleMinute >= period.startMinute) {
          next[period.period] = { ...next[period.period], status: "expired" };
          changed = true;
        }
      }
      return changed ? next : requests;
    });
  }, [scheduleMinute]);

  useEffect(() => {
    const timer = window.setTimeout(() => setShowAiHint(false), 3_000);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    let frame = 0;
    const updateHomeEnd = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        setAiAtHomeEnd(Boolean(activeNav === "Home" && mainContentRef.current && mainContentRef.current.getBoundingClientRect().bottom <= window.innerHeight + 16));
      });
    };

    window.addEventListener("scroll", updateHomeEnd, { capture: true, passive: true });
    window.addEventListener("resize", updateHomeEnd);
    updateHomeEnd();
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", updateHomeEnd, true);
      window.removeEventListener("resize", updateHomeEnd);
    };
  }, [activeNav]);

  useEffect(() => {
    const appearance = isDarkMode ? "dark" : "light";
    document.documentElement.dataset.appearance = appearance;
    try {
      window.localStorage.setItem("hawk-appearance", appearance);
    } catch {
      // Theme selection remains active for this session if browser storage is unavailable.
    }
  }, [isDarkMode]);

  useEffect(() => {
    if (loadedAttendanceDateKey !== attendanceDateKey) return;
    try {
      window.localStorage.setItem(`hawk-attendance-records:${attendanceDateKey}`, JSON.stringify(attendanceRecords));
    } catch {
      // Attendance counts remain available for this session if browser storage is unavailable.
    }
  }, [attendanceDateKey, attendanceRecords, loadedAttendanceDateKey]);

  useEffect(() => {
    if (loadedConductedDateKey !== attendanceDateKey) return;
    try {
      window.localStorage.setItem(`hawk-conducted-periods:${attendanceDateKey}`, JSON.stringify(conductedPeriods));
    } catch {
      // Conducted state remains available for this session if browser storage is unavailable.
    }
  }, [attendanceDateKey, conductedPeriods, loadedConductedDateKey]);

  useEffect(() => {
    if (loadedProxyDateKey !== attendanceDateKey) return;
    try {
      window.localStorage.setItem(`hawk-proxy-requests:${attendanceDateKey}`, JSON.stringify(proxyRequests));
    } catch {
      // Proxy requests remain available for this session if browser storage is unavailable.
    }
  }, [attendanceDateKey, loadedProxyDateKey, proxyRequests]);

  useEffect(() => {
    if (!proxyNotification) return;
    const timer = window.setTimeout(() => setProxyNotification(""), 6500);
    return () => window.clearTimeout(timer);
  }, [proxyNotification]);

  useEffect(() => {
    const storageKey = `hawk-proxy-requests:${attendanceDateKey}`;
    function handleProxyRequestUpdate(event: StorageEvent) {
      if (event.key !== storageKey || loadedProxyDateKey !== attendanceDateKey) return;
      const incoming = parseProxyRequests(event.newValue);
      for (const [periodId, request] of Object.entries(incoming)) {
        if (request.status !== "accepted" || proxyRequests[periodId]?.status !== "pending") continue;
        const period = timetable.find((item) => item.period === periodId);
        if (!period) continue;
        const acceptedAt = request.acceptedAt ?? Date.now();
        const acceptedDate = getAttendanceDateKey(new Date(acceptedAt));
        const acceptedMinute = getScheduleMinute(new Date(acceptedAt));
        if (acceptedDate !== attendanceDateKey || acceptedMinute >= period.startMinute) {
          incoming[periodId] = { ...request, status: "expired" };
          continue;
        }
        incoming[periodId] = { ...request, acceptedAt };
        const coveringTeacher = request.coveringTeacherName?.trim() || "A covering teacher";
        const message = `Your proxy request for ${periodId} was accepted by ${coveringTeacher}.`;
        setProxyNotification(message);
        if (typeof Notification !== "undefined" && Notification.permission === "granted") {
          new Notification("Proxy request accepted", { body: message });
        }
      }
      setProxyRequests(incoming);
    }
    window.addEventListener("storage", handleProxyRequestUpdate);
    return () => window.removeEventListener("storage", handleProxyRequestUpdate);
  }, [attendanceDateKey, loadedProxyDateKey, proxyRequests]);

  useEffect(() => {
    const dialog = attendanceDialogRef.current;
    if (!dialog) return;
    if (attendanceTarget && !dialog.open) {
      dialog.showModal();
      dialog.querySelector<HTMLInputElement>("input")?.focus();
    }
    if (!attendanceTarget && dialog.open) dialog.close();
  }, [attendanceTarget]);

  function openAttendance(period: TimetablePeriod) {
    if (scheduleMinute < period.startMinute) return;
    const record = attendanceRecords[period.period];
    setAttendanceTotal(String(record?.total ?? period.students ?? ""));
    setAttendancePresent(String(record?.present ?? ""));
    setAttendanceTarget(period);
  }

  function requestProxy(period: TimetablePeriod) {
    setProxyRequests((requests) => ({
      ...requests,
      [period.period]: { status: "pending", requestedAt: Date.now() },
    }));
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      void Notification.requestPermission();
    }
  }

  function cancelProxyRequest(period: TimetablePeriod) {
    setProxyRequests((requests) => {
      const next = { ...requests };
      delete next[period.period];
      return next;
    });
  }

  return (
    <div data-appearance={isDarkMode ? "dark" : "light"} className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto flex min-h-dvh w-full max-w-[1440px] flex-col border-x border-border bg-background shadow-[0_12px_48px_rgba(23,35,29,0.08)]">
          <div className="grow">
            <header className="fixed inset-x-0 top-0 z-40 mx-auto flex h-[76px] w-full max-w-[1440px] items-center justify-between border-b bg-background px-4 md:px-8">
              <div className="flex items-center gap-3">
                <div className="text-base font-semibold rounded-2xl bg-primary-container text-on-primary-container flex justify-center items-center size-10">
                  {teacherName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}
                </div>
                <div>
                  <div className="font-semibold text-base">Namaste, {teacherName}</div>
                  <div className="text-muted-foreground text-sm">
                    Delhi Public School, Madhubani
                  </div>
                </div>
              </div>
              <button
                aria-label="Notifications"
                type="button"
                className="rounded-xl flex relative justify-center items-center size-11 hover:bg-card transition-colors"
              >
                <Bell className="size-5" />
                <span className="rounded-full bg-primary-foreground absolute top-2 right-2.5 size-2" />
              </button>
            </header>
            {proxyNotification && (
              <div role="status" aria-live="polite" className="fixed inset-x-4 top-20 z-50 mx-auto flex max-w-lg items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-sm font-medium text-foreground shadow-lg">
                <Check aria-hidden="true" className="size-5 shrink-0 text-icon-accent" />
                {proxyNotification}
              </div>
            )}

            <nav aria-label="Primary navigation" className="fixed bottom-0 left-[max(0px,calc((100vw-1440px)/2))] top-[76px] z-20 hidden w-20 flex-col items-center gap-3 border-r border-border bg-background py-6 md:flex">
              {navItems.map(({ icon: Icon, label }) => (
                <button
                  key={label}
                  type="button"
                  aria-current={activeNav === label ? "page" : undefined}
                  onClick={() => setActiveNav(label)}
                  className={`flex min-h-[68px] w-[76px] flex-col items-center justify-center gap-1.5 whitespace-nowrap rounded-[20px] text-sm font-normal transition-colors ${activeNav === label ? "bg-primary-soft text-icon-accent" : "text-muted-foreground hover:bg-muted"}`}
                >
                  <Icon aria-hidden="true" className="size-6" />
                  {label}
                </button>
              ))}
            </nav>

            <div className="grow pt-[76px] md:pl-20">
            {activeNav === "Home" ? (
              <main ref={mainContentRef} className="mx-auto flex w-full max-w-[1200px] flex-col gap-7 px-4 pb-44 pt-7 md:gap-9 md:px-8 md:pb-12 md:pt-10">
              <section data-ai-obstacle className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                <h1 className="text-[28px] font-semibold leading-tight tracking-tight">{dashboardDate}</h1>
                <MetaText className="text-muted-foreground text-sm md:pb-1" value={`${attendanceSummary.totalClassCount} classes today · ${attendanceSummary.headerCount} ${attendanceSummary.headerLabel}`} />
              </section>

              <div className="grid gap-7 md:grid-cols-[minmax(0,1.55fr)_minmax(300px,0.9fr)] md:gap-8">
              <div className="flex min-w-0 flex-col gap-7 md:gap-8">

              <section data-ai-obstacle className={`rounded-[28px] p-5 md:p-6 ${dayComplete ? "border border-border bg-card text-foreground" : "bg-primary-container text-on-primary-container"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    {dayComplete ? (
                      <>
                        <div className="flex items-center gap-2 text-sm font-semibold tracking-[0.04em] text-muted-foreground">
                          <Check aria-hidden="true" className="size-3.5" />
                          DAY COMPLETE
                        </div>
                        <MetaText className="mt-2 block text-sm text-muted-foreground" value={`${attendanceSummary.markedCount} of ${attendanceSummary.totalClassCount} periods marked · ${attendanceSummary.missedCount} missed`} />
                        {firstScheduledPeriod && (
                          <MetaText
                            className="mt-2 block text-sm"
                            value={`Next class: ${nextWorkingDay.label}`}
                          />
                        )}
                      </>
                    ) : activePeriod ? (
                      <>
                        <div className="flex items-center gap-2 text-sm font-semibold tracking-[0.04em] text-on-primary-container">
                          {activePeriod.period === "P1" && activePeriodAttendance ? <Check className="size-3.5" /> : <Clock className="size-3.5" />}
                          {activePeriod.period === "P1"
                            ? activePeriodAttendance ? "Attendance marked" : "Attendance pending"
                            : activePeriodConducted ? "Conducted" : "Class in progress"}
                        </div>
                        <h2 className="mt-2 text-base font-semibold tracking-tight">{activePeriod.subject}</h2>
                        <MetaText className="text-sm text-on-primary-container/80" value={activePeriod.isOwnClass ? `${activePeriod.students ?? 0} students · Your class` : activePeriod.details} />
                      </>
                    ) : heroPeriod ? (
                      <>
                        <div className="flex items-center gap-2 text-sm font-semibold tracking-[0.04em] text-on-primary-container">
                          <Clock className="size-3.5" />
                          {nextUpcomingPeriod ? "Up next" : "No more classes today"}
                        </div>
                        <h2 className="mt-2 text-base font-semibold tracking-tight">{heroPeriod.period} · {heroPeriod.subject}</h2>
                        <MetaText className="text-sm text-on-primary-container/80" value={`${heroPeriod.time} · ${heroPeriod.details}`} />
                      </>
                    ) : null}
                  </div>
                  {!dayComplete && activePeriod && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-card/75 px-3 py-1.5 text-[12px] font-medium text-status-foreground">
                      {activePeriod.period === "P1" ? activePeriodAttendance ? "Marked" : "Now" : activePeriodConducted ? "Conducted" : "Now"}
                    </span>
                  )}
                  {!dayComplete && !activePeriod && nextUpcomingPeriod && (
                    <span className="inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-full bg-card/75 px-3 py-1.5 text-[12px] font-medium text-status-foreground">
                      {nextUpcomingPeriod.time}
                    </span>
                  )}
                </div>
                {dayComplete ? (
                  <>
                    <button
                      type="button"
                      onClick={() => document.getElementById("today-classes")?.scrollIntoView({ behavior: "smooth", block: "start" })}
                      className="mt-5 flex min-h-12 w-full items-center justify-center rounded-full border border-border bg-muted px-5 text-sm font-medium text-foreground transition-colors hover:bg-border"
                    >
                      View timetable
                    </button>
                    {allowRetroactiveMarking && attendanceSummary.eligibleForRetroactiveMarkingCount > 0 && (
                      <button
                        type="button"
                        onClick={() => openAttendance(attendanceSummary.retroactiveEligiblePeriods[0])}
                        className="mt-3 flex min-h-11 w-full items-center justify-center rounded-full px-4 text-sm font-medium text-icon-accent hover:bg-primary-soft"
                      >
                        {attendanceSummary.eligibleForRetroactiveMarkingCount} {attendanceSummary.eligibleForRetroactiveMarkingCount === 1 ? "class needs" : "classes need"} attendance
                      </button>
                    )}
                    {attendanceSummary.notEligibleForRetroactiveMarkingCount > 0 && (
                      <p className="mt-2 text-center text-sm text-muted-foreground">
                        {attendanceSummary.notEligibleForRetroactiveMarkingCount} {attendanceSummary.notEligibleForRetroactiveMarkingCount === 1 ? "period requires" : "periods require"} administrator authorization.
                      </p>
                    )}
                  </>
                ) : activePeriod?.period === "P1" && !activePeriodAttendance ? (
                  <button
                    type="button"
                    onClick={() => openAttendance(activePeriod)}
                    className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-normal text-primary-foreground transition-colors hover:brightness-95"
                  >
                    Mark Attendance<ArrowRight className="size-4" />
                  </button>
                ) : activePeriod && activePeriod.period !== "P1" && !activePeriodConducted ? (
                  <button
                    type="button"
                    onClick={() => setConductedPeriods((periods) => ({ ...periods, [activePeriod.period]: Date.now() }))}
                    className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-normal text-primary-foreground transition-colors hover:brightness-95"
                  >
                    Mark as Conducted<ArrowRight className="size-4" />
                  </button>
                ) : null}
                {!dayComplete && cancelableProxyRequestPeriod && (
                  <button
                    type="button"
                    onClick={() => cancelProxyRequest(cancelableProxyRequestPeriod)}
                    className="mt-2 flex min-h-10 w-full items-center justify-center text-sm font-medium text-icon-accent underline underline-offset-4 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    Cancel Request for {cancelableProxyRequestPeriod.period}
                  </button>
                )}
              </section>

              <section id="today-classes" data-ai-obstacle className="flex flex-col gap-3 scroll-mt-24">
                <div className="flex justify-between items-center">
                  <h2 className="text-base font-semibold tracking-tight">Today's classes</h2>
                  <button type="button" className="font-normal text-icon-accent text-sm hover:underline underline-offset-4">
                    View timetable
                  </button>
                </div>

                <div className="overflow-hidden rounded-[24px] border border-border bg-card">
                  {timetable.map((p, index) => {
                    const attendance = attendanceRecords[p.period];
                    const periodState = getPeriodState(p, scheduleMinute, attendance);
                    const canMarkAttendance = hasAttendanceRights(p, proxyAttendanceRights);
                    const proxyRequest = proxyRequests[p.period];
                    const proxyRequestStatus = getProxyRequestStatus(proxyRequest, p, attendanceDateKey, scheduleMinute);
                    const isProxyAccepted = proxyRequestStatus === "accepted";
                    const isConducted = isPeriodConducted(p, conductedPeriods, attendanceDateKey, scheduleMinute);
                    const canRequestProxy = activePeriodIndex >= 0 && index === activePeriodIndex + 1 && p.period !== "P1" && periodState === "upcoming" && !p.isOwnClass && !p.isProxy && !proxyRequestStatus;
                    const periodDetails = isProxyAccepted
                      ? `${p.details} · Covered by ${proxyRequest?.coveringTeacherName?.trim() || "Covering teacher"}`
                      : p.details;

                    return (
                      <div
                        key={p.period}
                        className={[
                          "flex items-start gap-3 px-4 py-4 transition-colors md:px-5",
                          index < timetable.length - 1 ? "border-b" : "",
                          periodState === "running" ? "bg-primary-soft" : "",
                          periodState === "done" ? "bg-muted" : "",
                          periodState === "upcoming" ? "text-muted-foreground" : "",
                        ].join(" ")}
                      >
                        <div className="flex w-28 shrink-0 flex-col gap-1 pt-0.5 tabular-nums">
                          <span aria-label={`Period ${index + 1}`} title={`Period ${index + 1}`} className="text-sm font-medium">{p.period}</span>
                          <span className="whitespace-nowrap text-muted-foreground text-sm font-normal">{p.time}</span>
                        </div>
                        <div className="grow min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-base font-semibold">{p.subject}</span>
                            {periodState === "running" && <span className="shrink-0 rounded-full bg-primary-container px-2.5 py-1 text-[12px] font-medium text-on-primary-container">Now</span>}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-2 md:gap-y-1">
                            <MetaText className="text-muted-foreground text-sm leading-relaxed" value={periodDetails} />
                            {((p.isProxy && periodState !== "upcoming") || (canMarkAttendance && periodState === "missed" && !attendance) || (!canMarkAttendance && isConducted) || proxyRequestStatus === "pending" || proxyRequestStatus === "expired" || isProxyAccepted) && (
                              <span className={`inline-flex shrink-0 items-center gap-2 whitespace-nowrap ${p.isProxy ? "" : "basis-full md:basis-auto"}`}>
                                {p.isProxy && periodState !== "upcoming" && !isProxyAccepted && <span className="inline-flex rounded-full bg-secondary px-2 py-0.5 text-[12px] font-medium text-secondary-foreground">Proxy</span>}
                                {proxyRequestStatus === "pending" && <span className="inline-flex rounded-full bg-secondary px-2 py-0.5 text-[12px] font-medium text-secondary-foreground">Pending</span>}
                                {proxyRequestStatus === "expired" && <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-[12px] font-medium text-muted-foreground">Request Expired</span>}
                                {isProxyAccepted && <span className="inline-flex rounded-full bg-secondary px-2 py-0.5 text-[12px] font-medium text-secondary-foreground">Proxy</span>}
                                {canMarkAttendance && periodState === "missed" && !attendance && <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[12px] font-medium text-accent-foreground">Missed</span>}
                                {!canMarkAttendance && isConducted && <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[12px] font-medium text-muted-foreground">Conducted</span>}
                              </span>
                            )}
                          </div>
                          {canRequestProxy && (
                            <button
                              type="button"
                              onClick={() => requestProxy(p)}
                              className="mt-2 inline-flex min-h-9 w-fit self-start items-center justify-center whitespace-nowrap rounded-full border border-border bg-transparent px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                            >
                              Request Proxy
                            </button>
                          )}
                          {canMarkAttendance && attendance && (
                            <span className="mt-1.5 inline-flex items-center gap-1 text-sm font-normal text-icon-accent">
                              <Check aria-hidden="true" className="size-3.5" />
                              {attendance.present}/{attendance.total} present
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              </div>
              <aside className="flex min-w-0 flex-col gap-7 md:gap-8">
              <section data-ai-obstacle className="flex flex-col gap-3">
                <h2 className="text-base font-semibold tracking-tight">Quick actions</h2>
                <div className="grid grid-cols-3 gap-1 sm:grid-cols-5 md:grid-cols-3">
                  {quickActions.map(({ icon: Icon, label }) => (
                    <button
                      key={label}
                      type="button"
                      className="flex min-h-[92px] min-w-0 flex-col items-center justify-start gap-2.5 rounded-2xl px-0 py-1 text-sm font-normal text-foreground transition-colors hover:bg-primary-soft"
                    >
                      <span className="flex size-[60px] shrink-0 items-center justify-center rounded-full bg-primary-soft text-icon-accent">
                        <Icon aria-hidden="true" className="size-6" />
                      </span>
                      <span className="w-full text-center leading-tight">{label}</span>
                    </button>
                  ))}
                </div>
              </section>

              <button
                type="button"
                data-ai-obstacle
                className="text-left rounded-[24px] bg-card border flex p-5 items-center gap-3.5 hover:bg-muted transition-colors"
              >
                <Wallet className="text-icon-accent size-5" />
                <div className="grow flex flex-col gap-1">
                  <div className="text-muted-foreground text-sm">September salary</div>
                  <div className="font-semibold text-base">₹42,500</div>
                </div>
                <span className="rounded-full bg-status-soft text-status-foreground text-[12px] font-medium px-2 py-1">
                  <MetaText className="" value="Credited · 1 Oct" />
                </span>
              </button>

              <section data-ai-obstacle className="flex flex-col gap-3">
                <div className="flex justify-between items-center">
                  <h2 className="text-base font-semibold tracking-tight">Announcements</h2>
                  <button type="button" className="font-normal text-icon-accent text-sm hover:underline underline-offset-4">
                    See all
                  </button>
                </div>
                <div className="overflow-hidden rounded-[24px] border bg-card">
                  <article className="flex gap-3.5 p-4">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-icon-accent">
                      <Megaphone aria-hidden="true" className="size-[18px]" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-base font-semibold leading-5">Sports Day volunteer list</h3>
                        <span className="shrink-0 pt-0.5 text-sm text-muted-foreground">2h ago</span>
                      </div>
                      <p className="mt-1 text-sm font-normal leading-relaxed text-muted-foreground">Please confirm your house duty before Friday.</p>
                      <span className="mt-2 inline-flex rounded-full bg-muted px-2 py-1 text-[12px] font-medium text-muted-foreground">School</span>
                    </div>
                  </article>
                  <article className="flex gap-3.5 border-t p-4">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-icon-accent">
                      <BookOpen aria-hidden="true" className="size-[18px]" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-base font-semibold leading-5">Bring geometry box on Monday</h3>
                        <span className="shrink-0 pt-0.5 text-sm text-muted-foreground">Yesterday</span>
                      </div>
                      <p className="mt-1 text-sm font-normal leading-relaxed text-muted-foreground">Class 8-B students should carry ruler and compass.</p>
                      <span className="mt-2 inline-flex rounded-full bg-status-soft px-2 py-1 text-[12px] font-medium text-status-foreground">Class 8-B</span>
                    </div>
                  </article>
                </div>
              </section>

              <section data-ai-obstacle className="flex flex-col gap-3">
                <h2 className="text-base font-semibold tracking-tight">Coming up</h2>
                <div className="rounded-[24px] bg-card border px-4">
                  {[
                    { d: "28", m: "OCT", t: "Sports Day – Annual Function", s: "School event" },
                    { d: "3", m: "NOV", t: "Unit Test 2 begins", s: "Exams" },
                  ].map((e, i) => (
                    <div
                      key={e.t}
                      className={`flex gap-3 py-3.5 ${i === 0 ? "border-b" : ""}`}
                    >
                  <div className="text-sm font-semibold rounded-lg bg-muted text-icon-accent flex flex-col justify-center items-center shrink-0 size-14">
                        <span>{e.d}</span>
                        <span>{e.m}</span>
                      </div>
                      <div>
                        <div className="text-base font-semibold">{e.t}</div>
                        <div className="text-sm font-normal text-muted-foreground">{e.s}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
              </aside>
              </div>
              </main>
            ) : activeNav === "Profile" ? (
              <main ref={mainContentRef} className="mx-auto flex min-h-[60vh] w-full max-w-3xl grow flex-col gap-6 px-4 pb-40 pt-8 md:px-8 md:pb-12 md:pt-10">
                <h1 className="text-base font-semibold leading-tight tracking-tight">Profile</h1>
                <section data-ai-obstacle className="flex items-center justify-between gap-4 rounded-[24px] border bg-card p-5 md:p-6">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-icon-accent">
                      <Moon aria-hidden="true" className="size-5" />
                    </span>
                    <div className="min-w-0">
                  <h2 className="text-base font-semibold">Dark mode</h2>
                      <p id="dark-mode-description" className="mt-1 text-sm leading-relaxed text-muted-foreground">
                        Preview Hawk with a darker color palette.
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-sm font-normal text-muted-foreground">{isDarkMode ? "On" : "Off"}</span>
                    <button
                      type="button"
                      role="switch"
                      aria-label="Dark mode"
                      aria-describedby="dark-mode-description"
                      aria-checked={isDarkMode}
                      onClick={() => setIsDarkMode((enabled) => !enabled)}
                      className="relative flex h-11 w-[52px] shrink-0 items-center justify-center rounded-full transition-colors focus-visible:outline-offset-2"
                    >
                      <span className={`h-6 w-11 rounded-full transition-colors ${isDarkMode ? "bg-primary-foreground" : "bg-muted"}`} />
                      <span className={`absolute left-1.5 top-1/2 size-[18px] -translate-y-1/2 rounded-full bg-white shadow-sm transition-transform ${isDarkMode ? "translate-x-5" : "translate-x-0"}`} />
                    </button>
                  </div>
                </section>
                <section data-ai-obstacle className="rounded-[24px] border bg-card p-5 md:p-6">
                  <button
                    type="button"
                    onClick={onLogout}
                    className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-border bg-background px-5 text-sm font-normal text-foreground transition-colors hover:bg-muted"
                  >
                    <LogOut aria-hidden="true" className="size-4" />
                    Log out
                  </button>
                </section>
              </main>
            ) : (
              <main ref={mainContentRef} className="flex min-h-[60vh] grow items-center justify-center px-6 pb-40 pt-8 text-center md:pb-12">
                <div className="flex flex-col items-center gap-2">
                <h1 className="text-base font-semibold leading-tight tracking-tight">{activeNav}</h1>
                  <p className="text-sm text-muted-foreground">Coming soon</p>
                </div>
              </main>
            )}
            </div>
          </div>

          <nav
            aria-label="Primary navigation"
            className="fixed bottom-[calc(env(safe-area-inset-bottom)+12px)] left-1/2 z-20 flex min-h-[80px] w-[calc(100%-16px)] max-w-[520px] -translate-x-1/2 items-center gap-1 rounded-full border border-border bg-background px-2 py-2 shadow-[0_12px_32px_rgba(23,35,29,0.14)] md:hidden"
          >
            {navItems.map(({ icon: Icon, label }) => (
              <button
                key={label}
                type="button"
                aria-current={activeNav === label ? "page" : undefined}
                onClick={() => setActiveNav(label)}
                className={`flex min-h-[64px] min-w-0 flex-1 flex-col items-center justify-center gap-1 whitespace-nowrap rounded-full px-0 py-2 text-sm font-normal transition-colors duration-200 ${
                  activeNav === label
                    ? "bg-primary-soft text-icon-accent"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                <Icon aria-hidden="true" className="size-6" />
                {label}
              </button>
            ))}
          </nav>

          <dialog
            ref={attendanceDialogRef}
            aria-labelledby="attendance-dialog-title"
            onCancel={(event) => { event.preventDefault(); setAttendanceTarget(null); }}
            onClick={(event) => { if (event.target === attendanceDialogRef.current) setAttendanceTarget(null); }}
            className="m-auto w-[calc(100%-32px)] max-w-sm rounded-2xl border border-border bg-card p-0 text-foreground shadow-2xl backdrop:bg-foreground/50"
          >
            {attendanceTarget && (
              <form
                className="flex flex-col gap-4 p-5"
                onSubmit={(event) => {
                  event.preventDefault();
                  const total = Number(attendanceTotal);
                  const present = Number(attendancePresent);
                  if (!Number.isInteger(total) || total < 1 || !Number.isInteger(present) || present < 0 || present > total) return;
                  setAttendanceRecords((records) => ({ ...records, [attendanceTarget.period]: { present, total, markedAt: Date.now() } }));
                  setAttendanceTarget(null);
                }}
              >
                <div>
                  <h2 id="attendance-dialog-title" className="text-base font-semibold">Mark attendance</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{attendanceTarget.period} · {attendanceTarget.subject}</p>
                </div>
                <label className="flex flex-col gap-1.5 text-sm font-normal">
                  Total students
                  <input required type="number" min="1" step="1" value={attendanceTotal} onChange={(event) => setAttendanceTotal(event.target.value)} className="h-11 rounded-lg border border-border bg-background px-3" />
                </label>
                <label className="flex flex-col gap-1.5 text-sm font-normal">
                  Students present
                  <input required type="number" min="0" max={attendanceTotal || undefined} step="1" value={attendancePresent} onChange={(event) => setAttendancePresent(event.target.value)} className="h-11 rounded-lg border border-border bg-background px-3" />
                </label>
                <div className="flex gap-2 pt-1">
                  <button type="button" onClick={() => setAttendanceTarget(null)} className="min-h-11 flex-1 rounded-xl border border-border text-sm font-normal hover:bg-muted">Cancel</button>
                  <button type="submit" className="min-h-11 flex-1 rounded-xl bg-primary text-sm font-normal text-primary-foreground">Save attendance</button>
                </div>
              </form>
            )}
          </dialog>

          <div
            aria-hidden={!aiAtHomeEnd}
            className={`fixed right-[max(24px,calc((100vw-1440px)/2+24px))] bottom-[calc(env(safe-area-inset-bottom)+108px)] z-30 flex min-h-14 min-w-14 items-center justify-end gap-2 transition-[opacity,transform] duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] motion-reduce:transition-none md:bottom-6 ${aiAtHomeEnd ? "translate-x-0 opacity-100" : "pointer-events-none translate-x-24 opacity-0"}`}
          >
            {showAiHint && (
              <span aria-hidden="true" className="shadow-sm rounded-full bg-popover text-popover-foreground text-sm px-3 py-2">
                Ask Hawk
              </span>
            )}
            <button
              aria-label="Ask Hawk AI"
              tabIndex={aiAtHomeEnd ? 0 : -1}
              type="button"
              onClick={() => setAiOpen(true)}
              className="shadow-md rounded-full bg-primary text-primary-foreground flex justify-center items-center size-14"
            >
              <Sparkles className="size-6" />
            </button>
          </div>

          {aiOpen && (
            <div
              className="bg-foreground/50 flex fixed z-40 inset-0 items-end"
              onClick={() => setAiOpen(false)}
            >
              <section
                role="dialog"
                aria-modal="true"
                aria-labelledby="hawk-ai-title"
                className="shadow-lg rounded-t-2xl bg-card mx-auto p-4 w-full max-w-md max-h-[90dvh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h2 id="hawk-ai-title" className="text-base font-semibold">Hawk AI</h2>
                    <p className="text-muted-foreground text-sm">
                      Tell me what you need. I'll draft it for you.
                    </p>
                  </div>
                  <div className="text-sm flex gap-1">
                    <button type="button" className="text-sm font-normal">English</button>
                    <span className="text-muted-foreground">|</span>
                    <button type="button">हिन्दी</button>
                  </div>
                </div>

                <button
                  type="button"
                  className="rounded-full bg-primary text-primary-foreground flex mx-auto mt-4 flex-col justify-center items-center size-16"
                >
                  <Mic className="size-6" />
                </button>
                <p className="text-center text-sm text-muted-foreground mt-1">Tap and speak</p>

                <div className="flex mt-4 gap-2">
                  <input
                    placeholder="Or type here…"
                    className="rounded-lg bg-background text-sm border outline-none flex px-3 grow h-11 min-w-0"
                  />
                  <button
                    type="button"
                    aria-label="Send message"
                    className="rounded-lg bg-primary text-primary-foreground flex justify-center items-center size-11"
                  >
                    <Send className="size-4" />
                  </button>
                </div>

                <div className="flex mt-3 flex-wrap gap-2">
                  {[
                    "Draft a notice for Sports Day",
                    "Create homework for Class 8-B",
                    "Mark today's attendance",
                  ].map((s) => (
                    <button key={s} type="button" className="rounded-full bg-muted text-sm px-3 py-2">
                      {s}
                    </button>
                  ))}
                </div>

                <div className="rounded-lg bg-muted border mt-4 p-3">
                  <div className="font-semibold text-sm">Sports Day notice</div>
                  <p className="text-muted-foreground text-sm mt-1">
                    Dear parents, our Annual Sports Day is on 28 October. Please ensure
                    students arrive in house colours by 8:30 AM.
                  </p>
                  <div className="flex mt-3 gap-2">
                    <button type="button" className="rounded-lg text-sm font-normal border px-3 py-2">
                      Edit
                    </button>
                    <button
                      type="button"
                      className="rounded-lg bg-primary text-primary-foreground text-sm font-normal px-3 py-2"
                    >
                      Post to parents
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setAiOpen(false)}
                  className="rounded-lg text-sm font-normal border mt-4 w-full h-11"
                >
                  Close
                </button>
              </section>
            </div>
          )}
        </div>
      </div>
  );
}
