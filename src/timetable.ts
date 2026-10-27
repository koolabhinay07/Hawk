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
};

export type AttendanceRecord = { present: number; total: number; markedAt?: number };
export type PeriodState = "upcoming" | "running" | "grace" | "done" | "missed";
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
  { period: "P1", time: "4:45–5:15 PM", startMinute: 1005, endMinute: 1035, subject: "Mathematics", details: "Class 8-B · 42 students", students: 42, isOwnClass: true },
  { period: "P2", time: "5:30–6:00 PM", startMinute: 1050, endMinute: 1080, subject: "Science", details: "Class 7-A · Covering for Mr. Verma", isProxy: true },
  { period: "P3", time: "6:15–6:45 PM", startMinute: 1095, endMinute: 1125, subject: "Mathematics", details: "Class 9-A · 40 students", students: 40 },
  { period: "P4", time: "7:00–7:30 PM", startMinute: 1140, endMinute: 1170, subject: "Mathematics", details: "Class 8-A · 41 students", students: 41 },
  { period: "P5", time: "7:45–8:15 PM", startMinute: 1185, endMinute: 1215, subject: "Mathematics", details: "Class 8-B · 42 students", students: 42, isOwnClass: true },
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
  attendance?: AttendanceRecord,
): PeriodState {
  if (scheduleMinute < period.startMinute) return "upcoming";
  if (scheduleMinute < period.endMinute) return attendance ? "done" : "running";
  if (scheduleMinute < period.endMinute + attendanceGraceMinutes) return attendance ? "done" : "grace";
  return attendance ? "done" : "missed";
}

export function hasAttendanceRights(period: TimetablePeriod, proxyRights: boolean) {
  return period.isOwnClass === true || (period.isProxy === true && proxyRights);
}

export type TodaysAttendanceSummary = {
  totalClassCount: number;
  markedCount: number;
  missedCount: number;
  eligibleForRetroactiveMarkingCount: number;
  notEligibleForRetroactiveMarkingCount: number;
  pendingOwnClassCount: number;
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
    state: getPeriodState(period, scheduleMinute, records[period.period]),
  }));
  const unmarkedOwnClassPeriods = periodStatuses
    .filter(({ period, attendance }) => period.isOwnClass && !attendance)
    .map(({ period }) => period);
  const missedPeriods = periodStatuses
    .filter(({ period, state }) => state === "missed" && hasAttendanceRights(period, proxyRights))
    .map(({ period }) => period);
  const retroactiveEligiblePeriods = missedPeriods.filter((period) => hasAttendanceRights(period, proxyRights));
  const pendingOwnClassCount = periodStatuses.filter(({ period, attendance, state }) =>
    period.isOwnClass && !attendance && state !== "missed",
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
    dayComplete,
    headerCount: dayComplete ? missedPeriods.length : pendingOwnClassCount,
    headerLabel,
    unmarkedOwnClassPeriods,
    missedPeriods,
    retroactiveEligiblePeriods,
  };
}
