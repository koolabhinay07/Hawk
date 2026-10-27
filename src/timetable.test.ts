import { strictEqual } from "node:assert";
import { test } from "node:test";
import { getNextWorkingDay, getTodaysAttendanceSummary, timetable, type AttendanceRecord, type ClosedDayConfig } from "./timetable.ts";

const weekendsClosed: ClosedDayConfig = { closedWeekdays: [0, 6], holidayDates: [] };
const indiaNoon = (date: string) => new Date(`${date}T12:00:00+05:30`);
const resolvedDate = (date: Date) => date.toISOString().slice(0, 10);
const markedRecords = (periodIds: string[]): Record<string, AttendanceRecord> => Object.fromEntries(
  periodIds.map((periodId) => [periodId, { present: 40, total: 42 }]),
);

function assertAttendanceCountsShareOneSummary(summary: ReturnType<typeof getTodaysAttendanceSummary>) {
  strictEqual(summary.headerCount, summary.dayComplete ? summary.missedCount : summary.pendingOwnClassCount);
  strictEqual(summary.missedCount, summary.missedPeriods.length);
  strictEqual(summary.eligibleForRetroactiveMarkingCount, summary.retroactiveEligiblePeriods.length);
  strictEqual(summary.notEligibleForRetroactiveMarkingCount, summary.missedCount - summary.eligibleForRetroactiveMarkingCount);
}

test("returns tomorrow for a Monday or Thursday when the next day is open", () => {
  const monday = getNextWorkingDay(indiaNoon("2026-10-26"), weekendsClosed);
  const thursday = getNextWorkingDay(indiaNoon("2026-10-29"), weekendsClosed);

  strictEqual(monday.label, "Tomorrow");
  strictEqual(resolvedDate(monday.date), "2026-10-27");
  strictEqual(thursday.label, "Tomorrow");
  strictEqual(resolvedDate(thursday.date), "2026-10-30");
});

test("skips the weekend after Friday", () => {
  const next = getNextWorkingDay(indiaNoon("2026-10-30"), weekendsClosed);

  strictEqual(next.label, "Monday");
  strictEqual(resolvedDate(next.date), "2026-11-02");
});

test("skips the weekend after Saturday when weekends are closed", () => {
  const next = getNextWorkingDay(indiaNoon("2026-10-31"), weekendsClosed);

  strictEqual(next.label, "Monday");
  strictEqual(resolvedDate(next.date), "2026-11-02");
});

test("skips Sunday but treats Saturday as a working day", () => {
  const sundayOnlyClosed: ClosedDayConfig = { closedWeekdays: [0], holidayDates: [] };
  const next = getNextWorkingDay(indiaNoon("2026-10-31"), sundayOnlyClosed);

  strictEqual(next.label, "Monday");
  strictEqual(resolvedDate(next.date), "2026-11-02");
});

test("returns Monday after a Sunday closure", () => {
  const next = getNextWorkingDay(indiaNoon("2026-11-01"), weekendsClosed);

  strictEqual(next.label, "Monday");
  strictEqual(resolvedDate(next.date), "2026-11-02");
});

test("skips a multi-day holiday streak after the weekend", () => {
  const closure: ClosedDayConfig = {
    closedWeekdays: [0, 6],
    holidayDates: ["2026-11-02", "2026-11-03"],
  };
  const next = getNextWorkingDay(indiaNoon("2026-10-30"), closure);

  strictEqual(next.label, "Wednesday");
  strictEqual(resolvedDate(next.date), "2026-11-04");
});

test("keeps header, Day Complete, and retroactive counts consistent when all periods are missed", () => {
  const summary = getTodaysAttendanceSummary(timetable, 1006, {}, false);

  assertAttendanceCountsShareOneSummary(summary);
  strictEqual(summary.dayComplete, true);
  strictEqual(summary.totalClassCount, 5);
  strictEqual(summary.markedCount, 0);
  strictEqual(summary.missedCount, 5);
  strictEqual(summary.headerCount, 5);
  strictEqual(summary.headerLabel, "missed");
  strictEqual(summary.eligibleForRetroactiveMarkingCount, 4);
  strictEqual(summary.notEligibleForRetroactiveMarkingCount, 1);
});

test("keeps all-marked Day Complete counts at zero missed and zero retroactive", () => {
  const records = markedRecords(timetable.map((period) => period.period));
  const summary = getTodaysAttendanceSummary(timetable, 1006, records, false);

  assertAttendanceCountsShareOneSummary(summary);
  strictEqual(summary.dayComplete, true);
  strictEqual(summary.markedCount, 5);
  strictEqual(summary.missedCount, 0);
  strictEqual(summary.headerCount, 0);
  strictEqual(summary.eligibleForRetroactiveMarkingCount, 0);
});

test("keeps mixed Day Complete counts aligned across the header and card", () => {
  const summary = getTodaysAttendanceSummary(timetable, 1006, markedRecords(["P1", "P3"]), false);

  assertAttendanceCountsShareOneSummary(summary);
  strictEqual(summary.markedCount, 2);
  strictEqual(summary.missedCount, 3);
  strictEqual(summary.headerCount, 3);
  strictEqual(summary.headerLabel, "missed");
  strictEqual(summary.eligibleForRetroactiveMarkingCount, 2);
  strictEqual(summary.notEligibleForRetroactiveMarkingCount, 1);
});

test("shows own-class pending count while the school day is still in progress", () => {
  const summary = getTodaysAttendanceSummary(timetable, 900, markedRecords(["P1"]), false);

  assertAttendanceCountsShareOneSummary(summary);
  strictEqual(summary.dayComplete, false);
  strictEqual(summary.pendingOwnClassCount, 1);
  strictEqual(summary.headerCount, 1);
  strictEqual(summary.headerLabel, "attendance pending");
  strictEqual(summary.missedCount, 1);
  strictEqual(summary.eligibleForRetroactiveMarkingCount, 0);
});

test("removes an unmarked own class from the pending header count once it becomes missed", () => {
  const summary = getTodaysAttendanceSummary(timetable, 825, {}, false);

  assertAttendanceCountsShareOneSummary(summary);
  strictEqual(summary.dayComplete, false);
  strictEqual(summary.missedCount, 1);
  strictEqual(summary.pendingOwnClassCount, 1);
  strictEqual(summary.headerCount, 1);
  strictEqual(summary.headerLabel, "attendance pending");
});
