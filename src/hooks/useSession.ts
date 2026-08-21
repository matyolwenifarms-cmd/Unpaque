import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { isConfigured, supabase } from "@/lib/supabase.ts";

export interface SessionState {
  session: Session | null;
  /** True until the first answer arrives. Distinguishing this from "signed
   *  out" is the whole reason it exists: rendering a sign-in form for the
   *  half-second before the stored session is read flashes every returning
   *  user with a login screen they do not need. */
  loading: boolean;
  configured: boolean;
}

export function useSession(): SessionState {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(isConfigured);

  useEffect(() => {
    if (!isConfigured) return;
    let active = true;

    supabase()
      .auth.getSession()
      .then(({ data }) => {
        if (!active) return;
        setSession(data.session);
        setLoading(false);
      })
      .catch(() => {
        // A failure to read the stored session is signed-out, not stuck. An
        // app that spins forever because a token could not be parsed is worse
        // than one that asks somebody to sign in again.
        if (!active) return;
        setSession(null);
        setLoading(false);
      });

    const { data: subscription } = supabase().auth.onAuthStateChange((_event, next) => {
      if (!active) return;
      setSession(next);
      setLoading(false);
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  return { session, loading, configured: isConfigured };
}
