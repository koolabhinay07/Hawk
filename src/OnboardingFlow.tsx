import { useEffect, useRef, useState, type FormEvent } from "react";
import onboardingSlideTwo from "./assets/onboarding-slide-2.svg";
import onboardingSlideThree from "./assets/onboarding-slide-3.svg";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Eye,
  EyeOff,
  Mail,
  ShieldCheck,
} from "lucide-react";
import onboardingSlideOne from "./assets/onboarding-slide-1.svg";

const onboardingIllustrations = [onboardingSlideOne, onboardingSlideTwo, onboardingSlideThree];

type FlowScreen = "intro" | "login" | "signup" | "email-verify" | "email-verified" | "invite" | "forgot" | "forgot-verify" | "reset";

const slides = [
  {
    eyebrow: "A better school day starts here",
    title: "Your school day, Simplified.",
    body: "From attendance to proxies — everything a teacher needs, in one place.",
    points: ["Mark attendance instantly", "Send notices to parents instantly", "Track your class results"],
  },
  {
    eyebrow: "Made to feel natural",
    title: "User Friendly at its Core",
    body: "Find what you need quickly, with simple tools that make every school day easier to manage.",
    points: ["Clear, familiar actions", "Easy to learn", "Designed for busy days"],
  },
  {
    eyebrow: "Everything in its place",
    title: "Effortless Classroom Management",
    body: "Keep track of lessons, attendance, and school updates without losing sight of what matters.",
    points: ["Your day at a glance", "Attendance when you need it", "Updates for your classes"],
  },
];

const passwordRules = [
  { label: "At least 8 characters", test: (value: string) => value.length >= 8 },
  { label: "At least 1 number", test: (value: string) => /\d/.test(value) },
  { label: "Upper and lower case letters", test: (value: string) => /[a-z]/.test(value) && /[A-Z]/.test(value) },
];

