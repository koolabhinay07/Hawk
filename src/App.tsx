import { useState } from "react";
import OnboardingFlow from "./OnboardingFlow";
import Screen1 from "./Screen1";

type TeacherProfile = { fullName: string; email: string };

export default function App() {
  const [hasEnteredApp, setHasEnteredApp] = useState(() => {
    try {
      return window.localStorage.getItem("hawk-onboarding-complete") === "true";
    } catch {
      return false;
    }
  });
  const [teacherProfile, setTeacherProfile] = useState<TeacherProfile>(() => {
    try {
      const stored = JSON.parse(window.localStorage.getItem("hawk-teacher-profile") ?? "null") as Partial<TeacherProfile> | null;
      if (stored && typeof stored.fullName === "string" && stored.fullName.trim()) {
        return { fullName: stored.fullName, email: typeof stored.email === "string" ? stored.email : "" };
      }
    } catch {
      // Use the demo teacher profile when no saved profile is available.
    }
    return { fullName: "Priya Sharma", email: "" };
  });

  function completeOnboarding(profile?: TeacherProfile) {
    try {
      window.localStorage.setItem("hawk-onboarding-complete", "true");
      if (profile) window.localStorage.setItem("hawk-teacher-profile", JSON.stringify(profile));
    } catch {
      // Continue to the teacher workspace for this session if storage is unavailable.
    }
    if (profile) setTeacherProfile(profile);
    setHasEnteredApp(true);
  }

  function logout() {
    try {
      window.localStorage.removeItem("hawk-onboarding-complete");
    } catch {
      // Return to onboarding for this session if storage is unavailable.
    }
    setHasEnteredApp(false);
  }

  return hasEnteredApp ? <Screen1 onLogout={logout} teacherName={teacherProfile.fullName} /> : <OnboardingFlow onComplete={completeOnboarding} />;
}
