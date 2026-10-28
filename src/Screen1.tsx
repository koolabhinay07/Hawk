import { useEffect, useRef, useState } from "react";
import {
  Bell,
  BookOpen,
  Check,
  CheckCheck,
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
import { allowRetroactiveMarking, getNextWorkingDay, getPeriodState, getScheduleMinute, getTodaysAttendanceSummary, hasAttendanceRights, schoolClosedDays, timetable as defaultTimetable, type AttendanceRecord, type TimetablePeriod } from "./timetable";

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
const proxyRequestWindowMinutes = 10;
type HeroSelection = {
  kind: "active" | "grace" | "upcoming" | "marked" | "dayComplete" | "dayEnded";
  periodId?: string;
};

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

function getAttendanceRecordKey(period: TimetablePeriod) {
  return `${period.period}:${period.startMinute}`;
}

function formatScheduleTime(minute: number) {
  const hour24 = Math.floor(minute / 60);
  const minutePart = minute % 60;
  const hour12 = hour24 % 12 || 12;
  const meridiem = hour24 < 12 ? "AM" : "PM";
  return `${hour12}:${String(minutePart).padStart(2, "0")} ${meridiem}`;
}

function formatPeriodTime(startMinute: number, endMinute: number) {
  const start = formatScheduleTime(startMinute);
  const end = formatScheduleTime(endMinute);
  const startMeridiem = start.slice(-2);
  const endMeridiem = end.slice(-2);
  return startMeridiem === endMeridiem
    ? `${start.slice(0, -3)}–${end}`
    : `${start}–${end}`;
}

function buildResetTimetable(periods: TimetablePeriod[], firstStartMinute: number) {
  const endOfDayMinute = 1439;
  return periods.map((period, index) => {
    const startMinute = Math.min(firstStartMinute + index * 5, endOfDayMinute);
    const endMinute = Math.min(firstStartMinute + index * 5 + 3, endOfDayMinute);
    return { ...period, startMinute, endMinute, time: formatPeriodTime(startMinute, endMinute) };
  });
}

function loadTimetable(dateKey: string): TimetablePeriod[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(`hawk-timetable-v2:${dateKey}`) ?? "null");
    if (!Array.isArray(parsed) || parsed.length !== defaultTimetable.length) return defaultTimetable;
    const storedPeriods = parsed as Partial<TimetablePeriod>[];
    const firstPeriod = storedPeriods.find((period) => period.period === "P1");
    if (!firstPeriod || !Number.isInteger(firstPeriod.startMinute) || (firstPeriod.startMinute as number) < 0 || (firstPeriod.startMinute as number) >= 1440) return defaultTimetable;
    return buildResetTimetable(defaultTimetable, firstPeriod.startMinute as number);
  } catch {
    return defaultTimetable;
  }
}

function loadAttendanceRecords(dateKey: string, periods: TimetablePeriod[]): Record<string, AttendanceRecord> {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(`hawk-attendance-records:${dateKey}`) ?? "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).flatMap(([recordKey, value]) => {
      if (!value || typeof value !== "object") return [];
      const period = periods.find((item) => getAttendanceRecordKey(item) === recordKey);
      const record = value as Partial<AttendanceRecord>;
      if (!period || record.marked !== true || record.periodStartMinute !== period.startMinute || !Number.isFinite(record.markedAt)) return [];
      const markedAt = new Date(record.markedAt as number);
      if (getAttendanceDateKey(markedAt) !== dateKey || getScheduleMinute(markedAt) < period.startMinute) return [];
      if (!Number.isInteger(record.present) || !Number.isInteger(record.total) || (record.present ?? -1) < 0 || (record.total ?? 0) < 1 || (record.present ?? Infinity) > (record.total ?? -1)) return [];
      return [[period.period, record as AttendanceRecord]];
    }));
  } catch {
    return {};
  }
}

