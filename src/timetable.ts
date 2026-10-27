export type TimetablePeriod = {
  period: string;
  time: string;
  startMinute: number;
  endMinute: number;
  subject: string;
  details: string;
  students?: number;
  isProxy?: boolean;
  isOwnClass?: boolean;
  isSwap?: boolean;
  swappedWith?: string;
};

export type AttendanceRecord = { marked?: true; present: number; total: number; markedAt?: number; markedBy?: string; periodStartMinute?: number };
export type PeriodState = "upcoming" | "running" | "grace" | "done";
export type ClosedDayConfig = {
  /** JavaScript weekday numbers: Sunday = 0 through Saturday = 6. */
  closedWeekdays: number[];
  /** Dates in YYYY-MM-DD format in the Asia/Kolkata calendar. */
  holidayDates: string[];
};

export const schoolClosedDays: ClosedDayConfig = {
  closedWeekdays: [0, 6],
  holidayDates: [],
};

// Retroactive marking is supported by the existing attendance entry flow.
export const allowRetroactiveMarking = true;
export const attendanceGraceMinutes = 15;

export const timetable: TimetablePeriod[] = [
  { period: "P1", time: "8:00–8:10 PM", startMinute: 1200, endMinute: 1210, subject: "Mathematics", details: "Class 8-B · 42 students", students: 42, isOwnClass: true },
  { period: "P2", time: "8:13–8:23 PM", startMinute: 1213, endMinute: 1223, subject: "Physics", details: "Class 7-A · Covering for Mr. Verma", isProxy: true },
  { period: "P3", time: "8:26–8:36 PM", startMinute: 1226, endMinute: 1236, subject: "English", details: "Class 9-A · 40 students", students: 40 },
  { period: "P4", time: "8:39–8:49 PM", startMinute: 1239, endMinute: 1249, subject: "History", details: "Class 8-A · 41 students", students: 41 },
  { period: "P5", time: "8:52–9:02 PM", startMinute: 1252, endMinute: 1262, subject: "Biology", details: "Class 10-C · 40 students", students: 40 },
];

const weekdayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const millisecondsPerDay = 24 * 60 * 60 * 1000;

/** Resolve the next scheduled working date using Asia/Kolkata calendar dates. */
export function getNextWorkingDay(today: Date, closedDays: ClosedDayConfig = schoolClosedDays) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(today);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);
  const todayUtc = Date.UTC(year, month - 1, day);
  const todayWeekday = new Date(todayUtc).getUTCDay();
  const closedWeekdays = new Set(closedDays.closedWeekdays);
  const holidays = new Set(closedDays.holidayDates);

  for (let offset = 1; offset <= 3660; offset += 1) {
    const date = new Date(todayUtc + offset * millisecondsPerDay);
    const weekday = date.getUTCDay();
    const dateKey = date.toISOString().slice(0, 10);
    if (closedWeekdays.has(weekday) || holidays.has(dateKey)) continue;

    return {
      // This Date represents midnight of the resolved calendar date in UTC;
      // callers should format it in Asia/Kolkata when displaying the date.
      date,
      label: offset === 1 && todayWeekday >= 1 && todayWeekday <= 4 ? "Tomorrow" : weekdayNames[weekday],
    };
  }

  throw new Error("No working day found within the next 10 years.");
}

export function getScheduleMinute(now: Date) {
  const timeParts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const hour = Number(timeParts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(timeParts.find((part) => part.type === "minute")?.value ?? 0);
  return hour * 60 + minute;
}

export function getPeriodState(
  period: TimetablePeriod,
  scheduleMinute: number,
): PeriodState {
  if (scheduleMinute < period.startMinute) return "upcoming";
  if (scheduleMinute < period.endMinute) return "running";
  if (scheduleMinute < period.endMinute + attendanceGraceMinutes) return "grace";
  return "done";
}

export function hasAttendanceRights(period: TimetablePeriod, proxyRights: boolean) {
  return period.isOwnClass === true || period.isSwap === true || (period.isProxy === true && proxyRights);
}

export type TodaysAttendanceSummary = {
  totalClassCount: number;
  markedCount: number;
  missedCount: number;
  eligibleForRetroactiveMarkingCount: number;
  notEligibleForRetroactiveMarkingCount: number;
  pendingOwnClassCount: number;
  pendingAttendanceCount: number;
  dayComplete: boolean;
  headerCount: number;
  headerLabel: "attendance pending" | "missed";
  unmarkedOwnClassPeriods: TimetablePeriod[];
  missedPeriods: TimetablePeriod[];
  retroactiveEligiblePeriods: TimetablePeriod[];
};

/** Computes all attendance counts and period groups for today's dashboard in one pass. */
export function getTodaysAttendanceSummary(
  periods: TimetablePeriod[],
  scheduleMinute: number,
  records: Record<string, AttendanceRecord | undefined>,
  proxyRights: boolean,
): TodaysAttendanceSummary {
  const periodStatuses = periods.map((period) => ({
    period,
    attendance: records[period.period],
    state: getPeriodState(period, scheduleMinute),
  }));
  const unmarkedOwnClassPeriods = periodStatuses
    .filter(({ period, attendance }) => period.isOwnClass && !attendance)
    .map(({ period }) => period);
  const missedPeriods = periodStatuses
    .filter(({ period, attendance, state }) => state === "done" && !attendance && hasAttendanceRights(period, proxyRights))
    .map(({ period }) => period);
  const retroactiveEligiblePeriods = missedPeriods.filter((period) => hasAttendanceRights(period, proxyRights));
  const pendingOwnClassCount = periodStatuses.filter(({ period, attendance }) =>
    period.isOwnClass && !attendance,
  ).length;
  const pendingAttendanceCount = periodStatuses.filter(({ period, attendance }) =>
    hasAttendanceRights(period, proxyRights) && !attendance,
  ).length;
  const markedCount = periodStatuses.filter(({ attendance }) => Boolean(attendance)).length;
  const lastPeriodEnd = periods.reduce((latestEnd, period) => Math.max(latestEnd, period.endMinute), 0);
  const dayComplete = periods.length > 0 && scheduleMinute >= lastPeriodEnd + attendanceGraceMinutes;
  const headerLabel = dayComplete ? "missed" : "attendance pending";

  return {
    totalClassCount: periods.length,
    markedCount,
    missedCount: missedPeriods.length,
    eligibleForRetroactiveMarkingCount: retroactiveEligiblePeriods.length,
    notEligibleForRetroactiveMarkingCount: missedPeriods.length - retroactiveEligiblePeriods.length,
    pendingOwnClassCount,
    pendingAttendanceCount,
    dayComplete,
    headerCount: dayComplete ? missedPeriods.length : pendingOwnClassCount,
    headerLabel,
    unmarkedOwnClassPeriods,
    missedPeriods,
    retroactiveEligiblePeriods,
  };
}
