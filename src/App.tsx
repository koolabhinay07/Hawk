import { useState } from "react";
import OnboardingFlow from "./OnboardingFlow";
import Screen1 from "./Screen1";

export default function App() {
  const [hasEnteredApp, setHasEnteredApp] = useState(() => {
    try {
      return window.localStorage.getItem("hawk-onboarding-complete") === "true";
    } catch {
      return false;
    }
  });

  function completeOnboarding() {
    try {
      window.localStorage.setItem("hawk-onboarding-complete", "true");
    } catch {
      // Continue to the teacher workspace for this session if storage is unavailable.
    }
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

  return hasEnteredApp ? <Screen1 onLogout={logout} /> : <OnboardingFlow onComplete={completeOnboarding} />;
}