function loadConductedPeriods(dateKey: string, periods: TimetablePeriod[]): Record<string, number> {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(`hawk-conducted-periods:${dateKey}`) ?? "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).filter(([periodId, value]) => {
      const period = periods.find((item) => item.period === periodId);
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

type SwapRequest = {
  id: string;
  period: string;
  requesterName: string;
  recipientName: string;
  status: "pending" | "accepted" | "declined" | "expired";
  requestedAt: number;
  acceptedAt?: number;
  requesterSubject: string;
  requesterDetails: string;
  requesterStudents?: number;
  recipientSubject?: string;
  recipientDetails?: string;
  recipientStudents?: number;
};

function parseSwapRequests(raw: string | null, periods: TimetablePeriod[]): SwapRequest[] {
  try {
    const parsed: unknown = JSON.parse(raw ?? "[]");
    if (!Array.isArray(parsed)) return [];
    const periodIds = new Set(periods.map((period) => period.period));
    return parsed.filter((value): value is SwapRequest => {
      if (!value || typeof value !== "object") return false;
      const request = value as Partial<SwapRequest>;
      return typeof request.id === "string" && typeof request.period === "string" && periodIds.has(request.period) &&
        typeof request.requesterName === "string" && typeof request.recipientName === "string" &&
        ["pending", "accepted", "declined", "expired"].includes(request.status ?? "") &&
        Number.isFinite(request.requestedAt) && typeof request.requesterSubject === "string" && typeof request.requesterDetails === "string";
    });
  } catch {
    return [];
  }
}

function loadSwapRequests(dateKey: string, periods: TimetablePeriod[]) {
  try {
    return parseSwapRequests(window.localStorage.getItem(`hawk-swap-requests:${dateKey}`), periods);
  } catch {
    return [];
  }
}

function parseProxyRequests(raw: string | null, periods: TimetablePeriod[]): Record<string, ProxyRequest> {
  try {
    const parsed: unknown = JSON.parse(raw ?? "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).filter(([periodId, value]) => {
      if (!periods.some((period) => period.period === periodId) || !value || typeof value !== "object") return false;
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

function loadProxyRequests(dateKey: string, periods: TimetablePeriod[]) {
  try {
    return parseProxyRequests(window.localStorage.getItem(`hawk-proxy-requests:${dateKey}`), periods);
  } catch {
    return {};
  }
}

function getProxyRequestStatus(request: ProxyRequest | undefined, period: TimetablePeriod, dateKey: string, scheduleMinute: number) {
  if (!request) return undefined;
  if (!Number.isFinite(request.requestedAt)) return undefined;
  const requestedAt = new Date(request.requestedAt as number);
  if (getAttendanceDateKey(requestedAt) !== dateKey || getScheduleMinute(requestedAt) >= period.startMinute) return undefined;
  if (request.status === "expired") return scheduleMinute >= period.startMinute ? "expired" as const : undefined;
  if (request.status === "accepted") {
    if (request.acceptedAt === undefined) return scheduleMinute >= period.startMinute ? "expired" as const : "accepted" as const;
    const acceptedAt = new Date(request.acceptedAt);
    if (getAttendanceDateKey(acceptedAt) !== dateKey || getScheduleMinute(acceptedAt) >= period.startMinute) {
      return scheduleMinute >= period.startMinute ? "expired" as const : undefined;
    }
    return "accepted" as const;
  }
  return scheduleMinute >= period.startMinute ? "expired" as const : "pending" as const;
}

function isMissedPeriod(
  periodState: ReturnType<typeof getPeriodState>,
  attendance: AttendanceRecord | undefined,
  canMarkAttendance: boolean,
  isConducted: boolean,
) {
  return !attendance && periodState === "done" && (canMarkAttendance || !isConducted);
}

function getOwnClassSummary(period: TimetablePeriod) {
  const className = period.details.split(" · ")[0].replace(/-(?=[A-Z])/g, " ");
  return period.students === undefined ? period.details : `${className} · ${period.students} students`;
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
  const [timetable, setTimetable] = useState<TimetablePeriod[]>(() => loadTimetable(attendanceDateKey));
  const [loadedTimetableDateKey, setLoadedTimetableDateKey] = useState(attendanceDateKey);
  const [attendanceRecords, setAttendanceRecords] = useState<Record<string, AttendanceRecord>>(() => loadAttendanceRecords(attendanceDateKey, timetable));
  const [loadedAttendanceDateKey, setLoadedAttendanceDateKey] = useState(attendanceDateKey);
  const [conductedPeriods, setConductedPeriods] = useState<Record<string, number>>(() => loadConductedPeriods(attendanceDateKey, timetable));
  const [loadedConductedDateKey, setLoadedConductedDateKey] = useState(attendanceDateKey);
  const [proxyRequests, setProxyRequests] = useState<Record<string, ProxyRequest>>(() => loadProxyRequests(attendanceDateKey, timetable));
  const [loadedProxyDateKey, setLoadedProxyDateKey] = useState(attendanceDateKey);
  const [swapRequests, setSwapRequests] = useState<SwapRequest[]>(() => loadSwapRequests(attendanceDateKey, timetable));
  const [loadedSwapDateKey, setLoadedSwapDateKey] = useState(attendanceDateKey);
  const [proxyNotification, setProxyNotification] = useState("");
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [developerMode, setDeveloperMode] = useState(() => window.localStorage.getItem("hawk-developer-mode") === "enabled");
  const [developerPasswordOpen, setDeveloperPasswordOpen] = useState(false);
  const [developerPassword, setDeveloperPassword] = useState("");
  const [developerPasswordError, setDeveloperPasswordError] = useState("");
  const [swapDialogTarget, setSwapDialogTarget] = useState<TimetablePeriod | null>(null);
  const [swapRecipientName, setSwapRecipientName] = useState("");
  const [swapDialogError, setSwapDialogError] = useState("");
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
  const effectiveTimetable = timetable.map((period) => {
    const swap = swapRequests.find((request) => request.period === period.period && request.status === "accepted" &&
      (request.requesterName.toLocaleLowerCase() === teacherName.trim().toLocaleLowerCase() || request.recipientName.toLocaleLowerCase() === teacherName.trim().toLocaleLowerCase()));
    if (!swap) return period;
    const isRequester = swap.requesterName.toLocaleLowerCase() === teacherName.trim().toLocaleLowerCase();
    const otherName = isRequester ? swap.recipientName : swap.requesterName;
    const otherSubject = isRequester ? swap.recipientSubject : swap.requesterSubject;
    const otherDetails = isRequester ? swap.recipientDetails : swap.requesterDetails;
    const otherStudents = isRequester ? swap.recipientStudents : swap.requesterStudents;
    const className = otherDetails?.split(" · ")[0] ?? "Class";
    return {
      ...period,
      subject: otherSubject ?? period.subject,
      details: `Taking ${className} · Swapped with ${otherName}`,
      students: otherStudents,
      isOwnClass: false,
      isProxy: false,
      isSwap: true,
      swappedWith: otherName,
    };
  });
  const firstScheduledPeriod = [...effectiveTimetable].sort((a, b) => a.startMinute - b.startMinute)[0];
  const visibleAttendanceRecords = Object.fromEntries(Object.entries(attendanceRecords).filter(([periodId]) => {
    const period = effectiveTimetable.find((item) => item.period === periodId);
    return period !== undefined && scheduleMinute >= period.startMinute;
  }));
  const periodStatuses = effectiveTimetable.map((period) => {
    const attendance = visibleAttendanceRecords[period.period];
    const state = getPeriodState(period, scheduleMinute);
    const canMarkAttendance = hasAttendanceRights(period, proxyAttendanceRights);
    const proxyRequestStatus = getProxyRequestStatus(proxyRequests[period.period], period, attendanceDateKey, scheduleMinute);
    const isConducted = isPeriodConducted(period, conductedPeriods, attendanceDateKey, scheduleMinute);
    const isSelfConducted = proxyRequestStatus === "expired" && isConducted && !period.isProxy;
    const isRequestExpired = proxyRequestStatus === "expired" && !isConducted && state !== "done";
    const isMissed = isMissedPeriod(state, attendance, canMarkAttendance, isConducted);
    const isAttendancePending = canMarkAttendance && !attendance && state === "grace";
    return { period, attendance, state, canMarkAttendance, proxyRequestStatus, isConducted, isSelfConducted, isRequestExpired, isMissed, isAttendancePending };
  });
  const activePeriodIndex = effectiveTimetable.findIndex((period) => scheduleMinute >= period.startMinute && scheduleMinute < period.endMinute);
  const activePeriod = activePeriodIndex >= 0 ? effectiveTimetable[activePeriodIndex] : undefined;
  const gracePeriodStatus = periodStatuses
    .filter(({ state, canMarkAttendance, attendance, isConducted }) =>
      state === "grace" && ((canMarkAttendance && !attendance) || (!canMarkAttendance && !isConducted)),
    )
    .sort((a, b) => b.period.startMinute - a.period.startMinute)[0];
  const nextUpcomingPeriod = effectiveTimetable.find((period) => period.startMinute > scheduleMinute);
  const recentlyMarkedPeriod = !activePeriod
    ? effectiveTimetable
        .filter((period) => getPeriodState(period, scheduleMinute) === "grace" && visibleAttendanceRecords[period.period])
        .sort((a, b) => b.startMinute - a.startMinute)[0]
    : undefined;
  const heroPeriod = activePeriod ?? gracePeriodStatus?.period ?? nextUpcomingPeriod ?? recentlyMarkedPeriod ?? effectiveTimetable[effectiveTimetable.length - 1];
  const cancelableProxyRequestPeriod = effectiveTimetable.find((period) =>
    getProxyRequestStatus(proxyRequests[period.period], period, attendanceDateKey, scheduleMinute) === "pending",
  );
  const cancelableSwapRequest = swapRequests.find((request) =>
    request.status === "pending" && request.requesterName.toLocaleLowerCase() === teacherName.trim().toLocaleLowerCase(),
  );
  const attendanceSummary = getTodaysAttendanceSummary(effectiveTimetable, scheduleMinute, visibleAttendanceRecords, proxyAttendanceRights);
  const { dayComplete } = attendanceSummary;
  const allPeriodsEnded = effectiveTimetable.length > 0 && scheduleMinute >= Math.max(...effectiveTimetable.map((period) => period.endMinute));
  const takenPeriodCount = periodStatuses.filter(({ period, attendance, canMarkAttendance, isConducted }) =>
    period.isSwap || isConducted || (canMarkAttendance && Boolean(attendance)),
  ).length;
  const missedPeriodCount = dayComplete ? periodStatuses.filter(({ isMissed }) => isMissed).length : 0;
  const attendanceDutyCount = periodStatuses.filter(({ canMarkAttendance }) => canMarkAttendance).length;
  const attendanceMarkedCount = periodStatuses.filter(({ canMarkAttendance, attendance }) => canMarkAttendance && Boolean(attendance)).length;
  const dailySummarySuffix = dayComplete
    ? missedPeriodCount > 0 ? ` · ${missedPeriodCount} ${missedPeriodCount === 1 ? "class" : "classes"} missed` : ""
    : attendanceSummary.headerCount > 0 ? ` · ${attendanceSummary.headerCount} ${attendanceSummary.headerLabel}` : "";
  const nextWorkingDay = getNextWorkingDay(clock, schoolClosedDays);
  const desiredHeroSelection: HeroSelection = allPeriodsEnded && !gracePeriodStatus
    ? { kind: "dayEnded" }
    : dayComplete
      ? { kind: "dayComplete" }
      : activePeriod
        ? { kind: "active", periodId: activePeriod.period }
        : gracePeriodStatus
          ? { kind: "grace", periodId: gracePeriodStatus.period.period }
          : nextUpcomingPeriod
            ? { kind: "upcoming", periodId: nextUpcomingPeriod.period }
            : recentlyMarkedPeriod
              ? { kind: "marked", periodId: recentlyMarkedPeriod.period }
              : heroPeriod
                ? { kind: "upcoming", periodId: heroPeriod.period }
                : { kind: "dayEnded" };
  const shownHeroSelection = desiredHeroSelection;
  const shownHeroPeriod = shownHeroSelection.periodId
    ? effectiveTimetable.find((period) => period.period === shownHeroSelection.periodId)
    : undefined;
  const shownHeroStatus = shownHeroPeriod
    ? periodStatuses.find(({ period }) => period.period === shownHeroPeriod.period)
    : undefined;
  const shownActivePeriod = shownHeroSelection.kind === "active" ? shownHeroPeriod : undefined;
  const shownGracePeriodStatus = shownHeroSelection.kind === "grace" ? shownHeroStatus : undefined;
  const shownActiveAttendance = shownHeroStatus?.attendance;
  const shownActiveConducted = shownHeroStatus?.isConducted ?? false;
  const dashboardDate = new Intl.DateTimeFormat("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Asia/Kolkata",
  }).format(clock);
  const mainContentRef = useRef<HTMLElement>(null);
  const attendanceDialogRef = useRef<HTMLDialogElement>(null);
  const resetDialogRef = useRef<HTMLDialogElement>(null);
  const developerPasswordDialogRef = useRef<HTMLDialogElement>(null);
  const swapDialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const refreshClock = () => setClock(new Date());
    const timer = window.setInterval(refreshClock, 1_000);
    document.addEventListener("visibilitychange", refreshClock);
    window.addEventListener("focus", refreshClock);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshClock);
      window.removeEventListener("focus", refreshClock);
    };
  }, []);

  useEffect(() => {
    if (loadedTimetableDateKey === attendanceDateKey) return;
    const nextTimetable = loadTimetable(attendanceDateKey);
    setTimetable(nextTimetable);
    setAttendanceRecords(loadAttendanceRecords(attendanceDateKey, nextTimetable));
    setConductedPeriods(loadConductedPeriods(attendanceDateKey, nextTimetable));
    setProxyRequests(loadProxyRequests(attendanceDateKey, nextTimetable));
    setSwapRequests(loadSwapRequests(attendanceDateKey, nextTimetable));
    setLoadedTimetableDateKey(attendanceDateKey);
    setLoadedAttendanceDateKey(attendanceDateKey);
    setLoadedConductedDateKey(attendanceDateKey);
    setLoadedProxyDateKey(attendanceDateKey);
    setLoadedSwapDateKey(attendanceDateKey);
  }, [attendanceDateKey, loadedTimetableDateKey]);

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
  }, [scheduleMinute, timetable]);

  useEffect(() => {
    setSwapRequests((requests) => {
      let changed = false;
      const next = requests.map((request) => {
        const period = timetable.find((item) => item.period === request.period);
        if (request.status !== "pending" || !period || scheduleMinute < period.startMinute) return request;
        changed = true;
        return { ...request, status: "expired" as const };
      });
      return changed ? next : requests;
    });
  }, [scheduleMinute, timetable]);

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
    if (loadedConductedDateKey !== attendanceDateKey) return;
    try {
      const storageKey = `hawk-conducted-periods:${attendanceDateKey}`;
      if (Object.keys(conductedPeriods).length > 0) window.localStorage.setItem(storageKey, JSON.stringify(conductedPeriods));
      else window.localStorage.removeItem(storageKey);
    } catch {
      // Conducted state remains available for this session if browser storage is unavailable.
    }
  }, [attendanceDateKey, conductedPeriods, loadedConductedDateKey]);

  useEffect(() => {
    if (loadedAttendanceDateKey !== attendanceDateKey) return;
    const recordsForStorage = Object.fromEntries(Object.entries(attendanceRecords).flatMap(([periodId, record]) => {
      const period = timetable.find((item) => item.period === periodId);
      if (!period || record.periodStartMinute !== period.startMinute || !record.markedAt) return [];
      return [[getAttendanceRecordKey(period), { ...record, marked: true, periodStartMinute: period.startMinute }]];
    }));
    try {
      const storageKey = `hawk-attendance-records:${attendanceDateKey}`;
      if (Object.keys(recordsForStorage).length > 0) window.localStorage.setItem(storageKey, JSON.stringify(recordsForStorage));
      else window.localStorage.removeItem(storageKey);
    } catch {
      // Attendance remains available for this session if browser storage is unavailable.
    }
  }, [attendanceDateKey, attendanceRecords, loadedAttendanceDateKey]);

  useEffect(() => {
    if (loadedProxyDateKey !== attendanceDateKey) return;
    try {
      const storageKey = `hawk-proxy-requests:${attendanceDateKey}`;
      if (Object.keys(proxyRequests).length > 0) window.localStorage.setItem(storageKey, JSON.stringify(proxyRequests));
      else window.localStorage.removeItem(storageKey);
    } catch {
      // Proxy requests remain available for this session if browser storage is unavailable.
    }
  }, [attendanceDateKey, loadedProxyDateKey, proxyRequests, timetable]);

  useEffect(() => {
    if (loadedSwapDateKey !== attendanceDateKey) return;
    try {
      const storageKey = `hawk-swap-requests:${attendanceDateKey}`;
      if (swapRequests.length > 0) window.localStorage.setItem(storageKey, JSON.stringify(swapRequests));
      else window.localStorage.removeItem(storageKey);
    } catch {
      // Swap requests remain available for this session if local storage is unavailable.
    }
  }, [attendanceDateKey, loadedSwapDateKey, swapRequests]);

  useEffect(() => {
    const storageKey = `hawk-swap-requests:${attendanceDateKey}`;
    function handleSwapRequestUpdate(event: StorageEvent) {
      if (event.key !== storageKey || loadedSwapDateKey !== attendanceDateKey) return;
      const incoming = parseSwapRequests(event.newValue, timetable);
      const nameKey = teacherName.trim().toLocaleLowerCase();
      const receivedNewRequest = incoming.find((request) => request.status === "pending" && request.recipientName.toLocaleLowerCase() === nameKey &&
        !swapRequests.some((existing) => existing.id === request.id));
      if (receivedNewRequest && typeof Notification !== "undefined" && Notification.permission === "granted") {
        new Notification("Period swap request", { body: `${receivedNewRequest.requesterName} requested to swap ${receivedNewRequest.period}.` });
      }
      if (receivedNewRequest) setProxyNotification(`${receivedNewRequest.requesterName} requested a swap for ${receivedNewRequest.period}.`);
      setSwapRequests(incoming);
    }
    window.addEventListener("storage", handleSwapRequestUpdate);
    return () => window.removeEventListener("storage", handleSwapRequestUpdate);
  }, [attendanceDateKey, loadedSwapDateKey, swapRequests, teacherName, timetable]);

  useEffect(() => {
    if (!proxyNotification) return;
    const timer = window.setTimeout(() => setProxyNotification(""), 6500);
    return () => window.clearTimeout(timer);
  }, [proxyNotification]);

  useEffect(() => {
    const storageKey = `hawk-proxy-requests:${attendanceDateKey}`;
    function handleProxyRequestUpdate(event: StorageEvent) {
      if (event.key !== storageKey || loadedProxyDateKey !== attendanceDateKey) return;
      const incoming = parseProxyRequests(event.newValue, timetable);
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
  }, [attendanceDateKey, loadedProxyDateKey, proxyRequests, timetable]);

  useEffect(() => {
    const dialog = attendanceDialogRef.current;
    if (!dialog) return;
    if (attendanceTarget && !dialog.open) {
      dialog.showModal();
      dialog.querySelector<HTMLInputElement>("input")?.focus();
    }
    if (!attendanceTarget && dialog.open) dialog.close();
  }, [attendanceTarget]);

  useEffect(() => {
    const dialog = resetDialogRef.current;
    if (!dialog) return;
    if (resetDialogOpen && !dialog.open) dialog.showModal();
    if (!resetDialogOpen && dialog.open) dialog.close();
  }, [resetDialogOpen]);

  useEffect(() => {
    const dialog = swapDialogRef.current;
    if (!dialog) return;
    if (swapDialogTarget && !dialog.open) {
      dialog.showModal();
      dialog.querySelector<HTMLInputElement>("input")?.focus();
    }
    if (!swapDialogTarget && dialog.open) dialog.close();
  }, [swapDialogTarget]);

  useEffect(() => {
    const dialog = developerPasswordDialogRef.current;
    if (!dialog) return;
    if (developerPasswordOpen && !dialog.open) {
      dialog.showModal();
      dialog.querySelector<HTMLInputElement>("input")?.focus();
    }
    if (!developerPasswordOpen && dialog.open) dialog.close();
  }, [developerPasswordOpen]);

  function openAttendance(period: TimetablePeriod) {
    if (scheduleMinute < period.startMinute) return;
    const record = visibleAttendanceRecords[period.period];
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

  function openSwapRequest(period: TimetablePeriod) {
    setSwapDialogTarget(period);
    setSwapRecipientName("");
    setSwapDialogError("");
  }

  function submitSwapRequest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const recipientName = swapRecipientName.trim();
    if (!swapDialogTarget || !recipientName) {
      setSwapDialogError("Enter the teacher’s name to request a swap.");
      return;
    }
    if (recipientName.toLocaleLowerCase() === teacherName.trim().toLocaleLowerCase()) {
      setSwapDialogError("Choose another teacher for the swap.");
      return;
    }
    const existingRequest = swapRequests.find((request) => request.period === swapDialogTarget.period && request.status === "pending");
    if (existingRequest) {
      setSwapDialogError("A swap request is already pending for this period.");
      return;
    }
    const request: SwapRequest = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      period: swapDialogTarget.period,
      requesterName: teacherName.trim(),
      recipientName,
      status: "pending",
      requestedAt: Date.now(),
      requesterSubject: swapDialogTarget.subject,
      requesterDetails: swapDialogTarget.details,
      requesterStudents: swapDialogTarget.students,
    };
    setSwapRequests((requests) => [...requests.filter((item) => item.period !== request.period || item.status !== "pending"), request]);
    setSwapDialogTarget(null);
    if (typeof Notification !== "undefined" && Notification.permission === "default") void Notification.requestPermission();
  }

  function respondToSwapRequest(requestId: string, accept: boolean) {
    const request = swapRequests.find((item) => item.id === requestId);
    if (!request) return;
    const period = timetable.find((item) => item.period === request.period);
    if (!period) return;
    if (scheduleMinute >= period.startMinute) {
      setSwapRequests((requests) => requests.map((item) => item.id === requestId ? { ...item, status: "expired" } : item));
      return;
    }
    setSwapRequests((requests) => requests.map((item) => item.id === requestId ? {
      ...item,
      status: accept ? "accepted" : "declined",
      acceptedAt: accept ? Date.now() : undefined,
      ...(accept ? { recipientSubject: period.subject, recipientDetails: period.details, recipientStudents: period.students } : {}),
    } : item));
  }

  function cancelProxyRequest(period: TimetablePeriod) {
    setProxyRequests((requests) => {
      const next = { ...requests };
      delete next[period.period];
      return next;
    });
  }

  function cancelSwapRequest(requestId: string) {
    setSwapRequests((requests) => requests.filter((request) => request.id !== requestId));
  }

  function resetPeriods() {
    const resetAt = new Date();
    const resetDateKey = getAttendanceDateKey(resetAt);
    const proposedStart = getScheduleMinute(resetAt) + 2;
    const startMinute = Math.min(proposedStart, 1439);
    const wasCapped = proposedStart + 29 > 1439;
    const nextTimetable = buildResetTimetable(timetable, startMinute);
    const p1Start = formatScheduleTime(nextTimetable[0].startMinute);
    const notice = wasCapped
      ? `Periods reset. P1 starts at ${p1Start}. Schedule capped at end of day.`
      : `Periods reset. P1 starts at ${p1Start}.`;
    try {
      window.localStorage.setItem(`hawk-timetable-v2:${resetDateKey}`, JSON.stringify(nextTimetable));
      window.localStorage.removeItem(`hawk-attendance-records:${resetDateKey}`);
      window.localStorage.removeItem(`hawk-conducted-periods:${resetDateKey}`);
    } catch {
      // The reset still applies for this session if local storage is unavailable.
    }
    setClock(resetAt);
    setTimetable(nextTimetable);
    setLoadedTimetableDateKey(resetDateKey);
    setLoadedAttendanceDateKey(resetDateKey);
    setLoadedConductedDateKey(resetDateKey);
    setLoadedProxyDateKey(resetDateKey);
    setAttendanceRecords({});
    setConductedPeriods({});
    if (resetDateKey !== attendanceDateKey) setProxyRequests(loadProxyRequests(resetDateKey, timetable));
    setResetDialogOpen(false);
    setProxyNotification(notice);
  }

  function unlockDeveloperMode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (developerPassword !== "8990") {
      setDeveloperPasswordError("Incorrect password. Please try again.");
      return;
    }
    window.localStorage.setItem("hawk-developer-mode", "enabled");
    setDeveloperMode(true);
    setDeveloperPassword("");
    setDeveloperPasswordError("");
    setDeveloperPasswordOpen(false);
    setResetDialogOpen(true);
  }

  function toggleDeveloperMode() {
    if (developerMode) {
      window.localStorage.removeItem("hawk-developer-mode");
      setDeveloperMode(false);
      return;
    }
    setDeveloperPassword("");
    setDeveloperPasswordError("");
    setDeveloperPasswordOpen(true);
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
                {!allPeriodsEnded && <MetaText className="text-muted-foreground text-sm md:pb-1" value={`${attendanceSummary.totalClassCount} classes today${dailySummarySuffix}`} />}
              </section>

              <div className="grid gap-7 md:grid-cols-[minmax(0,1.55fr)_minmax(300px,0.9fr)] md:gap-8">
              <div className="flex min-w-0 flex-col gap-7 md:gap-8">

              <section
                data-ai-obstacle
                className={`rounded-[28px] p-5 md:p-6 ${shownHeroSelection.kind === "dayComplete" || shownHeroSelection.kind === "dayEnded" ? "border border-border bg-card text-foreground" : "bg-primary-container text-on-primary-container"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    {shownHeroSelection.kind === "dayEnded" ? (
                      <>
                        <h2 className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
                          No more classes<br className="sm:hidden" /> today
                        </h2>
                        {dayComplete && (
                          <>
                            <p className="mt-3 flex items-center text-sm text-muted-foreground">
                              {takenPeriodCount} of {attendanceSummary.totalClassCount} periods taken
                              <span aria-hidden="true" className="mx-2 inline-block size-1 rounded-full bg-current" />
                              <span className={missedPeriodCount > 0 ? "font-medium text-[#7D3F13]" : ""}>{missedPeriodCount} missed</span>
                            </p>
                            {attendanceDutyCount > 0 && (
                              <p className="mt-2 text-sm text-muted-foreground">Attendance marked: {attendanceMarkedCount} of {attendanceDutyCount}</p>
                            )}
                          </>
                        )}
                      </>
                    ) : shownHeroSelection.kind === "dayComplete" ? (
                      <>
                        <div className="flex items-center gap-2 text-sm font-semibold tracking-[0.04em] text-muted-foreground">
                          <Check aria-hidden="true" className="size-3.5" />
                          DAY COMPLETE
                        </div>
                        <p className="mt-2 flex items-center text-sm text-muted-foreground">
                          {takenPeriodCount} of {attendanceSummary.totalClassCount} periods taken
                          <span aria-hidden="true" className="mx-2 inline-block size-1 rounded-full bg-current" />
                          <span className={missedPeriodCount > 0 ? "font-medium text-[#7D3F13]" : ""}>{missedPeriodCount} missed</span>
                        </p>
                        {attendanceDutyCount > 0 && (
                          <p className="mt-2 text-sm text-muted-foreground">Attendance marked: {attendanceMarkedCount} of {attendanceDutyCount}</p>
                        )}
                        {firstScheduledPeriod && (
                          <MetaText
                            className="mt-2 block text-sm"
                            value={`Next class: ${nextWorkingDay.label}`}
                          />
                        )}
                      </>
                    ) : shownActivePeriod && shownHeroStatus ? (
                      <>
                        <div className="flex items-center gap-2 text-sm font-semibold tracking-[0.04em] text-on-primary-container">
                          {shownActiveAttendance || (shownActivePeriod.period !== "P1" && shownActiveConducted)
                            ? <CheckCheck aria-hidden="true" className="size-3.5" />
                            : <Clock aria-hidden="true" className="size-3.5" />}
                          {shownActiveAttendance ? "Attendance marked" : shownActivePeriod.period === "P1" ? "Attendance pending" : shownActiveConducted ? "Conducted" : "Ongoing"}
                        </div>
                        {shownActivePeriod.isOwnClass ? (
                          <>
                            <h2 className="mt-2 text-base font-semibold tracking-tight">{shownActivePeriod.period}<span aria-hidden="true" className="mx-2 inline-block size-1.5 rounded-full bg-current align-middle" />{shownActivePeriod.subject}</h2>
                            <p className="mt-2 text-sm font-semibold text-on-primary-container">Your Class</p>
                            <MetaText className="text-sm font-medium text-on-primary-container/80" value={getOwnClassSummary(shownActivePeriod)} />
                          </>
                        ) : (
                          <>
                            <h2 className="mt-2 text-base font-semibold tracking-tight">{shownActivePeriod.period}<span aria-hidden="true" className="mx-2 inline-block size-1.5 rounded-full bg-current align-middle" />{shownActivePeriod.subject}</h2>
                            <MetaText className="text-sm text-on-primary-container/80" value={shownActivePeriod.details} />
                          </>
                        )}
                      </>
                    ) : shownGracePeriodStatus ? (
                      <>
                        <div className="flex items-center gap-2 text-sm font-semibold tracking-[0.04em] text-on-primary-container">
                          {shownGracePeriodStatus.attendance || shownGracePeriodStatus.isConducted
                            ? <CheckCheck aria-hidden="true" className="size-3.5" />
                            : <Clock aria-hidden="true" className="size-3.5" />}
                          {shownGracePeriodStatus.attendance
                            ? "Attendance marked"
                            : shownGracePeriodStatus.isConducted
                              ? "Conducted"
                              : shownGracePeriodStatus.isMissed
                                ? "Missed"
                              : shownGracePeriodStatus.canMarkAttendance
                                ? "Attendance pending"
                                : "Grace period"}
                        </div>
                        {shownGracePeriodStatus.period.isOwnClass ? (
                          <>
                            <h2 className="mt-2 text-base font-semibold tracking-tight">{shownGracePeriodStatus.period.period}<span aria-hidden="true" className="mx-2 inline-block size-1.5 rounded-full bg-current align-middle" />{shownGracePeriodStatus.period.subject}</h2>
                            <p className="mt-2 text-sm font-semibold text-on-primary-container">Your Class</p>
                            <MetaText className="text-sm font-medium text-on-primary-container/80" value={getOwnClassSummary(shownGracePeriodStatus.period)} />
                          </>
                        ) : (
                          <>
                            <h2 className="mt-2 text-base font-semibold tracking-tight">{shownGracePeriodStatus.period.period}<span aria-hidden="true" className="mx-2 inline-block size-1.5 rounded-full bg-current align-middle" />{shownGracePeriodStatus.period.subject}</h2>
                            <MetaText className="text-sm text-on-primary-container/80" value={shownGracePeriodStatus.period.details} />
                          </>
                        )}
                      </>
                    ) : shownHeroPeriod ? (
                      <>
                        <div className="flex items-center gap-2 text-sm font-semibold tracking-[0.04em] text-on-primary-container">
                          {shownHeroSelection.kind === "marked"
                            ? <CheckCheck aria-hidden="true" className="size-3.5" />
                            : <Clock aria-hidden="true" className="size-3.5" />}
                          {shownHeroSelection.kind === "marked" ? "Attendance marked" : "Up next"}
                        </div>
                        {shownHeroPeriod.isOwnClass ? (
                          <>
                            <h2 className="mt-2 text-base font-semibold tracking-tight">{shownHeroPeriod.period}<span aria-hidden="true" className="mx-2 inline-block size-1.5 rounded-full bg-current align-middle" />{shownHeroPeriod.subject}</h2>
                            <p className="mt-2 text-sm font-semibold text-on-primary-container">Your Class</p>
                            <MetaText className="text-sm font-medium text-on-primary-container/80" value={getOwnClassSummary(shownHeroPeriod)} />
                          </>
                        ) : (
                          <>
                            <h2 className="mt-2 text-base font-semibold tracking-tight">{shownHeroPeriod.period}<span aria-hidden="true" className="mx-2 inline-block size-1.5 rounded-full bg-current align-middle" />{shownHeroPeriod.subject}</h2>
                            <MetaText className="text-sm text-on-primary-container/80" value={shownHeroPeriod.details} />
                          </>
                        )}
                      </>
                    ) : null}
                  </div>
                  {shownActivePeriod && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-card/75 px-3 py-1.5 text-[12px] font-medium text-status-foreground">
                      {shownActiveAttendance ? "Marked" : shownActiveConducted ? "Conducted" : "Now"}
                    </span>
                  )}
                </div>
                {shownHeroSelection.kind === "dayComplete" || shownHeroSelection.kind === "dayEnded" ? (
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
                ) : shownActivePeriod && shownHeroStatus?.canMarkAttendance && !shownActiveAttendance ? (
                  <button
                    type="button"
                    onClick={() => openAttendance(shownActivePeriod)}
                    className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-normal text-primary-foreground transition-colors hover:brightness-95"
                  >
                    Mark Attendance
                  </button>
                ) : shownActivePeriod && shownActivePeriod.period !== "P1" && !shownActiveConducted ? (
                  <button
                    type="button"
                    onClick={() => setConductedPeriods((periods) => ({ ...periods, [shownActivePeriod.period]: Date.now() }))}
                    className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-normal text-primary-foreground transition-colors hover:brightness-95"
                  >
                    Mark as Conducted
                  </button>
                ) : shownGracePeriodStatus && shownGracePeriodStatus.canMarkAttendance && !shownGracePeriodStatus.attendance ? (
                  <button
                    type="button"
                    onClick={() => openAttendance(shownGracePeriodStatus.period)}
                    className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-normal text-primary-foreground transition-colors hover:brightness-95"
                  >
                    Mark Attendance
                  </button>
                ) : shownGracePeriodStatus && !shownGracePeriodStatus.canMarkAttendance && !shownGracePeriodStatus.isConducted ? (
                  <button
                    type="button"
                    onClick={() => setConductedPeriods((periods) => ({ ...periods, [shownGracePeriodStatus.period.period]: Date.now() }))}
                    className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-full border-2 border-[#d6ae3b] bg-[#fff8e1] px-5 text-base font-semibold text-[#6b4f00] transition-colors hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    Mark class as conducted?
                  </button>
                ) : null}
                {!dayComplete && cancelableProxyRequestPeriod && (
                  <button
                    type="button"
                    onClick={() => cancelProxyRequest(cancelableProxyRequestPeriod)}
                    className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-full border-2 border-[#B85C68] bg-[#ffa5ab] px-5 text-base font-semibold text-[#B85C68] transition-colors hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    Cancel Request for {cancelableProxyRequestPeriod.period}
                  </button>
                )}
                {!dayComplete && cancelableSwapRequest && (
                  <button
                    type="button"
                    onClick={() => cancelSwapRequest(cancelableSwapRequest.id)}
                    className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-full border-2 border-[#B85C68] bg-[#ffa5ab] px-5 text-base font-semibold text-[#B85C68] transition-colors hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    Cancel Swap Request for {cancelableSwapRequest.period}
                  </button>
                )}
              </section>

              <section id="today-classes" data-ai-obstacle className="flex flex-col gap-3 scroll-mt-24">
                <div className="flex justify-between items-center">
                  <h2 className="text-base font-semibold tracking-tight">Today's classes</h2>
                  {!allPeriodsEnded && (
                    <button type="button" className="font-normal text-icon-accent text-sm hover:underline underline-offset-4">
                      View timetable
                    </button>
                  )}
                </div>

                <div className="overflow-hidden rounded-[24px] border border-border bg-card">
                  {periodStatuses.map(({ period: p, attendance, state: periodState, canMarkAttendance, proxyRequestStatus, isConducted, isSelfConducted, isRequestExpired, isMissed, isAttendancePending }, index) => {
                    const proxyRequest = proxyRequests[p.period];
                    const isProxyAccepted = proxyRequestStatus === "accepted";
                    const isPastPeriod = periodState === "grace" || periodState === "done";
                    const matchingSwap = swapRequests.find((request) => request.period === p.period &&
                      (request.requesterName.toLocaleLowerCase() === teacherName.trim().toLocaleLowerCase() || request.recipientName.toLocaleLowerCase() === teacherName.trim().toLocaleLowerCase()) &&
                      (request.status === "pending" || request.status === "accepted"));
                    const isOutgoingSwapPending = matchingSwap?.status === "pending" && matchingSwap.requesterName.toLocaleLowerCase() === teacherName.trim().toLocaleLowerCase();
                    const incomingSwapRequest = matchingSwap?.status === "pending" && matchingSwap.recipientName.toLocaleLowerCase() === teacherName.trim().toLocaleLowerCase() ? matchingSwap : undefined;
                    const canRequestProxy = p.period !== "P1" && p.isOwnClass === true && periodState === "upcoming" && scheduleMinute >= p.startMinute - proxyRequestWindowMinutes && !proxyRequestStatus;
                    const canRequestSwap = p.isOwnClass === true && periodState === "upcoming" && !matchingSwap && !p.isProxy;
                    const periodDetails = isProxyAccepted
                      ? `${p.details} · Covered by ${proxyRequest?.coveringTeacherName?.trim() || "Covering teacher"}`
                      : p.details;

                    return (
                      <div
                        key={p.period}
                        className={[
                          "flex items-start gap-3 px-4 py-4 transition-colors md:px-5",
                          index < timetable.length - 1 ? "border-b" : "",
                          periodState === "running" ? "bg-primary-soft" : isPastPeriod ? "bg-[#f3f4f3]" : "bg-card",
                        ].join(" ")}
                      >
                        <div className="flex w-28 shrink-0 flex-col gap-1 pt-0.5 tabular-nums">
                          <span aria-label={`Period ${index + 1}`} title={`Period ${index + 1}`} className={`text-sm font-medium ${isPastPeriod ? "text-[#68716c]" : "text-foreground"}`}>{p.period}</span>
                          <span className={`whitespace-nowrap text-sm font-normal ${isPastPeriod ? "text-[#68716c]" : "text-foreground"}`}>{p.time}</span>
                        </div>
                        <div className="grow min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`text-base font-semibold ${isPastPeriod ? "text-[#68716c]" : "text-foreground"}`}>{p.subject}</span>
                            {periodState === "running" && <span className="shrink-0 rounded-full bg-primary-container px-2.5 py-1 text-[12px] font-medium text-on-primary-container">Now</span>}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-2 md:gap-y-1">
                            <MetaText className={`${isPastPeriod ? "text-[#68716c]" : "text-foreground"} text-sm leading-relaxed`} value={periodDetails} />
                            {(p.isProxy || p.isSwap || isAttendancePending || isMissed || (!canMarkAttendance && isConducted) || proxyRequestStatus === "pending" || isRequestExpired || isSelfConducted || isProxyAccepted || isOutgoingSwapPending || incomingSwapRequest) && (
                              <span className={`inline-flex shrink-0 items-center gap-2 whitespace-nowrap ${p.isProxy ? "" : "basis-full md:basis-auto"} ${isPastPeriod ? "opacity-85" : ""}`}>
                                {p.isSwap && <span className="inline-flex rounded-full border border-[#47764f] bg-[#e8f3e8] px-2 py-0.5 text-[12px] font-medium text-[#47764f]">Swap</span>}
                                {p.isProxy && !isProxyAccepted && <span className="inline-flex rounded-full border border-secondary-foreground bg-secondary px-2 py-0.5 text-[12px] font-medium text-secondary-foreground">Proxy</span>}
                                {proxyRequestStatus === "pending" && <span className="inline-flex rounded-full border border-[#d6ae3b] bg-[#fff8e1] px-2 py-0.5 text-[12px] font-medium text-[#6b4f00]">Proxy pending</span>}
                                {isOutgoingSwapPending && <span className="inline-flex rounded-full border border-[#FCD34D] bg-[#FEF3C7] px-2 py-0.5 text-[12px] font-medium text-[#92400E]">Swap pending</span>}
                                {isRequestExpired && <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-[12px] font-medium text-muted-foreground">Request Expired</span>}
                                {isProxyAccepted && <span className="inline-flex rounded-full border border-secondary-foreground bg-secondary px-2 py-0.5 text-[12px] font-medium text-secondary-foreground">Proxy</span>}
                                {isAttendancePending && <span className="inline-flex rounded-full border border-[#d6ae3b] bg-[#fff8e1] px-2 py-0.5 text-[12px] font-medium text-[#6b4f00]">Attendance pending</span>}
                                {isMissed && <span className="inline-flex items-center gap-1 rounded-full border border-accent-foreground bg-accent px-2 py-0.5 text-[12px] font-medium text-accent-foreground">Missed</span>}
                                {isSelfConducted && <span className="inline-flex items-center rounded-full border border-[#47764f] bg-[#e8f3e8] px-2 py-0.5 text-[12px] font-medium text-[#47764f]">Self-conducted</span>}
                                {!p.isSwap && !isSelfConducted && !isRequestExpired && !isMissed && isConducted && <span className="inline-flex items-center rounded-full border border-[#47764f] bg-[#e8f3e8] px-2 py-0.5 text-[12px] font-medium text-[#47764f]">Conducted</span>}
                              </span>
                            )}
                          </div>
                          {incomingSwapRequest && (
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <span className="text-sm text-muted-foreground">Swap request from {incomingSwapRequest.requesterName}</span>
                              <button type="button" onClick={() => respondToSwapRequest(incomingSwapRequest.id, true)} className="inline-flex min-h-9 items-center rounded-full bg-primary px-3 text-sm font-medium text-primary-foreground">Accept</button>
                              <button type="button" onClick={() => respondToSwapRequest(incomingSwapRequest.id, false)} className="inline-flex min-h-9 items-center rounded-full border border-border px-3 text-sm font-medium text-foreground hover:bg-muted">Decline</button>
                            </div>
                          )}
                          {canRequestSwap && (
                            <button type="button" onClick={() => openSwapRequest(p)} className="mt-2 inline-flex min-h-9 items-center rounded-full border border-border px-3 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground">Request Swap</button>
                          )}
                          {canRequestProxy && (
                            <button
                              type="button"
                              onClick={() => requestProxy(p)}
                              className="mt-2 inline-flex min-h-9 w-fit self-start items-center justify-center whitespace-nowrap rounded-full border border-border bg-transparent px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                            >
                              Request Proxy
                            </button>
                          )}
                          {canMarkAttendance && attendance && periodState !== "upcoming" && (
                            <span className="mt-1.5 inline-flex items-center gap-1 text-sm font-normal text-[#245d42]">
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
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <h2 className="text-base font-semibold">Reset periods</h2>
                        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">Resets today’s timetable to start 2 minutes from now (IST).</p>
                        <p className="mt-1 text-xs font-medium text-muted-foreground">{developerMode ? "Developer mode enabled" : "Developer only"}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="text-sm font-normal text-muted-foreground">{developerMode ? "On" : "Off"}</span>
                        <button
                          type="button"
                          role="switch"
                          aria-label="Developer mode and reset periods"
                          aria-checked={developerMode}
                          onClick={toggleDeveloperMode}
                          className="relative flex h-11 w-[52px] shrink-0 items-center justify-center rounded-full transition-colors focus-visible:outline-offset-2"
                        >
                          <span className={`h-6 w-11 rounded-full transition-colors ${developerMode ? "bg-primary" : "bg-muted"}`} />
                          <span className={`absolute left-1.5 top-1/2 size-[18px] -translate-y-1/2 rounded-full bg-white shadow-sm transition-transform ${developerMode ? "translate-x-5" : "translate-x-0"}`} />
                        </button>
                      </div>
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
            ref={swapDialogRef}
            aria-labelledby="swap-request-title"
            onCancel={(event) => { event.preventDefault(); setSwapDialogTarget(null); setSwapDialogError(""); }}
            onClick={(event) => { if (event.target === swapDialogRef.current) { setSwapDialogTarget(null); setSwapDialogError(""); } }}
            className="m-auto w-[calc(100%-32px)] max-w-sm rounded-2xl border border-border bg-card p-0 text-foreground shadow-2xl backdrop:bg-foreground/50"
          >
            {swapDialogTarget && (
              <form onSubmit={submitSwapRequest} className="flex flex-col gap-4 p-5">
                <div>
                  <h2 id="swap-request-title" className="text-base font-semibold">Request a period swap</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{swapDialogTarget.period} · {swapDialogTarget.subject}</p>
                </div>
                <label htmlFor="swap-recipient" className="flex flex-col gap-1.5 text-sm font-medium">
                  Teacher’s name
                  <input id="swap-recipient" required value={swapRecipientName} onChange={(event) => { setSwapRecipientName(event.target.value); setSwapDialogError(""); }} className="min-h-12 rounded-xl border border-border bg-background px-4 text-base font-normal outline-none focus-visible:ring-2 focus-visible:ring-primary" />
                </label>
                {swapDialogError && <p role="alert" className="text-sm text-destructive">{swapDialogError}</p>}
                <div className="flex gap-2 pt-1">
                  <button type="button" onClick={() => setSwapDialogTarget(null)} className="min-h-11 flex-1 rounded-xl border border-border text-sm font-normal hover:bg-muted">Cancel</button>
                  <button type="submit" className="min-h-11 flex-1 rounded-xl bg-primary text-sm font-normal text-primary-foreground">Send request</button>
                </div>
              </form>
            )}
          </dialog>

          <dialog
            ref={developerPasswordDialogRef}
            aria-labelledby="developer-password-title"
            onCancel={(event) => { event.preventDefault(); setDeveloperPasswordOpen(false); setDeveloperPasswordError(""); setDeveloperPassword(""); }}
            onClick={(event) => { if (event.target === developerPasswordDialogRef.current) { setDeveloperPasswordOpen(false); setDeveloperPasswordError(""); setDeveloperPassword(""); } }}
            className="m-auto w-[calc(100%-32px)] max-w-sm rounded-2xl border border-border bg-card p-0 text-foreground shadow-2xl backdrop:bg-foreground/50"
          >
            <form onSubmit={unlockDeveloperMode} className="flex flex-col gap-4 p-5">
              <div>
                <h2 id="developer-password-title" className="text-base font-semibold">Developer access</h2>
                <p className="mt-1 text-sm text-muted-foreground">Enter the developer password to enable testing tools.</p>
              </div>
              <label className="flex flex-col gap-1.5 text-sm font-medium" htmlFor="developer-password">
                Password
                <input
                  id="developer-password"
                  type="password"
                  autoComplete="off"
                  value={developerPassword}
                  onChange={(event) => { setDeveloperPassword(event.target.value); setDeveloperPasswordError(""); }}
                  className="min-h-12 rounded-xl border border-border bg-background px-4 text-base font-normal outline-none focus-visible:ring-2 focus-visible:ring-primary"
                />
              </label>
              {developerPasswordError && <p role="alert" className="text-sm text-destructive">{developerPasswordError}</p>}
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => { setDeveloperPasswordOpen(false); setDeveloperPasswordError(""); setDeveloperPassword(""); }} className="min-h-11 flex-1 rounded-xl border border-border text-sm font-normal hover:bg-muted">Cancel</button>
                <button type="submit" className="min-h-11 flex-1 rounded-xl bg-primary text-sm font-normal text-primary-foreground">Continue</button>
              </div>
            </form>
          </dialog>

          <dialog
            ref={resetDialogRef}
            aria-labelledby="reset-periods-title"
            onCancel={(event) => { event.preventDefault(); setResetDialogOpen(false); }}
            onClick={(event) => { if (event.target === resetDialogRef.current) setResetDialogOpen(false); }}
            className="m-auto w-[calc(100%-32px)] max-w-sm rounded-2xl border border-border bg-card p-0 text-foreground shadow-2xl backdrop:bg-foreground/50"
          >
            <div className="flex flex-col gap-4 p-5">
              <div>
                <h2 id="reset-periods-title" className="text-base font-semibold">Reset today’s periods and clear today’s attendance data?</h2>
              </div>
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setResetDialogOpen(false)} className="min-h-11 flex-1 rounded-xl border border-border text-sm font-normal hover:bg-muted">Cancel</button>
                <button type="button" onClick={resetPeriods} className="min-h-11 flex-1 rounded-xl bg-primary text-sm font-normal text-primary-foreground">Reset</button>
              </div>
            </div>
          </dialog>

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
                  if (scheduleMinute < attendanceTarget.startMinute) return;
                  setAttendanceRecords((records) => ({
                    ...records,
                    [attendanceTarget.period]: {
                      marked: true,
                      present,
                      total,
                      markedAt: Date.now(),
                      markedBy: teacherName,
                      periodStartMinute: attendanceTarget.startMinute,
                    },
                  }));
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
