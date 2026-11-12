import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import OnboardingFlow from "./OnboardingFlow";
import Screen1 from "./Screen1";
import { supabase } from "./supabase";

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(!supabase);
  const [recovering, setRecovering] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, next) => {
      if (event === "PASSWORD_RECOVERY") setRecovering(true);
      setSession(next);
      setReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  if (!ready) return null;
  if (!session || recovering) return <OnboardingFlow recovery={recovering} onRecoveryComplete={() => setRecovering(false)} />;
  const name = typeof session.user.user_metadata.full_name === "string" ? session.user.user_metadata.full_name : session.user.email?.split("@")[0] || "Teacher";
  return <Screen1 teacherName={name} onLogout={() => { void supabase?.auth.signOut(); }} />;
}