function OtpFields({ value, onChange, label }: { value: string; onChange: (value: string) => void; label: string }) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const focusAt = (index: number) => refs.current[Math.max(0, Math.min(index, 3))]?.focus();

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
    const next = (value.slice(0, index) + characters + value.slice(index + 1)).slice(0, 4);
    onChange(next);
    focusAt(Math.min(index + 1, 3));
  }

  return (
    <div role="group" aria-label={label} className="flex justify-center gap-3 py-1">
      {Array.from({ length: 4 }, (_, index) => {
        const digit = value[index] ?? "";
        return (
          <input
            key={index}
            ref={(element) => { refs.current[index] = element; }}
            aria-label={`${label}, character ${index + 1}`}
            autoComplete={index === 0 ? "one-time-code" : "off"}
            inputMode="text"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={4}
            value={digit}
            onChange={(event) => setCharacter(index, event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Backspace" && !digit && index > 0) focusAt(index - 1);
              if (event.key === "ArrowLeft") focusAt(index - 1);
              if (event.key === "ArrowRight") focusAt(index + 1);
            }}
            onPaste={(event) => {
              const pasted = event.clipboardData.getData("text").replace(/[^a-z\d]/gi, "").toUpperCase().slice(0, 4);
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
  return (
    <span className="text-xl font-bold tracking-tight">Hawk</span>
  );
}

function ShowcasePanel({ screen, slideIndex }: { screen: FlowScreen; slideIndex: number }) {
  const slide = slides[slideIndex];
  return (
    <aside className="relative hidden min-h-dvh overflow-hidden bg-primary text-primary-foreground lg:flex lg:flex-col lg:justify-between lg:p-10 xl:p-14">
      <Brand />
      <div className="relative mx-auto w-full max-w-xl py-12">
        {screen === "intro" ? (
          <>
            <p className="mb-3 text-sm font-semibold tracking-wide text-primary-container">{slide.eyebrow}</p>
            <h2 className="max-w-lg text-4xl font-bold leading-tight tracking-tight xl:text-5xl">A calmer day for every classroom.</h2>
            <p className="mt-5 max-w-md text-base leading-7 text-primary-foreground/80">Hawk brings the everyday work of teaching into one clear, welcoming space.</p>
            <div className="mt-9 flex max-w-lg flex-wrap gap-x-6 gap-y-2 text-sm font-semibold text-primary-foreground/90">
              {slide.points.map((point) => <span key={point}>{point}</span>)}
            </div>
          </>
        ) : (
          <>
            <p className="mb-3 text-sm font-semibold tracking-wide text-primary-container">Your teaching day, in one place</p>
            <h2 className="max-w-lg text-4xl font-bold leading-tight tracking-tight xl:text-5xl">Make room for what matters.</h2>
            <p className="mt-5 max-w-md text-base leading-7 text-primary-foreground/80">Sign in to pick up where your school day begins.</p>
            <div className="mt-10 max-w-lg rounded-[28px] bg-primary-foreground/10 p-6 ring-1 ring-primary-foreground/15">
              <div className="flex items-center justify-between border-b border-primary-foreground/15 pb-4">
                <span className="text-sm font-semibold">Today at a glance</span>
                <span className="rounded-full bg-primary-container px-3 py-1 text-xs font-bold text-on-primary-container">Your school</span>
              </div>
              <div className="mt-5 flex items-center gap-4">
                <span className="flex size-12 items-center justify-center rounded-2xl bg-primary-container text-on-primary-container"><BookOpen className="size-6" /></span>
                <div><p className="font-semibold">Classes and attendance</p><p className="mt-1 text-sm text-primary-foreground/70">Ready when you are</p></div>
                <ArrowRight aria-hidden="true" className="ml-auto size-5 text-primary-container" />
              </div>
            </div>
          </>
        )}
      </div>
      <p className="relative text-sm text-primary-foreground/65">A shared workspace for better school days.</p>
    </aside>
  );
}

export default function OnboardingFlow({ onComplete }: { onComplete: (profile?: { fullName: string; email: string }) => void }) {
  const [screen, setScreen] = useState<FlowScreen>("intro");
  const [slideIndex, setSlideIndex] = useState(0);
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

  useEffect(() => {
    try {
      document.documentElement.dataset.appearance = window.localStorage.getItem("hawk-appearance") === "dark" ? "dark" : "light";
    } catch {
      document.documentElement.dataset.appearance = "light";
    }
  }, []);

  function go(next: FlowScreen) {
    setError("");
    setNotice("");
    setScreen(next);
  }

  function goLogin() {
    setPassword("");
    setConfirmPassword("");
    setVerificationCode("");
    go("login");
  }

  function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onComplete();
  }

  function submitSignup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!passwordRules.every((rule) => rule.test(password))) {
      setError("Your password does not meet all the requirements yet.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Those passwords do not match. Please try again.");
      return;
    }
    setEmailVerificationCode("");
    go("email-verify");
  }

  function submitEmailVerification(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (emailVerificationCode.length !== 4) {
      setError("Enter the 4-character email verification code.");
      return;
    }
    go("email-verified");
  }

  function submitInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inviteCode.length !== 4) {
      setError("Enter the 4-character code from your school administrator.");
      return;
    }
    onComplete({ fullName: fullName.trim(), email: email.trim() });
  }

  function submitForgot(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setVerificationCode("");
    go("forgot-verify");
  }

  function submitVerification(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (verificationCode.length !== 4) {
      setError("Enter the 4-character verification code.");
      return;
    }
    setPassword("");
    setConfirmPassword("");
    go("reset");
  }

  function submitReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password.length < 8) {
      setError("Use at least 8 characters for your new password.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Those passwords do not match. Please try again.");
      return;
    }
    goLogin();
    setNotice("Your password has been reset. You can now log in.");
  }

  const slide = slides[slideIndex];
  const slideIllustration = onboardingIllustrations[slideIndex];
  const inputClass = "min-h-12 w-full rounded-xl border border-border bg-background px-4 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-ring/20";
  const signupInputClass = inputClass.replace("text-sm", "text-base");
  const filledButton = "inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground transition-colors hover:brightness-95 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50";
  const outlinedButton = "inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-border bg-card px-5 text-sm font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-offset-2";
  const isIntro = screen === "intro";
  const isFirstIntroSlide = isIntro && slideIndex === 0;
  const showLoginHeader = screen === "login" || screen === "signup";

  return (
    <main className={isIntro ? "relative min-h-dvh bg-background text-foreground md:flex md:items-center md:justify-center md:bg-[#f7f8f3]" : "grid min-h-dvh bg-background text-foreground lg:grid-cols-[minmax(0,1fr)_minmax(470px,0.9fr)]"}>
      {isIntro && (
        <div className="absolute inset-x-0 top-0 z-10 hidden items-center justify-between px-6 pt-6 md:flex">
          <Brand />
          <span className="text-sm font-semibold text-muted-foreground">Teacher workspace</span>
        </div>
      )}
      <div className={isIntro ? "contents md:mx-auto md:grid md:min-h-dvh md:w-full md:max-w-[1100px] md:grid-cols-2 md:items-center" : "contents"}>
        <div className={isIntro ? "hidden md:flex md:items-center md:justify-center md:px-6" : "contents"}>
          {isIntro ? <img src={slideIllustration} alt="" className="h-auto max-h-[520px] w-full max-w-full object-contain" /> : <ShowcasePanel screen={screen} slideIndex={slideIndex} />}
        </div>
        <section className={isIntro ? "flex min-h-dvh min-w-0 flex-col md:h-fit md:min-h-0 md:w-full md:justify-center md:overflow-visible" : "flex min-h-dvh min-w-0 flex-col lg:max-h-dvh lg:overflow-y-auto"}>
        <div className={`mx-auto flex w-full max-w-[560px] grow flex-col ${isFirstIntroSlide ? "px-6 py-6 sm:px-6 md:grow-0 md:px-6 md:py-6" : "px-5 py-6 sm:px-10 sm:py-9 md:grow-0 md:px-6 md:py-6 lg:px-6 lg:py-6"}`}>
          <div className={`flex items-center justify-between ${isIntro ? "md:hidden" : ""}`}>
            <div className={isFirstIntroSlide ? "" : "lg:hidden"}><Brand /></div>
            {!isFirstIntroSlide && <div className="hidden lg:block" />}
            {showLoginHeader ? (
              <div className="flex items-center rounded-full bg-muted p-1" role="tablist" aria-label="Account access">
                <button type="button" role="tab" aria-selected={screen === "login"} onClick={() => go("login")} className={`min-h-9 rounded-full px-4 text-sm font-semibold transition-colors ${screen === "login" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}>Log in</button>
                <button type="button" role="tab" aria-selected={screen === "signup"} onClick={() => go("signup")} className={`min-h-9 rounded-full px-4 text-sm font-semibold transition-colors ${screen === "signup" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}>Sign up</button>
              </div>
            ) : !isIntro && screen !== "invite" && screen !== "email-verify" && screen !== "email-verified" ? (
              <button type="button" onClick={goLogin} className="inline-flex min-h-10 items-center gap-1 rounded-full px-3 text-sm font-semibold text-icon-accent hover:bg-primary-soft"><ArrowLeft className="size-4" />Log in</button>
            ) : <span className="text-sm font-semibold text-muted-foreground">Teacher workspace</span>}
          </div>

          <div className={isFirstIntroSlide ? "flex-1 pt-8 md:flex-none md:pt-0" : "my-auto py-10 md:my-0 md:py-0"}>
            {screen === "intro" && (
              <div className="animate-[fade-in_260ms_ease-out]">
                {isFirstIntroSlide && (
                  <div className="flex h-[min(55dvh,480px)] items-center justify-center md:hidden">
                    <img src={onboardingSlideOne} alt="" className="h-full w-full object-contain" />
                  </div>
                )}
                {isFirstIntroSlide && (
                  <div className="-mt-20 flex items-center justify-center gap-2.5 md:hidden" role="group" aria-label={`Slide ${slideIndex + 1} of ${slides.length}`}>
                    {slides.map((item, index) => <span key={item.title} className={`h-[6px] rounded-full transition-all ${index === slideIndex ? "w-5 bg-primary" : "w-[6px] bg-muted-foreground/50"}`} />)}
                  </div>
                )}
                <div className={isFirstIntroSlide ? "mt-6 text-center md:text-left" : ""}>
                  {!isFirstIntroSlide && <p className="mb-2 text-sm font-semibold text-icon-accent">{slide.eyebrow}</p>}
                  <h1 className={`max-w-xl text-3xl font-bold leading-tight tracking-tight md:text-4xl ${isFirstIntroSlide ? "mx-auto md:mx-0" : ""}`}>{slide.title}</h1>
                  <p className={`mt-4 max-w-lg text-base leading-7 text-muted-foreground ${isFirstIntroSlide ? "mx-auto md:mx-0" : ""}`}>{slide.body}</p>
                </div>
                {isFirstIntroSlide && (
                  <div className="mt-7 hidden items-center justify-center gap-2.5 md:flex" role="group" aria-label={`Slide ${slideIndex + 1} of ${slides.length}`}>
                    {slides.map((item, index) => <span key={item.title} className={`h-[6px] rounded-full transition-all ${index === slideIndex ? "w-5 bg-primary" : "w-[6px] bg-muted-foreground/50"}`} />)}
                  </div>
                )}
                {!isFirstIntroSlide && (
                  <div className="mt-7 hidden items-center justify-center gap-2.5 md:flex" role="group" aria-label={`Slide ${slideIndex + 1} of ${slides.length}`}>
                    {slides.map((item, index) => <span key={item.title} className={`h-3 rounded-full transition-all ${index === slideIndex ? "w-8 bg-primary" : "w-3 bg-muted-foreground/50"}`} />)}
                  </div>
                )}
                {!isFirstIntroSlide && (
                  <div className="mt-7 rounded-3xl border border-border bg-card p-5 sm:p-6">
                    <div><p className="text-base font-semibold">A thoughtful workspace for teachers</p><p className="mt-1 text-sm text-muted-foreground">Simple tools, organized around your day.</p></div>
                    <ul className="mt-5 grid gap-3 sm:grid-cols-3">
                      {slide.points.map((point) => <li key={point} className="text-sm leading-5 text-muted-foreground">{point}</li>)}
                    </ul>
                  </div>
                )}
                {!isFirstIntroSlide && (
                  <div className="mt-7 flex items-center justify-center gap-2.5 md:hidden" role="group" aria-label={`Slide ${slideIndex + 1} of ${slides.length}`}>
                    {slides.map((item, index) => <span key={item.title} className={`h-3 rounded-full transition-all ${index === slideIndex ? "w-8 bg-primary" : "w-3 bg-muted-foreground/50"}`} />)}
                  </div>
                )}
                {isFirstIntroSlide ? (
                  <div className="mt-5 flex flex-col gap-3">
                    <button type="button" onClick={() => setSlideIndex((index) => Math.min(index + 1, slides.length - 1))} className={`${filledButton} w-full md:rounded-2xl`}>Next<ArrowRight className="size-4" /></button>
                    <button type="button" onClick={goLogin} className="min-h-11 w-full rounded-full text-center text-sm font-normal text-muted-foreground hover:bg-muted">Skip</button>
                  </div>
                ) : <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between md:flex-col md:items-stretch md:justify-start">
                  {slideIndex < slides.length - 1 ? (
                    <><button type="button" onClick={goLogin} className="min-h-11 rounded-full px-5 text-sm font-normal text-muted-foreground hover:bg-muted md:w-full md:text-center">Skip</button><button type="button" onClick={() => setSlideIndex((index) => Math.min(index + 1, slides.length - 1))} className={`${filledButton} md:w-full md:rounded-2xl`}>Next<ArrowRight className="size-4" /></button></>
                  ) : (
                    <><button type="button" onClick={() => go("signup")} className={`${outlinedButton} md:w-full`}>Sign up</button><button type="button" onClick={() => go("login")} className={`${filledButton} md:w-full`}>Log in<ArrowRight className="size-4" /></button></>
                  )}
                </div>}
              </div>
            )}

            {screen === "login" && (
              <div>
                <p className="mb-2 text-sm font-semibold text-icon-accent">Welcome back</p>
                <h1 className="text-3xl font-bold leading-tight tracking-tight md:text-4xl">Log in to Hawk</h1>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">Use your account to continue to your teacher workspace.</p>
                {notice && <p role="status" className="mt-4 rounded-xl bg-primary-soft px-4 py-3 text-sm text-icon-accent">{notice}</p>}
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <button type="button" onClick={() => onComplete()} className={outlinedButton}><span aria-hidden="true" className="text-base font-bold">●</span>Login with Apple</button>
                  <button type="button" onClick={() => onComplete()} className={outlinedButton}><span aria-hidden="true" className="font-bold text-base">G</span>Login with Google</button>
                </div>
                <div className="my-6 flex items-center gap-3 text-sm text-muted-foreground"><span className="h-px grow bg-border" />Or Continue with Email<span className="h-px grow bg-border" /></div>
                <form className="grid gap-4" onSubmit={submitLogin}>
                  <label className="grid gap-2 text-base font-semibold">Email<input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Enter your email" className={inputClass} /></label>
                  <label className="grid gap-2 text-base font-semibold">Password<span className="relative block"><input type={showPassword ? "text" : "password"} autoComplete="current-password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" className={`${inputClass} pr-12`} /><button type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword((visible) => !visible)} className="absolute right-1 top-1 flex size-10 items-center justify-center rounded-full text-muted-foreground hover:bg-muted">{showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button></span></label>
                  <div className="-mt-1 flex justify-start"><button type="button" onClick={() => go("forgot")} className="min-h-9 text-sm font-semibold text-icon-accent hover:underline">Forgot Password?</button></div>
                  {error && <p role="alert" className="text-sm text-accent-foreground">{error}</p>}
                  <button type="submit" className={`${filledButton} w-full`}>Login<ArrowRight className="size-4" /></button>
                </form>
              </div>
            )}

            {screen === "signup" && (
              <div>
                <p className="mb-2 text-base font-semibold text-icon-accent">Create your teacher account</p>
                <h1 className="text-3xl font-bold leading-tight tracking-tight md:text-4xl">Sign up for Hawk</h1>
                <form className="mt-6 grid gap-4" onSubmit={submitSignup}>
                  <label className="grid gap-2 text-base font-semibold">Your full name<input autoComplete="name" required value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Your full name" className={signupInputClass} /></label>
                  <label className="grid gap-2 text-base font-semibold">Email<input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Enter your email" className={signupInputClass} /></label>
                  <label className="grid gap-2 text-base font-semibold">Password<span className="relative block"><input type={showPassword ? "text" : "password"} autoComplete="new-password" required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Create a password" className={`${signupInputClass} pr-12`} /><button type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword((visible) => !visible)} className="absolute right-1 top-1 flex size-10 items-center justify-center rounded-full text-muted-foreground hover:bg-muted">{showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button></span></label>
                  <ul aria-label="Password requirements" aria-live="polite" className="-mt-2 grid gap-1">
                    {passwordRules.map((rule) => {
                      const met = rule.test(password);
                      const conditionColor = met ? "text-icon-accent" : password.length > 0 ? "text-[#A85757]" : "text-muted-foreground";
                      const bulletColor = met ? "bg-primary" : password.length > 0 ? "bg-[#A85757]" : "bg-muted-foreground";
                      return <li key={rule.label} aria-label={`${rule.label}: ${met ? "met" : "not met"}`} className={`flex items-center gap-2 text-sm ${conditionColor}`}><span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${bulletColor}`} />{rule.label}</li>;
                    })}
                  </ul>
                  <label className="grid gap-2 text-base font-semibold">Confirm your password<span className="relative block"><input type={showConfirmPassword ? "text" : "password"} autoComplete="new-password" required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Confirm your password" className={`${signupInputClass} pr-12`} /><button type="button" aria-label={showConfirmPassword ? "Hide password" : "Show password"} onClick={() => setShowConfirmPassword((visible) => !visible)} className="absolute right-1 top-1 flex size-10 items-center justify-center rounded-full text-muted-foreground hover:bg-muted">{showConfirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button></span></label>
                  {error && <p role="alert" className="text-sm text-accent-foreground">{error}</p>}
                  <button type="submit" className={`${filledButton} w-full`}>Sign up<ArrowRight className="size-4" /></button>
                  <button type="button" onClick={goLogin} className="min-h-10 w-full rounded-full text-sm font-semibold text-muted-foreground hover:bg-muted">Cancel</button>
                </form>
                <p className="mt-2 text-center text-sm leading-5 text-muted-foreground">By signing up, you agree to our <span className="font-semibold text-icon-accent">Terms of Service</span> and <span className="font-semibold text-icon-accent">Privacy Policy</span>.</p>
              </div>
            )}

            {screen === "email-verify" && (
              <div className="-translate-y-4">
                <span className="mx-auto mb-6 flex size-20 items-center justify-center rounded-full bg-primary-soft text-icon-accent"><Mail className="size-10" /></span>
                <p className="mb-2 text-sm font-semibold text-icon-accent">Verify your account</p>
                <h1 className="text-3xl font-bold leading-tight tracking-tight md:text-4xl">Verify your email</h1>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">Enter the 4-character code sent to <span className="font-semibold text-foreground">{email}</span>.</p>
                <form className="mt-7 grid gap-6" onSubmit={submitEmailVerification}>
                  <OtpFields value={emailVerificationCode} onChange={setEmailVerificationCode} label="Email verification code" />
                  {error && <p role="alert" className="text-center text-sm text-accent-foreground">{error}</p>}
                  <div className="grid gap-3">
                    <button type="submit" disabled={emailVerificationCode.length !== 4} className={`${filledButton} w-full`}>Verify email<ArrowRight className="size-4" /></button>
                    <button type="button" onClick={goLogin} className={`${outlinedButton} w-full`}>Back to Login</button>
                  </div>
                  <button type="button" onClick={() => { setEmailVerificationCode(""); setNotice("A new email verification code is ready."); }} className="min-h-9 text-sm font-semibold text-icon-accent hover:underline">Didn't receive a code? Resend</button>
                  {notice && <p role="status" className="-mt-5 text-center text-sm text-icon-accent">{notice}</p>}
                </form>
              </div>
            )}

            {screen === "email-verified" && (
              <div className="-translate-y-4">
                <span className="mx-auto mb-6 flex size-20 items-center justify-center rounded-full bg-primary-soft text-icon-accent"><ShieldCheck className="size-10" /></span>
                <p className="mb-2 text-sm font-semibold text-icon-accent">Email confirmed</p>
                <h1 className="text-3xl font-bold leading-tight tracking-tight md:text-4xl">Your email is verified</h1>
                <p className="mt-3 text-sm leading-6 text-muted-foreground"><span className="font-semibold text-foreground">{email}</span> is ready to use with your Hawk account.</p>
                <button type="button" onClick={() => { setInviteCode(""); go("invite"); }} className={`${filledButton} mt-7 w-full`}>Next<ArrowRight className="size-4" /></button>
              </div>
            )}

            {screen === "invite" && (
              <div className="-translate-y-4">
                <span className="mx-auto mb-6 flex size-20 items-center justify-center rounded-full bg-primary-soft text-icon-accent"><ShieldCheck className="size-10" /></span>
                <p className="mb-2 text-sm font-semibold text-icon-accent">Connect your school</p>
                <h1 className="text-3xl font-bold leading-tight tracking-tight md:text-4xl">School invite code</h1>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">Enter the 4-character invite code provided by your school admin.</p>
                <form className="mt-7 grid gap-6" onSubmit={submitInvite}>
                  <OtpFields value={inviteCode} onChange={setInviteCode} label="School invite code" />
                  {error && <p role="alert" className="text-center text-sm text-accent-foreground">{error}</p>}
                  <div className="grid gap-3">
                    <button type="submit" disabled={inviteCode.length !== 4} className={`${filledButton} w-full`}>Verify Now<ArrowRight className="size-4" /></button>
                    <button type="button" onClick={goLogin} className={`${outlinedButton} w-full`}>Cancel</button>
                  </div>
                </form>
              </div>
            )}

            {screen === "forgot" && (
              <div>
                <span className="mb-5 flex size-12 items-center justify-center rounded-2xl bg-primary-soft text-icon-accent"><Mail className="size-6" /></span>
                <p className="mb-2 text-sm font-semibold text-icon-accent">Account recovery</p>
                <h1 className="text-3xl font-bold leading-tight tracking-tight md:text-4xl">Forgot password?</h1>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">Enter your email and we’ll help you reset your password.</p>
                <form className="mt-7 grid gap-4" onSubmit={submitForgot}>
                  <label className="grid gap-2 text-sm font-semibold">Email<input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Enter your email" className={inputClass} /></label>
                  {error && <p role="alert" className="text-sm text-accent-foreground">{error}</p>}
                  <button type="submit" className={`${filledButton} w-full`}>Continue<ArrowRight className="size-4" /></button>
                  <button type="button" onClick={goLogin} className={`${outlinedButton} w-full`}>Cancel</button>
                </form>
              </div>
            )}

            {screen === "forgot-verify" && (
              <div>
                <span className="mb-5 flex size-12 items-center justify-center rounded-2xl bg-primary-soft text-icon-accent"><Mail className="size-6" /></span>
                <p className="mb-2 text-sm font-semibold text-icon-accent">Check your inbox</p>
                <h1 className="text-3xl font-bold leading-tight tracking-tight md:text-4xl">Enter verification code</h1>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">We've sent a verification code to <span className="font-semibold text-foreground">{email}</span>.</p>
                <form className="mt-7 grid gap-5" onSubmit={submitVerification}>
                  <OtpFields value={verificationCode} onChange={setVerificationCode} label="Verification code" />
                  {error && <p role="alert" className="text-center text-sm text-accent-foreground">{error}</p>}
                  <button type="submit" disabled={verificationCode.length !== 4} className={`${filledButton} w-full`}>Verify Now<ArrowRight className="size-4" /></button>
                  <div className="text-center"><button type="button" onClick={() => { setVerificationCode(""); setNotice("A new verification code is ready."); }} className="min-h-9 text-sm font-semibold text-icon-accent hover:underline">Didn't receive any code? Resend Code</button></div>
                  {notice && <p role="status" className="text-center text-sm text-icon-accent">{notice}</p>}
                  <button type="button" onClick={goLogin} className={`${outlinedButton} w-full`}>Cancel</button>
                </form>
              </div>
            )}

            {screen === "reset" && (
              <div>
                <span className="mb-5 flex size-12 items-center justify-center rounded-2xl bg-primary-soft text-icon-accent"><ShieldCheck className="size-6" /></span>
                <p className="mb-2 text-sm font-semibold text-icon-accent">Almost done</p>
                <h1 className="text-3xl font-bold leading-tight tracking-tight md:text-4xl">Reset your password</h1>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">Choose a new password for your Hawk account.</p>
                <form className="mt-7 grid gap-4" onSubmit={submitReset}>
                  <label className="grid gap-2 text-sm font-semibold">New password<input type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="New password" className={inputClass} /></label>
                  <label className="grid gap-2 text-sm font-semibold">Confirm password<input type="password" autoComplete="new-password" minLength={8} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Confirm new password" className={inputClass} /></label>
                  {error && <p role="alert" className="text-sm text-accent-foreground">{error}</p>}
                  <button type="submit" className={`${filledButton} w-full`}>Continue<ArrowRight className="size-4" /></button>
                  <button type="button" onClick={goLogin} className={`${outlinedButton} w-full`}>Cancel</button>
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
