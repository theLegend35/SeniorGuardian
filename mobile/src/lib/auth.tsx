import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { stopBackgroundRefresh } from "@/lib/background-sync";
import { applyReadingScale } from "@/lib/reading";
import { loadActor } from "@/lib/records";
import { forgetThisPhone } from "@/lib/reminders";
import { supabase, supabaseReady } from "@/lib/supabase";
import type { Actor } from "@/lib/types";

type AuthValue = {
  actor: Actor | null;
  ready: boolean;
  configured: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [actor, setActor] = useState<Actor | null>(null);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      setActor(null);
      return;
    }
    setActor(await loadActor(data.session.user.id));
  }, []);

  useEffect(() => {
    if (actor) applyReadingScale(actor.textScale);
  }, [actor]);

  useEffect(() => {
    let live = true;
    void supabase.auth.getSession().then(async ({ data }) => {
      if (!live) return;
      if (data.session && supabaseReady) {
        setActor(await loadActor(data.session.user.id).catch(() => null));
      }
      setReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setActor(null);
        setReady(true);
        return;
      }
      if (!supabaseReady) return;
      void loadActor(session.user.id).then((next) => {
        if (live) setActor(next);
      });
    });
    return () => {
      live = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabaseReady) throw new Error("Add the Supabase public keys to mobile/.env, then restart the app.");
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    if (error && (error.code === "email_not_confirmed" || /email not confirmed/i.test(error.message))) {
      throw new Error("Confirm your email address first. Open the link we sent you, or sign in on the website to get a new one.");
    }
    if (error) throw new Error("That email or password is not correct.");
    const { data } = await supabase.auth.getSession();
    const next = data.session ? await loadActor(data.session.user.id) : null;
    if (!next) {
      await supabase.auth.signOut();
      throw new Error("That account is not available.");
    }
    setActor(next);
  }, []);

  const signOut = useCallback(async () => {
    await forgetThisPhone().catch(() => undefined);
    await stopBackgroundRefresh().catch(() => undefined);
    await supabase.auth.signOut();
    setActor(null);
  }, []);

  const value = useMemo(
    () => ({ actor, ready, configured: supabaseReady, signIn, signOut, refresh }),
    [actor, ready, signIn, signOut, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider.");
  return value;
}

export function textScaleOf(actor: Actor | null): number {
  if (actor?.textScale === "largest") return 1.28;
  if (actor?.textScale === "large") return 1.14;
  return 1;
}
