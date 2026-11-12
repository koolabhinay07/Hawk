import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
} from "react";

import { supabase } from "./supabase";
import appleIcon from "./assets/apple-icon.svg";
import googleIcon from "./assets/google-icon.svg";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  Circle,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import onboardingSlideOne from "./assets/onboarding-slide-1.svg";
import onboardingSlideTwo from "./assets/onboarding-slide-2.svg";
import onboardingSlideThree from "./assets/onboarding-slide-3.svg";
import loginIllustration from "./assets/login-illustration.svg";
import signupIllustration from "./assets/signup-illustration.svg";

const authIllustrationPreloads: HTMLImageElement[] = [];
if (typeof window !== "undefined") {
  [loginIllustration, signupIllustration].forEach((src) => {
    const image = new Image();
    image.decoding = "async";
    image.src = src;
    void image.decode().catch(() => {});
    authIllustrationPreloads.push(image);
  });
}

const onboardingIllustrations = [
  onboardingSlideOne,
  onboardingSlideTwo,
  onboardingSlideThree,
];

type FlowScreen =
  | "intro"
  | "login"
  | "signup"
  | "email-verify"
  | "email-verified"
  | "invite"
  | "forgot"
  | "forgot-verify"
  | "reset";

const flowScreens: FlowScreen[] = [
  "intro",
  "login",
  "signup",
  "email-verify",
  "email-verified",
  "invite",
  "forgot",
  "forgot-verify",
  "reset",
];

function readSavedFlowPosition() {
  try {
    const saved = JSON.parse(
      window.localStorage.getItem("hawk-onboarding-position") ?? "null",
    ) as { screen?: unknown; slideIndex?: unknown } | null;
    return {
      screen:
        saved && flowScreens.includes(saved.screen as FlowScreen)
          ? (saved.screen as FlowScreen)
          : "intro",
      slideIndex:
        saved && Number.isInteger(saved.slideIndex)
          ? Math.max(0, Math.min(Number(saved.slideIndex), slides.length - 1))
          : 0,
    };
  } catch {
    return { screen: "intro" as FlowScreen, slideIndex: 0 };
  }
}

const slides = [
  {
    eyebrow: "A better school day starts here",
    title: "Your school day, Simplified",
    body: "From attendance to proxies — everything a teacher needs, in one place.",
    points: [
      "Mark attendance instantly",
      "Send notices to parents instantly",
      "Track your class results",
    ],
  },
  {
    eyebrow: "Made to feel natural",
    title: "User Friendly at its Core",
    body: "Simple tools, built around how a teacher’s day actually works.",
    points: [
      "Clear, familiar actions",
      "Easy to learn",
      "Designed for busy days",
    ],
  },
  {
    eyebrow: "Everything in its place",
    title: "Effortless Classroom Management",
    body: "Attendance, proxies and class updates, all kept on track for you.",
    points: [
      "Your day at a glance",
      "Attendance when you need it",
      "Updates for your classes",
    ],
  },
];

// Scales a design value (in px, measured on the moto edge 50 pro, 433px wide)
// with the screen width. --u is set on <main>.
const u = (n: number) => `calc(${n} * var(--u))`;

const passwordRules = [
  {
    label: "At least 8 characters",
    test: (value: string) => value.length >= 8,
  },
  { label: "At least 1 number", test: (value: string) => /\d/.test(value) },
  {
    label: "Upper and lower case letters",
    test: (value: string) => /[a-z]/.test(value) && /[A-Z]/.test(value),
  },
];

function OtpFields({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
}) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const focusAt = (index: number) =>
    refs.current[Math.max(0, Math.min(index, 3))]?.focus();

  function setCharacter(index: number, rawValue: string) {
    const characters = rawValue.replace(/[^a-z\d]/gi, "").toUpperCase();
    if (!characters) {
      onChange(value.slice(0, index) + value.slice(index + 1));
      return;
    }
    if (characters.length > 1) {
      const pasted = (value.slice(0, index) + characters).slice(0, 4);
      onChange(pasted);
      focusAt(Math.min(pasted.length, 3));
      return;
    }
    const next = (
      value.slice(0, index) +
      characters +
      value.slice(index + 1)
    ).slice(0, 4);
    onChange(next);
    focusAt(Math.min(index + 1, 3));
  }

  return (
    <div
      role="group"
      aria-label={label}
      className="flex justify-center gap-3 py-1"
    >
      {Array.from({ length: 4 }, (_, index) => {
        const digit = value[index] ?? "";
        return (
          <input
            key={index}
            ref={(element) => {
              refs.current[index] = element;
            }}
            aria-label={`${label}, character ${index + 1}`}
            autoComplete={index === 0 ? "one-time-code" : "off"}
            inputMode="text"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={4}
            value={digit}
            onChange={(event) => setCharacter(index, event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Backspace" && !digit && index > 0)
                focusAt(index - 1);
              if (event.key === "ArrowLeft") focusAt(index - 1);
              if (event.key === "ArrowRight") focusAt(index + 1);
            }}
            onPaste={(event) => {
              const pasted = event.clipboardData
                .getData("text")
                .replace(/[^a-z\d]/gi, "")
                .toUpperCase()
                .slice(0, 4);
              if (pasted) {
                event.preventDefault();
                onChange(pasted);
                focusAt(Math.min(pasted.length, 3));
              }
            }}
            className={`size-14 rounded-2xl border-2 text-center font-bold text-xl tabular-nums outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${digit ? "border-primary bg-primary-soft text-icon-accent" : "border-border bg-card text-foreground hover:border-muted-foreground"}`}
          />
        );
      })}
    </div>
  );
}

function Brand() {
  return <span className="text-xl font-bold tracking-tight">Hawk</span>;
}

