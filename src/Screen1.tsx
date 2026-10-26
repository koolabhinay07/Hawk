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
import { getPeriodState, getScheduleMinute, hasAttendanceRights, timetable, type AttendanceRecord, type TimetablePeriod } from "./timetable";

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

function loadAttendanceRecords(): Record<string, AttendanceRecord> {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem("hawk-attendance-records") ?? "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).filter(([periodId, value]) => {
      if (!timetable.some((period) => period.period === periodId) || !value || typeof value !== "object") return false;
      const record = value as Partial<AttendanceRecord>;
      return Number.isInteger(record.present) && Number.isInteger(record.total) &&
        (record.present ?? -1) >= 0 && (record.total ?? 0) > 0 &&
        (record.present ?? Infinity) <= (record.total ?? -1);
    })) as Record<string, AttendanceRecord>;
  } catch {
    return {};
  }
}

export default function Screen1() {
  const [aiOpen, setAiOpen] = useState(false);
  const [showAiHint, setShowAiHint] = useState(true);
  const [aiOverContent, setAiOverContent] = useState(false);
  const [activeNav, setActiveNav] = useState("Home");
  const [isDarkMode, setIsDarkMode] = useState(() => {
    try {
      return window.localStorage.getItem("hawk-appearance") === "dark";
    } catch {
      return false;
    }
  });
  const [attendanceRecords, setAttendanceRecords] = useState<Record<string, AttendanceRecord>>(loadAttendanceRecords);
  const [proxyAttendanceRights, setProxyAttendanceRights] = useState(() => {
    try {
      return window.localStorage.getItem("hawk-proxy-attendance-rights") === "true";
    } catch {
      return false;
    }
  });
  const [attendanceTarget, setAttendanceTarget] = useState<TimetablePeriod | null>(null);
  const [attendanceTotal, setAttendanceTotal] = useState("");
  const [attendancePresent, setAttendancePresent] = useState("");
  const [clock, setClock] = useState(() => new Date());
  const scheduleMinute = getScheduleMinute(clock);
  const mainContentRef = useRef<HTMLElement>(null);
  const aiDockRef = useRef<HTMLDivElement>(null);
  const attendanceDialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 15_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setShowAiHint(false), 3_000);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    let frame = 0;
    const updateOverlap = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const contentRects = Array.from(mainContentRef.current?.querySelectorAll<HTMLElement>("[data-ai-obstacle]") ?? []).map((child) => child.getBoundingClientRect());
        const aiDockRect = aiDockRef.current?.getBoundingClientRect();
        const overlaps = Boolean(aiDockRect && contentRects.some((contentRect) =>
          contentRect.left < aiDockRect.right && contentRect.right > aiDockRect.left &&
          contentRect.top < aiDockRect.bottom && contentRect.bottom > aiDockRect.top,
        ));
        setAiOverContent(overlaps);
      });
    };

    window.addEventListener("scroll", updateOverlap, { capture: true, passive: true });
    window.addEventListener("resize", updateOverlap);
    updateOverlap();
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", updateOverlap, true);
      window.removeEventListener("resize", updateOverlap);
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
    try {
      window.localStorage.setItem("hawk-attendance-records", JSON.stringify(attendanceRecords));
    } catch {
      // Attendance counts remain available for this session if browser storage is unavailable.
    }
  }, [attendanceRecords]);

  useEffect(() => {
    try {
      window.localStorage.setItem("hawk-proxy-attendance-rights", String(proxyAttendanceRights));
    } catch {
      // Proxy rights remain available for this session if browser storage is unavailable.
    }
  }, [proxyAttendanceRights]);

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
    const record = attendanceRecords[period.period];
    setAttendanceTotal(String(record?.total ?? period.students ?? ""));
    setAttendancePresent(String(record?.present ?? ""));
    setAttendanceTarget(period);
  }

  return (
    <div data-appearance={isDarkMode ? "dark" : "light"} className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto flex min-h-dvh w-full max-w-[1440px] flex-col border-x border-border bg-background shadow-[0_12px_48px_rgba(23,35,29,0.08)]">
          <div className="grow">
            <header className="fixed inset-x-0 top-0 z-40 mx-auto flex h-[76px] w-full max-w-[1440px] items-center justify-between border-b bg-background px-4 md:px-8">
              <div className="flex items-center gap-3">
                <div className="font-bold rounded-2xl bg-primary text-primary-foreground text-sm flex justify-center items-center size-10">
                  PS
                </div>
                <div>
                  <div className="font-semibold text-base">Namaste, Priya Sharma</div>
                  <div className="text-muted-foreground text-xs">
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

            <nav aria-label="Primary navigation" className="fixed bottom-0 left-[max(0px,calc((100vw-1440px)/2))] top-[76px] z-20 hidden w-20 flex-col items-center gap-3 border-r border-border bg-background py-6 md:flex">
              {navItems.map(({ icon: Icon, label }) => (
                <button
                  key={label}
                  type="button"
                  aria-current={activeNav === label ? "page" : undefined}
                  onClick={() => setActiveNav(label)}
                  className={`flex min-h-[68px] w-[68px] flex-col items-center justify-center gap-1.5 rounded-[20px] text-[11px] font-semibold transition-colors ${activeNav === label ? "bg-primary-container text-on-primary-container" : "text-muted-foreground hover:bg-muted"}`}
                >
                  <Icon aria-hidden="true" className="size-6" />
                  {label}
                </button>
              ))}
            </nav>

            <div className="grow pt-[76px] md:pl-20">
            {activeNav === "Home" ? (
              <main ref={mainContentRef} className="mx-auto flex w-full max-w-[1200px] flex-col gap-7 px-4 pb-40 pt-7 md:gap-9 md:px-8 md:pb-12 md:pt-10">
              <section data-ai-obstacle className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                <h1 className="font-bold text-[28px] leading-tight tracking-[-0.025em] md:text-4xl">Monday, 26 October</h1>
                <p className="text-muted-foreground text-sm md:pb-1">5 classes today · 2 attendance pending</p>
              </section>

              <div className="grid gap-7 md:grid-cols-[minmax(0,1.55fr)_minmax(300px,0.9fr)] md:gap-8">
              <div className="flex min-w-0 flex-col gap-7 md:gap-8">

              <section data-ai-obstacle className="rounded-[28px] bg-primary-container p-5 text-on-primary-container md:p-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-xs font-bold tracking-[0.04em] text-on-primary-container/80">
                      <Clock className="size-3.5" />
                      ATTENDANCE PENDING
                    </div>
                    <h2 className="mt-2 text-lg font-bold tracking-tight">Class 8-B</h2>
                    <p className="text-sm text-on-primary-container/80">42 students · Your class</p>
                  </div>
                  <span className="rounded-full bg-card/75 px-3 py-1.5 text-xs font-semibold text-status-foreground">Due by 9:00 AM</span>
                </div>
                <button
                  type="button"
                  onClick={() => openAttendance(timetable.find((period) => period.isOwnClass) ?? timetable[0])}
                  className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:brightness-95"
                >
                  Mark attendance
                  <ArrowRight className="size-4" />
                </button>
              </section>

              <section data-ai-obstacle className="flex flex-col gap-3">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-semibold tracking-tight">Today's classes</h2>
                  <button type="button" className="font-semibold text-icon-accent text-sm hover:underline underline-offset-4">
                    View timetable
                  </button>
                </div>

                <div className="overflow-hidden rounded-[24px] border border-border bg-card">
                  {timetable.map((p, index) => {
                    const attendance = attendanceRecords[p.period];
                    const periodState = getPeriodState(p, scheduleMinute, attendance);
                    const canMarkAttendance = hasAttendanceRights(p, proxyAttendanceRights);

                    return (
                      <div
                        key={p.period}
                        className={[
                          "flex items-center gap-3 px-4 py-4 transition-colors md:px-5",
                          index < timetable.length - 1 ? "border-b" : "",
                          periodState === "upcoming" ? "opacity-55" : "",
                          periodState === "running" ? "bg-primary-soft" : "",
                          periodState === "done" ? "bg-muted" : "",
                        ].join(" ")}
                      >
                        <div className="flex w-[4.25rem] shrink-0 flex-col gap-1 tabular-nums">
                          <span className="font-semibold text-xs">{p.period}</span>
                          <span className="whitespace-nowrap text-muted-foreground text-[11px]">{p.time}</span>
                        </div>
                        <div className="grow min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm">{p.subject}</span>
                            {periodState === "running" && <span className="shrink-0 rounded-full bg-primary-container px-2.5 py-1 text-[10px] font-bold text-on-primary-container">Now</span>}
                          </div>
                          <div className="text-muted-foreground text-xs leading-relaxed">{p.details}</div>
                          {p.isProxy && (
                            <div className="mt-1.5 flex flex-wrap items-center gap-2">
                              <span className="inline-flex rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold text-secondary-foreground">Proxy</span>
                              <button
                                type="button"
                                role="switch"
                                aria-checked={proxyAttendanceRights}
                                aria-label={`${proxyAttendanceRights ? "Revoke" : "Grant"} attendance rights for ${p.period} proxy period`}
                                onClick={() => setProxyAttendanceRights((enabled) => !enabled)}
                                className="min-h-9 rounded-full border border-border bg-card px-3 text-[11px] font-semibold text-foreground hover:bg-muted focus-visible:outline-offset-2"
                              >
                                {proxyAttendanceRights ? "Revoke rights" : "Grant rights"}
                              </button>
                            </div>
                          )}
                          {periodState === "running" && !attendance && canMarkAttendance && (
                            <button
                              type="button"
                              onClick={() => openAttendance(p)}
                              className="mt-2 inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full bg-primary-container px-4 text-xs font-semibold text-on-primary-container transition-opacity hover:opacity-90"
                            >
                              Mark attendance
                              <ArrowRight aria-hidden="true" className="size-3.5" />
                            </button>
                          )}
                          {(periodState === "done" || periodState === "running") && attendance && (
                            <span className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-icon-accent">
                              <Check aria-hidden="true" className="size-3.5" />
                              {attendance.present}/{attendance.total} present
                            </span>
                          )}
                          {periodState === "missed" && (
                            <span className="mt-1.5 inline-flex rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold text-accent-foreground">Missed</span>
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
                <h2 className="text-xl font-semibold tracking-tight">Quick actions</h2>
                <div className="grid grid-cols-5 gap-1">
                  {quickActions.map(({ icon: Icon, label }) => (
                    <button
                      key={label}
                      type="button"
                      className="flex min-h-[92px] min-w-0 flex-col items-center justify-start gap-2.5 rounded-2xl px-0 py-1 text-[11px] font-medium text-foreground transition-colors hover:bg-primary-soft"
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
                  <div className="text-muted-foreground text-xs">September salary</div>
                  <div className="font-semibold text-sm">₹42,500</div>
                </div>
                <span className="rounded-full bg-status-soft text-status-foreground text-xs px-2 py-1">
                  Credited · 1 Oct
                </span>
              </button>

              <section data-ai-obstacle className="flex flex-col gap-3">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-semibold tracking-tight">Announcements</h2>
                  <button type="button" className="font-semibold text-icon-accent text-sm hover:underline underline-offset-4">
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
                        <h3 className="font-semibold text-sm leading-5">Sports Day volunteer list</h3>
                        <span className="shrink-0 pt-0.5 text-[11px] text-muted-foreground">2h ago</span>
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Please confirm your house duty before Friday.</p>
                      <span className="mt-2 inline-flex rounded-full bg-muted px-2 py-1 text-[11px] font-medium text-muted-foreground">School</span>
                    </div>
                  </article>
                  <article className="flex gap-3.5 border-t p-4">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-icon-accent">
                      <BookOpen aria-hidden="true" className="size-[18px]" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-semibold text-sm leading-5">Bring geometry box on Monday</h3>
                        <span className="shrink-0 pt-0.5 text-[11px] text-muted-foreground">Yesterday</span>
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Class 8-B students should carry ruler and compass.</p>
                      <span className="mt-2 inline-flex rounded-full bg-status-soft px-2 py-1 text-[11px] font-medium text-status-foreground">Class 8-B</span>
                    </div>
                  </article>
                </div>
              </section>

              <section data-ai-obstacle className="flex flex-col gap-3">
                <h2 className="text-xl font-semibold tracking-tight">Coming up</h2>
                <div className="rounded-[24px] bg-card border px-4">
                  {[
                    { d: "28", m: "OCT", t: "Sports Day – Annual Function", s: "School event" },
                    { d: "3", m: "NOV", t: "Unit Test 2 begins", s: "Exams" },
                  ].map((e, i) => (
                    <div
                      key={e.t}
                      className={`flex gap-3 py-3.5 ${i === 0 ? "border-b" : ""}`}
                    >
                      <div className="font-semibold rounded-lg bg-muted text-icon-accent text-xs flex flex-col justify-center items-center shrink-0 size-14">
                        <span>{e.d}</span>
                        <span>{e.m}</span>
                      </div>
                      <div>
                        <div className="font-semibold text-sm">{e.t}</div>
                        <div className="text-muted-foreground text-xs">{e.s}</div>
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
                <h1 className="text-2xl font-bold tracking-tight">Profile</h1>
                <section className="flex items-center justify-between gap-4 rounded-[24px] border bg-card p-5 md:p-6">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-icon-accent">
                      <Moon aria-hidden="true" className="size-5" />
                    </span>
                    <div className="min-w-0">
                      <h2 className="font-semibold text-sm">Dark mode</h2>
                      <p id="dark-mode-description" className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        Preview Hawk with a darker color palette.
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground">{isDarkMode ? "On" : "Off"}</span>
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
              </main>
            ) : (
              <main ref={mainContentRef} className="flex min-h-[60vh] grow items-center justify-center px-6 pb-40 pt-8 text-center md:pb-12">
                <div className="flex flex-col items-center gap-2">
                  <h1 className="text-2xl font-bold tracking-tight">{activeNav}</h1>
                  <p className="text-sm text-muted-foreground">Coming soon</p>
                </div>
              </main>
            )}
            </div>
          </div>

          <nav
            aria-label="Primary navigation"
            className="fixed bottom-[calc(env(safe-area-inset-bottom)+12px)] left-1/2 z-20 flex min-h-[80px] w-[calc(100%-32px)] max-w-[520px] -translate-x-1/2 items-center gap-1 rounded-full border border-border bg-background px-2 py-2 shadow-[0_12px_32px_rgba(23,35,29,0.14)] md:hidden"
          >
            {navItems.map(({ icon: Icon, label }) => (
              <button
                key={label}
                type="button"
                aria-current={activeNav === label ? "page" : undefined}
                onClick={() => setActiveNav(label)}
                className={`flex min-h-[64px] min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-full px-1 py-2 text-[11px] font-semibold transition-colors duration-200 ${
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
                  setAttendanceRecords((records) => ({ ...records, [attendanceTarget.period]: { present, total } }));
                  setAttendanceTarget(null);
                }}
              >
                <div>
                  <h2 id="attendance-dialog-title" className="text-lg font-bold">Mark attendance</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{attendanceTarget.period} · {attendanceTarget.subject}</p>
                </div>
                <label className="flex flex-col gap-1.5 text-sm font-medium">
                  Total students
                  <input required type="number" min="1" step="1" value={attendanceTotal} onChange={(event) => setAttendanceTotal(event.target.value)} className="h-11 rounded-lg border border-border bg-background px-3" />
                </label>
                <label className="flex flex-col gap-1.5 text-sm font-medium">
                  Students present
                  <input required type="number" min="0" max={attendanceTotal || undefined} step="1" value={attendancePresent} onChange={(event) => setAttendancePresent(event.target.value)} className="h-11 rounded-lg border border-border bg-background px-3" />
                </label>
                <div className="flex gap-2 pt-1">
                  <button type="button" onClick={() => setAttendanceTarget(null)} className="min-h-11 flex-1 rounded-xl border border-border font-semibold hover:bg-muted">Cancel</button>
                  <button type="submit" className="min-h-11 flex-1 rounded-xl bg-primary font-semibold text-primary-foreground">Save attendance</button>
                </div>
              </form>
            )}
          </dialog>

          <div
            ref={aiDockRef}
            aria-hidden={aiOverContent}
            className="fixed z-30 right-[max(24px,calc((100vw-1440px)/2+24px))] bottom-[calc(env(safe-area-inset-bottom)+108px)] flex min-h-14 min-w-14 items-center justify-end gap-2 md:bottom-6"
          >
            {!aiOverContent && (
              <>
                {showAiHint && (
                  <span aria-hidden="true" className="shadow-sm rounded-full bg-popover text-popover-foreground text-xs px-3 py-2">
                    Ask Hawk
                  </span>
                )}
                <button
                  aria-label="Ask Hawk AI"
                  type="button"
                  onClick={() => setAiOpen(true)}
                  className="shadow-md rounded-full bg-primary text-primary-foreground flex justify-center items-center size-14"
                >
                  <Sparkles className="size-6" />
                </button>
              </>
            )}
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
                    <h2 id="hawk-ai-title" className="font-semibold text-lg">Hawk AI</h2>
                    <p className="text-muted-foreground text-xs">
                      Tell me what you need. I'll draft it for you.
                    </p>
                  </div>
                  <div className="text-xs flex gap-1">
                    <button type="button" className="font-semibold">English</button>
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
                <p className="text-center text-xs text-muted-foreground mt-1">Tap and speak</p>

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
                    <button key={s} type="button" className="rounded-full bg-muted text-xs px-3 py-2">
                      {s}
                    </button>
                  ))}
                </div>

                <div className="rounded-lg bg-muted border mt-4 p-3">
                  <div className="font-semibold text-sm">Sports Day notice</div>
                  <p className="text-muted-foreground text-xs mt-1">
                    Dear parents, our Annual Sports Day is on 28 October. Please ensure
                    students arrive in house colours by 8:30 AM.
                  </p>
                  <div className="flex mt-3 gap-2">
                    <button type="button" className="rounded-lg text-xs border px-3 py-2">
                      Edit
                    </button>
                    <button
                      type="button"
                      className="font-semibold rounded-lg bg-primary text-primary-foreground text-xs px-3 py-2"
                    >
                      Post to parents
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setAiOpen(false)}
                  className="rounded-lg text-sm border mt-4 w-full h-11"
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
