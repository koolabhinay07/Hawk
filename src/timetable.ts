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

export type AttendanceRecord = { present: number; total: number };
export type PeriodState = "upcoming" | "running" | "done" | "missed";

export const timetable: TimetablePeriod[] = [
  { period: "P1", time: "8:00–8:40", startMinute: 480, endMinute: 520, subject: "Mathematics", details: "Class 8-B · 42 students", students: 42, isOwnClass: true },
  { period: "P2", time: "8:45–9:25", startMinute: 525, endMinute: 565, subject: "Science", details: "Class 7-A · Covering for Mr. Verma", isProxy: true },
  { period: "P3", time: "9:30–10:10", startMinute: 570, endMinute: 610, subject: "Mathematics", details: "Class 9-A · 40 students", students: 40 },
  { period: "P4", time: "10:30–11:10", startMinute: 630, endMinute: 670, subject: "Mathematics", details: "Class 8-A · 41 students", students: 41 },
  { period: "P5", time: "11:15–11:55", startMinute: 675, endMinute: 715, subject: "Mathematics", details: "Class 8-B · 42 students", students: 42, isOwnClass: true },
];

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
  if (scheduleMinute >= period.endMinute) return attendance ? "done" : "missed";
  if (scheduleMinute < period.startMinute) return "upcoming";
  return "running";
}

export function hasAttendanceRights(period: TimetablePeriod, proxyRights: boolean) {
  return !period.isProxy || proxyRights;
}