function ShowcasePanel({
  screen,
  slideIndex,
}: {
  screen: FlowScreen;
  slideIndex: number;
}) {
  const slide = slides[slideIndex];
  const isAuthScreen = screen === "login" || screen === "signup";
  return (
    <aside className={`relative hidden min-h-dvh overflow-hidden lg:flex lg:flex-col lg:p-10 xl:p-14 ${isAuthScreen ? "bg-background text-foreground" : "justify-between bg-primary text-primary-foreground"}`}>
      {!isAuthScreen && <Brand />}
      {isAuthScreen ? (
        <div className="flex min-h-0 flex-1 items-center justify-center">
          <img
            src={loginIllustration}
            alt=""
            className={`max-h-[min(68dvh,630px)] w-full max-w-[630px] object-contain ${screen === "login" ? "" : "hidden"}`}
          />
          <img
            src={signupIllustration}
            alt=""
            className={`max-h-[min(68dvh,630px)] w-full max-w-[630px] object-contain ${screen === "signup" ? "" : "hidden"}`}
          />
        </div>
      ) : <div className="relative mx-auto w-full max-w-xl py-12">
        {screen === "intro" ? (
          <>
            <p className="mb-3 text-sm font-semibold tracking-wide text-primary-container">
              {slide.eyebrow}
            </p>
            <h2 className="max-w-lg text-4xl font-bold leading-tight tracking-tight xl:text-5xl">
              A calmer day for every classroom.
            </h2>
            <p className="mt-5 max-w-md text-base leading-7 text-primary-foreground/80">
              Hawk brings the everyday work of teaching into one clear,
              welcoming space.
            </p>
            <div className="mt-9 flex max-w-lg flex-wrap gap-x-6 gap-y-2 text-sm font-semibold text-primary-foreground/90">
              {slide.points.map((point) => (
                <span key={point}>{point}</span>
              ))}
            </div>
          </>
        ) : (
          <>
            <p className="mb-3 text-sm font-semibold tracking-wide text-primary-container">
              Your teaching day, in one place
            </p>
            <h2 className="max-w-lg text-4xl font-bold leading-tight tracking-tight xl:text-5xl">
              Make room for what matters.
            </h2>
            <p className="mt-5 max-w-md text-base leading-7 text-primary-foreground/80">
              Sign in to pick up where your school day begins.
            </p>
            <div className="mt-10 max-w-lg rounded-[28px] bg-primary-foreground/10 p-6 ring-1 ring-primary-foreground/15">
              <div className="flex items-center justify-between border-b border-primary-foreground/15 pb-4">
                <span className="text-sm font-semibold">Today at a glance</span>
                <span className="rounded-full bg-primary-container px-3 py-1 text-xs font-bold text-on-primary-container">
                  Your school
                </span>
              </div>
              <div className="mt-5 flex items-center gap-4">
                <span className="flex size-12 items-center justify-center rounded-2xl bg-primary-container text-on-primary-container">
                  <BookOpen className="size-6" />
                </span>
                <div>
                  <p className="font-semibold">Classes and attendance</p>
                  <p className="mt-1 text-sm text-primary-foreground/70">
                    Ready when you are
                  </p>
                </div>
                <ArrowRight
                  aria-hidden="true"
                  className="ml-auto size-5 text-primary-container"
                />
              </div>
            </div>
          </>
        )}
      </div>
      }
      {!isAuthScreen && <p className="relative text-sm text-primary-foreground/65">
        A shared workspace for better school days.
      </p>}
    </aside>
  );
}

export default function OnboardingFlow({
  recovery, onRecoveryComplete,
}: {
  recovery: boolean; onRecoveryComplete: () => void;
}) {
const [screen, setScreen] = useState<FlowScreen>(
  () => readSavedFlowPosition().screen,
);

const [slideIndex, setSlideIndex] = useState(
  () => readSavedFlowPosition().slideIndex,
);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [emailVerificationCode, setEmailVerificationCode] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleGoogleLogin = async () => {
    await signInWithProvider("google");
  };

  const handleAppleLogin = async () => {
    await signInWithProvider("apple");
  };

  useEffect(() => {
    const initialPosition = { hawkOnboarding: true, screen, slideIndex };
    if (window.history.state?.hawkOnboarding !== true) {
      window.history.replaceState(
        { hawkOnboarding: true, screen: "intro", slideIndex: 0 },
        "",
      );
      for (let index = 1; index <= slideIndex; index += 1) {
        window.history.pushState(
          { hawkOnboarding: true, screen: "intro", slideIndex: index },
          "",
        );
      }
      if (screen !== "intro") {
        window.history.pushState(initialPosition, "");
      }
    }

    function restorePreviousPosition(event: PopStateEvent) {
      const previous = event.state as
        | { hawkOnboarding?: boolean; screen?: unknown; slideIndex?: unknown }
        | null;
      if (
        !previous?.hawkOnboarding ||
        !flowScreens.includes(previous.screen as FlowScreen)
      ) {
        return;
      }
      setScreen(previous.screen as FlowScreen);
      setSlideIndex(
        Number.isInteger(previous.slideIndex)
          ? Math.max(0, Math.min(Number(previous.slideIndex), slides.length - 1))
          : 0,
      );
      setError("");
      setNotice("");
    }

    window.addEventListener("popstate", restorePreviousPosition);
    return () => window.removeEventListener("popstate", restorePreviousPosition);
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        "hawk-onboarding-position",
        JSON.stringify({ screen, slideIndex }),
      );
    } catch {
      // Keep the current step for this session if storage is unavailable.
    }
  }, [screen, slideIndex]);

  useEffect(() => {
    try {
      document.documentElement.dataset.appearance =
        window.localStorage.getItem("hawk-appearance") === "dark"
          ? "dark"
          : "light";
    } catch {
      document.documentElement.dataset.appearance = "light";
    }
  }, []);

  useEffect(() => {
    onboardingIllustrations.forEach((src) => {
      const image = new Image();
      image.decoding = "async";
      image.src = src;
      void image.decode().catch(() => {});
    });
  }, []);

  function go(next: FlowScreen) {
    setError("");
    setNotice("");
    window.history.pushState(
      { hawkOnboarding: true, screen: next, slideIndex },
      "",
    );
    setScreen(next);
  }

  function goToSlide(nextIndex: number) {
    const boundedIndex = Math.max(0, Math.min(nextIndex, slides.length - 1));
    window.history.pushState(
      { hawkOnboarding: true, screen: "intro", slideIndex: boundedIndex },
      "",
    );
    setSlideIndex(boundedIndex);
  }

  function goLogin() {
    if (recovery) { void supabase?.auth.signOut(); onRecoveryComplete(); }
    setPassword("");
    setConfirmPassword("");
    setVerificationCode("");
    go("login");
  }

  function client() {
    if (!supabase) setError("Authentication is not configured. Contact your administrator.");
    return supabase;
  }

  async function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const auth = client(); if (!auth) return;
    const { error } = await auth.auth.signInWithPassword({ email: email.trim(), password });
    if (error) setError(error.message);
  }

  async function signInWithProvider(provider: "google" | "apple") {
    const auth = client(); if (!auth) return;
    const { error } = await auth.auth.signInWithOAuth({ provider, options: { redirectTo: window.location.origin } });
    if (error) setError(error.message);
  }

  async function submitSignup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!passwordRules.every((rule) => rule.test(password))) { setError("Your password does not meet all the requirements yet."); return; }
    if (password !== confirmPassword) { setError("Those passwords do not match. Please try again."); return; }
    const auth = client(); if (!auth) return;
    const { data, error } = await auth.auth.signUp({ email: email.trim(), password, options: { data: { full_name: fullName.trim() }, emailRedirectTo: window.location.origin } });
    if (error) { setError(error.message); return; }
    if (!data.session) { goLogin(); setNotice("Check your email for a confirmation link, then log in."); }
  }

  function submitEmailVerification(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("Use the confirmation link sent to your email.");
  }

  function submitInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("School invite verification is not configured yet.");
  }

  async function submitForgot(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const auth = client(); if (!auth) return;
    const { error } = await auth.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin });
    if (error) { setError(error.message); return; }
    setNotice("If an account exists, check your email for a password reset link.");
  }

  function submitVerification(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("Use the password reset link sent to your email.");
  }

  async function submitReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!passwordRules.every((rule) => rule.test(password))) { setError("Use at least 8 characters, a number, and upper and lower case letters."); return; }
    if (password !== confirmPassword) { setError("Those passwords do not match. Please try again."); return; }
    const auth = client(); if (!auth) return;
    const { error } = await auth.auth.updateUser({ password });
    if (error) { setError(error.message); return; }
    await auth.auth.signOut();
    onRecoveryComplete();
    goLogin();
    setNotice("Your password has been reset. You can now log in.");
  }

  const slide = slides[slideIndex];
  const slideIllustration = onboardingIllustrations[slideIndex];
  const inputClass =
    "min-h-12 w-full rounded-xl border border-border bg-background px-4 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-ring/20";
  const signupInputClass = inputClass.replace("text-sm", "text-base");
  const filledButton =
    "inline-flex h-[60px] min-h-[60px] shrink-0 items-center justify-center gap-2 rounded-[8px] bg-primary px-6 text-sm font-semibold text-primary-foreground transition-colors hover:brightness-95 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50";
  const introFilledButton = filledButton.replaceAll("60px", "56px");
  const outlinedButton =
    "inline-flex h-[60px] min-h-[60px] shrink-0 items-center justify-center gap-2 rounded-[8px] border border-border bg-card px-5 text-sm font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-offset-2";

  const isIntro = screen === "intro";
  const isFirstIntroSlide = isIntro && slideIndex === 0;
  const showLoginHeader = screen === "login" || screen === "signup";

  const renderIntroCtas = (mobile: boolean) => {
    const sizeStyle: CSSProperties | undefined = mobile
      ? { height: u(56), minHeight: u(56) }
      : undefined;
    const hasNext = isFirstIntroSlide || slideIndex === 1;
    return (
      <div
        className={mobile ? "flex flex-col" : "mt-5 flex flex-col gap-3"}
        style={mobile ? { marginTop: u(12), gap: u(12) } : undefined}
      >
        <button
          type="button"
          onClick={
            hasNext
              ? () =>
                  goToSlide(slideIndex + 1)
              : () => go("login")
          }
          className={`${introFilledButton} w-full`}
          style={sizeStyle}
        >
          {hasNext ? "Next" : "Log in"}
          <ArrowRight className="size-4" />
        </button>
        <button
          type="button"
          onClick={hasNext ? goLogin : () => go("signup")}
          className="inline-flex h-[56px] min-h-[56px] shrink-0 w-full items-center justify-center gap-2 rounded-[8px] border border-border bg-card px-5 text-sm font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-offset-2"
          style={sizeStyle}
        >
          {hasNext ? "Skip" : "Sign up"}
        </button>
      </div>
    );
  };

  return (
    <main
      style={
        { "--u": "calc(min(100vw, 480px) / 433)" } as CSSProperties
      }
      className={
        isIntro
          ? "relative h-dvh overflow-hidden bg-background text-foreground md:flex md:min-h-dvh md:items-center md:justify-center md:overflow-visible md:bg-[#f7f8f3]"
          : "relative grid min-h-dvh bg-background text-foreground lg:min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(470px,0.9fr)]"
      }
    >
      {(isIntro || showLoginHeader) && (
        <div className={`absolute inset-x-0 top-0 hidden items-center justify-between px-10 pt-10 md:flex xl:px-14 xl:pt-14 ${isIntro ? "z-10" : "z-20 -translate-y-2"}`}>
          <Brand />
          {isIntro ? (
            <span className="text-sm font-semibold text-muted-foreground">
              Teacher workspace
            </span>
          ) : (
            <div
              className="flex items-center rounded-full bg-muted p-1"
              role="tablist"
              aria-label="Account access"
            >
              <button
                type="button"
                role="tab"
                aria-selected={screen === "login"}
                onClick={() => go("login")}
                className={`min-h-9 rounded-full px-4 text-sm font-medium transition-colors ${screen === "login" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
              >
                Log in
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={screen === "signup"}
                onClick={() => go("signup")}
                className={`min-h-9 rounded-full px-4 text-sm font-medium transition-colors ${screen === "signup" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
              >
                Sign up
              </button>
            </div>
          )}
        </div>
      )}
      <div
        className={
          isIntro
            ? "contents md:mx-auto md:grid md:h-[min(760px,calc(100dvh_-_48px))] md:min-h-0 md:w-full md:max-w-[1280px] md:grid-cols-[1.27fr_1fr] md:items-stretch md:gap-16"
            : "contents"
        }
      >
        <div
          className={
            isIntro
              ? "hidden md:flex md:h-full md:items-center md:justify-center"
              : "contents"
          }
        >
          {isIntro ? (
            <img
              src={slideIllustration}
              alt=""
              className="h-full max-h-[520px] w-auto max-w-full object-contain"
            />
          ) : (
            <ShowcasePanel screen={screen} slideIndex={slideIndex} />
          )}
        </div>
        <section
          className={
            isIntro
              ? "flex h-dvh min-w-0 flex-col md:h-full md:min-h-0 md:w-full md:justify-center md:overflow-visible"
              : "flex min-h-0 min-w-0 flex-col lg:h-dvh lg:max-h-dvh lg:overflow-y-auto"
          }
        >
          <div
            className={`mx-auto flex w-full grow flex-col ${isIntro ? "min-h-0 max-w-[560px] px-[calc(24*var(--u))] py-[calc(24*var(--u))] md:h-auto md:grow-0 md:max-w-none md:px-0 md:py-6" : showLoginHeader ? "max-w-[560px] px-6 pt-12 pb-0 sm:px-6 md:grow-0 md:px-6 md:py-6 lg:h-full lg:grow lg:justify-center lg:px-6 lg:pt-24 lg:pb-10" : "max-w-[560px] px-5 py-6 sm:px-10 sm:py-9 md:grow-0 md:px-6 md:py-6 lg:px-6 lg:py-6"}`}
          >
            <div
              className={`flex items-center justify-between ${isIntro ? "md:hidden" : showLoginHeader ? "hidden" : ""}`}
            >
              <div className={isFirstIntroSlide ? "" : "lg:hidden"}>
                <Brand />
              </div>
              {!isFirstIntroSlide && <div className="hidden lg:block" />}
              {showLoginHeader ? (
                <div
                  className="flex items-center rounded-full bg-muted p-1"
                  role="tablist"
                  aria-label="Account access"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={screen === "login"}
                    onClick={() => go("login")}
                    className={`min-h-9 rounded-full px-4 text-sm font-medium transition-colors ${screen === "login" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
                  >
                    Log in
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={screen === "signup"}
                    onClick={() => go("signup")}
                    className={`min-h-9 rounded-full px-4 text-sm font-medium transition-colors ${screen === "signup" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
                  >
                    Sign up
                  </button>
                </div>
              ) : !isIntro &&
                screen !== "invite" &&
                screen !== "email-verify" &&
                screen !== "email-verified" ? (
                <button
                  type="button"
                  onClick={goLogin}
                  className="inline-flex min-h-10 items-center gap-1 rounded-[8px] px-3 text-sm font-semibold text-icon-accent hover:bg-primary-soft"
                >
                  <ArrowLeft className="size-4" />
                  Log in
                </button>
              ) : (
                <span className="text-sm font-semibold text-muted-foreground">
                  Teacher workspace
                </span>
              )}
            </div>

            <div
              className={
                isIntro
                  ? "flex min-h-0 flex-1 flex-col md:justify-center"
                  : showLoginHeader
                    ? "mt-0 py-0 md:my-auto md:block md:flex-none md:py-10"
                    : "my-auto py-10 md:my-0 md:py-0"
              }
            >
              {showLoginHeader && (
                <div className="md:hidden">
                  <div className="mb-8 flex justify-center">
                    <Brand />
                  </div>
                  <h1 className="text-center text-3xl font-semibold leading-tight tracking-tight">
                    {screen === "login" ? "Welcome Back" : "Welcome to Hawk"}
                  </h1>
                  <p className="mt-3 text-center text-sm leading-5 text-muted-foreground">
                    {screen === "login"
                      ? "Sign in to your workspace and pick up where you left off."
                      : "Create your account and get started with Hawk."}
                  </p>
                  <div
                    className="mt-7 grid grid-cols-2 border-b border-border"
                    role="tablist"
                    aria-label="Account access"
                  >
                    <button
                      type="button"
                      role="tab"
                      aria-selected={screen === "login"}
                      onClick={() => go("login")}
                      className={`min-h-12 border-b-2 px-2 text-base font-medium transition-colors ${screen === "login" ? "border-primary text-icon-accent" : "border-transparent text-muted-foreground"}`}
                    >
                      Login
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={screen === "signup"}
                      onClick={() => go("signup")}
                      className={`min-h-12 border-b-2 px-2 text-base font-medium transition-colors ${screen === "signup" ? "border-primary text-icon-accent" : "border-transparent text-muted-foreground"}`}
                    >
                      Sign Up
                    </button>
                  </div>
                  {screen === "login" && (
                    <div className="mt-7">
                      {notice && (
                        <p
                          role="status"
                          className="mb-4 rounded-xl bg-primary-soft px-4 py-3 text-sm text-icon-accent"
                        >
                          {notice}
                        </p>
                      )}
                      <div className="grid gap-3">
                        <button
                          type="button"
                          onClick={handleAppleLogin}
                          className="inline-flex h-[60px] min-h-[60px] shrink-0 w-full items-center justify-center gap-3 rounded-[28px] border border-border bg-card px-4 text-base font-semibold text-foreground transition-colors hover:bg-muted"
                        >
                          <img
                            src={appleIcon}
                            alt=""
                            aria-hidden="true"
                            className="size-5 shrink-0 object-contain"
                          />
                          Login with Apple
                        </button>
                        <button
                          type="button"
                          onClick={handleGoogleLogin}
                          className="inline-flex h-[60px] min-h-[60px] shrink-0 w-full items-center justify-center gap-3 rounded-[28px] border border-border bg-card px-4 text-base font-semibold text-foreground transition-colors hover:bg-muted"
                        >
                          <img
                            src={googleIcon}
                            alt=""
                            aria-hidden="true"
                            className="size-5 shrink-0 object-contain"
                          />
                          Login with Google
                        </button>
                      </div>
                      <div className="mt-7 mb-7 flex items-center gap-3 text-sm text-muted-foreground">
                        <span className="h-px grow bg-border" />
                        <span>or continue with email</span>
                        <span className="h-px grow bg-border" />
                      </div>
                      <form
                        className="flex flex-col gap-2.5"
                        onSubmit={submitLogin}
                      >
                        <label className="relative block">
                          <span className="sr-only">Email</span>
                          <Mail
                            aria-hidden="true"
                            className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
                          />
                          <input
                            aria-label="Email"
                            type="email"
                            autoComplete="email"
                            required
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                            placeholder="Enter your email"
                            className={`${signupInputClass} pl-12`}
                          />
                        </label>
                        <label className="relative block">
                          <span className="sr-only">Password</span>
                          <LockKeyhole
                            aria-hidden="true"
                            className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
                          />
                          <input
                            aria-label="Password"
                            type={showPassword ? "text" : "password"}
                            autoComplete="current-password"
                            minLength={8}
                            required
                            value={password}
                            onChange={(event) =>
                              setPassword(event.target.value)
                            }
                            placeholder="Enter your password"
                            className={`${signupInputClass} pl-12 pr-12`}
                          />
                          <button
                            type="button"
                            aria-label={
                              showPassword ? "Hide password" : "Show password"
                            }
                            onClick={() =>
                              setShowPassword((visible) => !visible)
                            }
                            className="absolute right-1 top-1 flex size-10 items-center justify-center rounded-[8px] text-muted-foreground hover:bg-muted"
                          >
                            {showPassword ? (
                              <EyeOff className="size-4" />
                            ) : (
                              <Eye className="size-4" />
                            )}
                          </button>
                        </label>
                        <div className="mt-0.5 flex justify-start">
                          <button
                            type="button"
                            onClick={() => go("forgot")}
                            className="min-h-9 text-sm text-muted-foreground hover:text-icon-accent hover:underline"
                          >
                            Forgot Password?
                          </button>
                        </div>
                        {error && (
                          <p
                            role="alert"
                            className="text-sm text-accent-foreground"
                          >
                            {error}
                          </p>
                        )}
                        <button
                          type="submit"
                          className={`${filledButton} mt-[18px] w-full`}
                        >
                          Login
                        </button>
                      </form>
                    </div>
                  )}
                  {screen === "signup" && (
                    <div className="mt-7">
                      <form
                        className="flex flex-col gap-2.5"
                        onSubmit={submitSignup}
                      >
                        <label className="relative block">
                          <span className="sr-only">Your name</span>
                          <UserRound
                            aria-hidden="true"
                            className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
                          />
                          <input
                            aria-label="Your name"
                            autoComplete="name"
                            required
                            value={fullName}
                            onChange={(event) =>
                              setFullName(event.target.value)
                            }
                            placeholder="Your name"
                            className={`${signupInputClass} pl-12`}
                          />
                        </label>
                        <label className="relative block">
                          <span className="sr-only">Email</span>
                          <Mail
                            aria-hidden="true"
                            className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
                          />
                          <input
                            aria-label="Email"
                            type="email"
                            autoComplete="email"
                            required
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                            placeholder="Enter your email"
                            className={`${signupInputClass} pl-12`}
                          />
                        </label>
                        <label className="relative block">
                          <span className="sr-only">Password</span>
                          <LockKeyhole
                            aria-hidden="true"
                            className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
                          />
                          <input
                            aria-label="Password"
                            type={showPassword ? "text" : "password"}
                            autoComplete="new-password"
                            required
                            value={password}
                            onChange={(event) =>
                              setPassword(event.target.value)
                            }
                            placeholder="Enter your password"
                            className={`${signupInputClass} pl-12 pr-12`}
                          />
                          <button
                            type="button"
                            aria-label={
                              showPassword ? "Hide password" : "Show password"
                            }
                            onClick={() =>
                              setShowPassword((visible) => !visible)
                            }
                            className="absolute right-1 top-1 flex size-10 items-center justify-center rounded-[8px] text-muted-foreground hover:bg-muted"
                          >
                            {showPassword ? (
                              <EyeOff className="size-4" />
                            ) : (
                              <Eye className="size-4" />
                            )}
                          </button>
                        </label>
                        <label className="relative block">
                          <span className="sr-only">Confirm your password</span>
                          <LockKeyhole
                            aria-hidden="true"
                            className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
                          />
                          <input
                            aria-label="Confirm your password"
                            type={showConfirmPassword ? "text" : "password"}
                            autoComplete="new-password"
                            required
                            value={confirmPassword}
                            onChange={(event) =>
                              setConfirmPassword(event.target.value)
                            }
                            placeholder="Confirm your password"
                            className={`${signupInputClass} pl-12 pr-12`}
                          />
                          <button
                            type="button"
                            aria-label={
                              showConfirmPassword
                                ? "Hide password"
                                : "Show password"
                            }
                            onClick={() =>
                              setShowConfirmPassword((visible) => !visible)
                            }
                            className="absolute right-1 top-1 flex size-10 items-center justify-center rounded-[8px] text-muted-foreground hover:bg-muted"
                          >
                            {showConfirmPassword ? (
                              <EyeOff className="size-4" />
                            ) : (
                              <Eye className="size-4" />
                            )}
                          </button>
                        </label>
                        <ul
                          aria-label="Password requirements"
                          aria-live="polite"
                          className="mt-1 grid gap-1.5"
                        >
                          {passwordRules.map((rule, index) => {
                            const met = rule.test(password);
                            const labels = [
                              "At least 8 characters",
                              "At least 1 number",
                              "Both upper and lower case letters",
                            ];
                            return (
                              <li
                                key={rule.label}
                                aria-label={`${labels[index]}: ${met ? "met" : "not met"}`}
                                className={`flex items-center gap-2 text-sm ${met ? "text-icon-accent" : password.length > 0 ? "text-[#A85757]" : "text-muted-foreground"}`}
                              >
                                {met ? (
                                  <Check
                                    aria-hidden="true"
                                    className="size-4 shrink-0"
                                  />
                                ) : (
                                  <Circle
                                    aria-hidden="true"
                                    className="size-2 shrink-0 fill-current"
                                  />
                                )}
                                {labels[index]}
                              </li>
                            );
                          })}
                        </ul>
                        {error && (
                          <p
                            role="alert"
                            className="text-sm text-accent-foreground"
                          >
                            {error}
                          </p>
                        )}
                        <button
                          type="submit"
                          className={`${filledButton} mt-[18px] w-full`}
                        >
                          Sign Up
                        </button>
                        <p className="mt-4 text-center text-sm leading-5 text-muted-foreground">
                          By signing up, you agree to our{" "}
                          <a
                            href="#privacy-policy"
                            className="font-semibold text-icon-accent underline-offset-4 hover:underline"
                          >
                            Privacy Policy
                          </a>
                        </p>
                      </form>
                    </div>
                  )}
                </div>
              )}
              {screen === "intro" && (
                <div className="animate-[fade-in_260ms_ease-out] flex min-h-0 flex-1 flex-col md:justify-center">
                  {/* ---------- MOBILE: fixed skeleton, identical on every slide ---------- */}
                  <div className="flex min-h-0 flex-1 flex-col md:hidden">
                    {/* illustration: takes whatever height is left, never moves the text */}
                    <div
                      className="flex min-h-0 flex-1 items-center justify-center"
                      style={{ paddingTop: u(80) }}
                    >
                      <img
                        src={slideIllustration}
                        alt=""
                        className={`block max-w-none shrink-0 object-contain object-center ${slideIndex === 0 ? "w-full" : "aspect-square"}`}
                        style={{
                          height: `min(${u(slideIndex === 0 ? 258 : 320)}, 100%)`,
                          transform:
                            slideIndex === 2
                              ? `translateY(${u(-20)})`
                              : undefined,
                        }}
                      />
                    </div>

                    {/* text + dots + buttons: every height is fixed */}
                    <div
                      className="relative flex-none text-center"
                      style={{ marginTop: u(-24) }}
                    >
                      <div
                        className="flex flex-col items-center justify-end"
                        style={{ height: u(66) }}
                      >
                        <h1
                          className="font-bold tracking-tight"
                          style={{ fontSize: u(30), lineHeight: u(33) }}
                        >
                          {slide.title}
                        </h1>
                      </div>
                      <p
                        className="text-muted-foreground"
                        style={{
                          marginTop: u(8),
                          height: u(56),
                          fontSize: u(16),
                          lineHeight: u(28),
                        }}
                      >
                        {slide.body}
                      </p>
                      <div
                        className="flex items-center justify-center"
                        style={{
                          height: u(22),
                          paddingTop: u(16),
                          gap: u(10),
                        }}
                        role="group"
                        aria-label={`Slide ${slideIndex + 1} of ${slides.length}`}
                      >
                        {slides.map((item, index) => (
                          <span
                            key={item.title}
                            className={`rounded-full transition-all ${index === slideIndex ? "bg-primary" : "bg-muted-foreground/50"}`}
                            style={{
                              height: u(6),
                              width: index === slideIndex ? u(20) : u(6),
                            }}
                          />
                        ))}
                      </div>
                      {renderIntroCtas(true)}
                    </div>

                    {/* empty space under the buttons (≈123 + 24 padding on the moto).
                        It shrinks first on short screens. Set to 0 to pin the buttons lower. */}
                    <div
                      aria-hidden="true"
                      className="min-h-0"
                      style={{ flex: `0 1 ${u(123)}` }}
                    />
                  </div>

                  {/* ---------- DESKTOP / TABLET (unchanged look) ---------- */}
                  <div className="hidden h-[370px] flex-none flex-col justify-center text-left md:flex">
                    <div className="flex h-[172px] flex-none flex-col items-start justify-center gap-2">
                      <h1 className="mt-8 max-w-xl text-4xl font-bold leading-[1.1] tracking-tight">
                        {slide.title}
                      </h1>
                      <p className="max-w-lg text-base leading-7 text-muted-foreground">
                        {slide.body}
                      </p>
                    </div>
                    <div
                      className="mt-1 flex h-[6px] flex-none items-center justify-center gap-2.5"
                      role="group"
                      aria-label={`Slide ${slideIndex + 1} of ${slides.length}`}
                    >
                      {slides.map((item, index) => (
                        <span
                          key={item.title}
                          className={`h-[6px] rounded-full transition-all ${index === slideIndex ? "w-5 bg-primary" : "w-[6px] bg-muted-foreground/50"}`}
                        />
                      ))}
                    </div>
                    {renderIntroCtas(false)}
                  </div>
                </div>
              )}

              {screen === "login" && (
                <div className="hidden md:block">
                  <h1 className="text-3xl font-semibold leading-tight tracking-tight md:text-4xl">
                    Welcome Back!
                  </h1>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Sign in to your workspace and pick up where you left off.
                  </p>
                  {notice && (
                    <p
                      role="status"
                      className="mt-4 rounded-xl bg-primary-soft px-4 py-3 text-sm text-icon-accent"
                    >
                      {notice}
                    </p>
                  )}
                  <div className="mt-6 grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => { void signInWithProvider("apple"); }}
                      className={outlinedButton}
                    >
                      <img
                        src={appleIcon}
                        alt=""
                        aria-hidden="true"
                        className="size-5 shrink-0 object-contain"
                      />
                      Login with Apple
                    </button>
                    <button
                      type="button"
                      onClick={() => { void signInWithProvider("google"); }}
                      className={`${outlinedButton} w-full`}
                    >
                      <img
                        src={googleIcon}
                        alt=""
                        aria-hidden="true"
                        className="size-5 shrink-0 object-contain"
                      />
                      Login with Google
                    </button>
                  </div>
                  <div className="my-6 flex items-center gap-3 text-sm text-muted-foreground">
                    <span className="h-px grow bg-border" />
                    Or Continue with Email
                    <span className="h-px grow bg-border" />
                  </div>
                  <form className="grid gap-4" onSubmit={submitLogin}>
                    <label className="grid gap-2 text-base font-semibold">
                      Email
                      <input
                        type="email"
                        autoComplete="email"
                        required
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        placeholder="Enter your email"
                        className={inputClass}
                      />
                    </label>
                    <label className="grid gap-2 text-base font-semibold">
                      Password
                      <span className="relative block">
                        <input
                          type={showPassword ? "text" : "password"}
                          autoComplete="current-password"
                          minLength={8}
                          required
                          value={password}
                          onChange={(event) => setPassword(event.target.value)}
                          placeholder="Enter your password"
                          className={`${inputClass} pr-12`}
                        />
                        <button
                          type="button"
                          aria-label={
                            showPassword ? "Hide password" : "Show password"
                          }
                          onClick={() => setShowPassword((visible) => !visible)}
                          className="absolute right-1 top-1 flex size-10 items-center justify-center rounded-[8px] text-muted-foreground hover:bg-muted"
                        >
                          {showPassword ? (
                            <EyeOff className="size-4" />
                          ) : (
                            <Eye className="size-4" />
                          )}
                        </button>
                      </span>
                    </label>
                    <div className="-mt-1 flex justify-start">
                      <button
                        type="button"
                        onClick={() => go("forgot")}
                        className="min-h-9 text-sm font-semibold text-icon-accent hover:underline"
                      >
                        Forgot Password?
                      </button>
                    </div>
                    {error && (
                      <p
                        role="alert"
                        className="text-sm text-accent-foreground"
                      >
                        {error}
                      </p>
                    )}
                    <button type="submit" className={`${filledButton} w-full`}>
                      Login
                      <ArrowRight className="size-4" />
                    </button>
                  </form>
                </div>
              )}

              {screen === "signup" && (
                <div className="hidden md:block">
                  <h1 className="text-3xl font-semibold leading-tight tracking-tight md:text-4xl">
                    Welcome to Hawk
                  </h1>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Create your account and get started with Hawk.
                  </p>
                  <form className="mt-6 grid gap-4" onSubmit={submitSignup}>
                    <label className="grid gap-2 text-base font-semibold">
                      Your full name
                      <input
                        autoComplete="name"
                        required
                        value={fullName}
                        onChange={(event) => setFullName(event.target.value)}
                        placeholder="Your full name"
                        className={signupInputClass}
                      />
                    </label>
                    <label className="grid gap-2 text-base font-semibold">
                      Email
                      <input
                        type="email"
                        autoComplete="email"
                        required
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        placeholder="Enter your email"
                        className={signupInputClass}
                      />
                    </label>
                    <label className="grid gap-2 text-base font-semibold">
                      Password
                      <span className="relative block">
                        <input
                          type={showPassword ? "text" : "password"}
                          autoComplete="new-password"
                          required
                          value={password}
                          onChange={(event) => setPassword(event.target.value)}
                          placeholder="Create a password"
                          className={`${signupInputClass} pr-12`}
                        />
                        <button
                          type="button"
                          aria-label={
                            showPassword ? "Hide password" : "Show password"
                          }
                          onClick={() => setShowPassword((visible) => !visible)}
                          className="absolute right-1 top-1 flex size-10 items-center justify-center rounded-[8px] text-muted-foreground hover:bg-muted"
                        >
                          {showPassword ? (
                            <EyeOff className="size-4" />
                          ) : (
                            <Eye className="size-4" />
                          )}
                        </button>
                      </span>
                    </label>
                    <ul
                      aria-label="Password requirements"
                      aria-live="polite"
                      className="-mt-2 grid gap-1"
                    >
                      {passwordRules.map((rule) => {
                        const met = rule.test(password);
                        const conditionColor = met
                          ? "text-icon-accent"
                          : password.length > 0
                            ? "text-[#A85757]"
                            : "text-muted-foreground";
                        const bulletColor = met
                          ? "bg-primary"
                          : password.length > 0
                            ? "bg-[#A85757]"
                            : "bg-muted-foreground";
                        return (
                          <li
                            key={rule.label}
                            aria-label={`${rule.label}: ${met ? "met" : "not met"}`}
                            className={`flex items-center gap-2 text-sm ${conditionColor}`}
                          >
                            <span
                              aria-hidden="true"
                              className={`size-2 shrink-0 rounded-full ${bulletColor}`}
                            />
                            {rule.label}
                          </li>
                        );
                      })}
                    </ul>
                    <label className="grid gap-2 text-base font-semibold">
                      Confirm your password
                      <span className="relative block">
                        <input
                          type={showConfirmPassword ? "text" : "password"}
                          autoComplete="new-password"
                          required
                          value={confirmPassword}
                          onChange={(event) =>
                            setConfirmPassword(event.target.value)
                          }
                          placeholder="Confirm your password"
                          className={`${signupInputClass} pr-12`}
                        />
                        <button
                          type="button"
                          aria-label={
                            showConfirmPassword
                              ? "Hide password"
                              : "Show password"
                          }
                          onClick={() =>
                            setShowConfirmPassword((visible) => !visible)
                          }
                          className="absolute right-1 top-1 flex size-10 items-center justify-center rounded-[8px] text-muted-foreground hover:bg-muted"
                        >
                          {showConfirmPassword ? (
                            <EyeOff className="size-4" />
                          ) : (
                            <Eye className="size-4" />
                          )}
                        </button>
                      </span>
                    </label>
                    {error && (
                      <p
                        role="alert"
                        className="text-sm text-accent-foreground"
                      >
                        {error}
                      </p>
                    )}
                    <button type="submit" className={`${filledButton} w-full`}>
                      Sign up
                      <ArrowRight className="size-4" />
                    </button>
                  </form>
                  <p className="mt-2 text-center text-sm leading-5 text-muted-foreground">
                    By signing up, you agree to our{" "}
                    <span className="font-semibold text-icon-accent">
                      Terms of Service
                    </span>{" "}
                    and{" "}
                    <span className="font-semibold text-icon-accent">
                      Privacy Policy
                    </span>
                    .
                  </p>
                </div>
              )}

              {screen === "email-verify" && (
                <div className="-translate-y-4">
                  <span className="mx-auto mb-6 flex size-20 items-center justify-center rounded-full bg-primary-soft text-icon-accent">
                    <Mail className="size-10" />
                  </span>
                  <p className="mb-2 text-sm font-semibold text-icon-accent">
                    Verify your account
                  </p>
                  <h1 className="text-3xl font-bold leading-tight tracking-tight md:text-4xl">
                    Verify your email
                  </h1>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    Enter the 4-character code sent to{" "}
                    <span className="font-semibold text-foreground">
                      {email}
                    </span>
                    .
                  </p>
                  <form
                    className="mt-7 grid gap-6"
                    onSubmit={submitEmailVerification}
                  >
                    <OtpFields
                      value={emailVerificationCode}
                      onChange={setEmailVerificationCode}
                      label="Email verification code"
                    />
                    {error && (
                      <p
                        role="alert"
                        className="text-center text-sm text-accent-foreground"
                      >
                        {error}
                      </p>
                    )}
                    <div className="grid gap-3">
                      <button
                        type="submit"
                        disabled={emailVerificationCode.length !== 4}
                        className={`${filledButton} w-full`}
                      >
                        Verify email
                        <ArrowRight className="size-4" />
                      </button>
                      <button
                        type="button"
                        onClick={goLogin}
                        className={`${outlinedButton} w-full`}
                      >
                        Back to Login
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setEmailVerificationCode("");
                        setNotice("A new email verification code is ready.");
                      }}
                      className="min-h-9 text-sm font-semibold text-icon-accent hover:underline"
                    >
                      Didn't receive a code? Resend
                    </button>
                    {notice && (
                      <p
                        role="status"
                        className="-mt-5 text-center text-sm text-icon-accent"
                      >
                        {notice}
                      </p>
                    )}
                  </form>
                </div>
              )}

              {screen === "email-verified" && (
                <div className="-translate-y-4">
                  <span className="mx-auto mb-6 flex size-20 items-center justify-center rounded-full bg-primary-soft text-icon-accent">
                    <ShieldCheck className="size-10" />
                  </span>
                  <p className="mb-2 text-sm font-semibold text-icon-accent">
                    Email confirmed
                  </p>
                  <h1 className="text-3xl font-bold leading-tight tracking-tight md:text-4xl">
                    Your email is verified
                  </h1>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    <span className="font-semibold text-foreground">
                      {email}
                    </span>{" "}
                    is ready to use with your Hawk account.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setInviteCode("");
                      go("invite");
                    }}
                    className={`${filledButton} mt-7 w-full`}
                  >
                    Next
                    <ArrowRight className="size-4" />
                  </button>
                </div>
              )}

              {screen === "invite" && (
                <div className="-translate-y-4">
                  <span className="mx-auto mb-6 flex size-20 items-center justify-center rounded-full bg-primary-soft text-icon-accent">
                    <ShieldCheck className="size-10" />
                  </span>
                  <p className="mb-2 text-sm font-semibold text-icon-accent">
                    Connect your school
                  </p>
                  <h1 className="text-3xl font-bold leading-tight tracking-tight md:text-4xl">
                    School invite code
                  </h1>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    Enter the 4-character invite code provided by your school
                    admin.
                  </p>
                  <form className="mt-7 grid gap-6" onSubmit={submitInvite}>
                    <OtpFields
                      value={inviteCode}
                      onChange={setInviteCode}
                      label="School invite code"
                    />
                    {error && (
                      <p
                        role="alert"
                        className="text-center text-sm text-accent-foreground"
                      >
                        {error}
                      </p>
                    )}
                    <div className="grid gap-3">
                      <button
                        type="submit"
                        disabled={inviteCode.length !== 4}
                        className={`${filledButton} w-full`}
                      >
                        Verify Now
                        <ArrowRight className="size-4" />
                      </button>
                      <button
                        type="button"
                        onClick={goLogin}
                        className={`${outlinedButton} w-full`}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {screen === "forgot" && (
                <div>
                  <span className="mb-5 flex size-12 items-center justify-center rounded-2xl bg-primary-soft text-icon-accent">
                    <Mail className="size-6" />
                  </span>
                  <p className="mb-2 text-sm font-semibold text-icon-accent">
                    Account recovery
                  </p>
                  <h1 className="text-3xl font-bold leading-tight tracking-tight md:text-4xl">
                    Forgot password?
                  </h1>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    Enter your email and we’ll help you reset your password.
                  </p>
                  <form className="mt-7 grid gap-4" onSubmit={submitForgot}>
                    <label className="grid gap-2 text-sm font-semibold">
                      Email
                      <input
                        type="email"
                        autoComplete="email"
                        required
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        placeholder="Enter your email"
                        className={inputClass}
                      />
                    </label>
                    {error && (
                      <p
                        role="alert"
                        className="text-sm text-accent-foreground"
                      >
                        {error}
                      </p>
                    )}
                    {notice && <p role="status" className="text-sm text-icon-accent">{notice}</p>}
                    <button type="submit" className={`${filledButton} w-full`}>
                      Continue
                      <ArrowRight className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={goLogin}
                      className={`${outlinedButton} w-full`}
                    >
                      Cancel
                    </button>
                  </form>
                </div>
              )}

              {screen === "forgot-verify" && (
                <div>
                  <span className="mb-5 flex size-12 items-center justify-center rounded-2xl bg-primary-soft text-icon-accent">
                    <Mail className="size-6" />
                  </span>
                  <p className="mb-2 text-sm font-semibold text-icon-accent">
                    Check your inbox
                  </p>
                  <h1 className="text-3xl font-bold leading-tight tracking-tight md:text-4xl">
                    Enter verification code
                  </h1>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    We've sent a verification code to{" "}
                    <span className="font-semibold text-foreground">
                      {email}
                    </span>
                    .
                  </p>
                  <form
                    className="mt-7 grid gap-5"
                    onSubmit={submitVerification}
                  >
                    <OtpFields
                      value={verificationCode}
                      onChange={setVerificationCode}
                      label="Verification code"
                    />
                    {error && (
                      <p
                        role="alert"
                        className="text-center text-sm text-accent-foreground"
                      >
                        {error}
                      </p>
                    )}
                    <button
                      type="submit"
                      disabled={verificationCode.length !== 4}
                      className={`${filledButton} w-full`}
                    >
                      Verify Now
                      <ArrowRight className="size-4" />
                    </button>
                    <div className="text-center">
                      <button
                        type="button"
                        onClick={() => {
                          setVerificationCode("");
                          setNotice("A new verification code is ready.");
                        }}
                        className="min-h-9 text-sm font-semibold text-icon-accent hover:underline"
                      >
                        Didn't receive any code? Resend Code
                      </button>
                    </div>
                    {notice && (
                      <p
                        role="status"
                        className="text-center text-sm text-icon-accent"
                      >
                        {notice}
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={goLogin}
                      className={`${outlinedButton} w-full`}
                    >
                      Cancel
                    </button>
                  </form>
                </div>
              )}

              {screen === "reset" && (
                <div>
                  <span className="mb-5 flex size-12 items-center justify-center rounded-2xl bg-primary-soft text-icon-accent">
                    <ShieldCheck className="size-6" />
                  </span>
                  <p className="mb-2 text-sm font-semibold text-icon-accent">
                    Almost done
                  </p>
                  <h1 className="text-3xl font-bold leading-tight tracking-tight md:text-4xl">
                    Reset your password
                  </h1>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    Choose a new password for your Hawk account.
                  </p>
                  <form className="mt-7 grid gap-4" onSubmit={submitReset}>
                    <label className="grid gap-2 text-sm font-semibold">
                      New password
                      <input
                        type="password"
                        autoComplete="new-password"
                        minLength={8}
                        required
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        placeholder="New password"
                        className={inputClass}
                      />
                    </label>
                    <label className="grid gap-2 text-sm font-semibold">
                      Confirm password
                      <input
                        type="password"
                        autoComplete="new-password"
                        minLength={8}
                        required
                        value={confirmPassword}
                        onChange={(event) =>
                          setConfirmPassword(event.target.value)
                        }
                        placeholder="Confirm new password"
                        className={inputClass}
                      />
                    </label>
                    {error && (
                      <p
                        role="alert"
                        className="text-sm text-accent-foreground"
                      >
                        {error}
                      </p>
                    )}
                    <button type="submit" className={`${filledButton} w-full`}>
                      Continue
                      <ArrowRight className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={goLogin}
                      className={`${outlinedButton} w-full`}
                    >
                      Cancel
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
