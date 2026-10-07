"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { AlertIcon, CheckIcon } from "./icons";
import styles from "./auth.module.css";

type CallbackState = {
  kind: "loading" | "error" | "success";
  title: string;
  message: string;
};

const emailOtpTypes = new Set<EmailOtpType>([
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email"
]);

export function AuthCallbackClient() {
  const router = useRouter();
  const [state, setState] = useState<CallbackState>({
    kind: "loading",
    title: "Signing you in…",
    message: "Please wait while we complete your authentication."
  });

  useEffect(() => {
    let active = true;
    async function completeCallback() {
      const supabase = createBrowserSupabaseClient();
      const url = new URL(window.location.href);
      const query = url.searchParams;
      const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
      const errorCode = query.get("error_code") || hash.get("error_code") || query.get("error") || hash.get("error");
      const errorDescription = query.get("error_description") || hash.get("error_description");

      if (errorCode) {
        const expired = errorCode === "otp_expired" || errorDescription?.toLowerCase().includes("expired");
        throw new Error(expired ? "Your authentication link has expired. Request a new link and try again." : errorDescription || "The authentication link is invalid.");
      }

      const type = query.get("type") || hash.get("type");
      const next = query.get("next") || "/dashboard";
      let callbackError: Error | null = null;

      if (query.get("code")) {
        const result = await supabase.auth.exchangeCodeForSession(query.get("code")!);
        callbackError = result.error;
      } else if (query.get("token_hash") && type && emailOtpTypes.has(type as EmailOtpType)) {
        const result = await supabase.auth.verifyOtp({ token_hash: query.get("token_hash")!, type: type as EmailOtpType });
        callbackError = result.error;
      } else if (hash.get("access_token") && hash.get("refresh_token")) {
        const result = await supabase.auth.setSession({ access_token: hash.get("access_token")!, refresh_token: hash.get("refresh_token")! });
        callbackError = result.error;
      } else {
        const result = await supabase.auth.getSession();
        if (!result.data.session) callbackError = new Error("No authentication session was found.");
      }

      if (callbackError) throw callbackError;
      if (!active) return;

      setState({ kind: "success", title: "Authentication complete", message: "Taking you to BatchCommerce…" });
      const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
      const destination = type === "recovery" ? "/reset-password" : safeNext;
      window.history.replaceState(null, "", url.pathname);
      router.replace(destination);
      router.refresh();
    }

    completeCallback().catch((error: unknown) => {
      if (!active) return;
      setState({ kind: "error", title: "Authentication failed", message: error instanceof Error ? error.message : "Could not complete authentication." });
    });
    return () => { active = false; };
  }, [router]);

  return <div className={styles.authCard}>
    <header className={`${styles.authHeader} ${styles.resetHeader}`}>
      <p className={styles.eyebrow}>Secure workspace access</p>
      <h1>{state.title}</h1>
      <p>{state.message}</p>
    </header>
    {state.kind === "loading" ? <div className={styles.callbackProgress} role="status" aria-live="polite"><span className={styles.darkSpinner} aria-hidden="true" /><span>Verifying your secure link…</span></div> : null}
    {state.kind === "success" ? <div className={`${styles.notice} ${styles.noticeSuccess}`} role="status"><CheckIcon /><span>{state.message}</span></div> : null}
    {state.kind === "error" ? <div className={styles.callbackActions}>
      <div className={`${styles.notice} ${styles.noticeError}`} role="alert"><AlertIcon /><span>{state.message}</span></div>
      <Link className={styles.primaryLink} href="/login">Return to sign in</Link>
      <Link className={styles.secondaryLink} href="/setup">Create your shop</Link>
    </div> : null}
  </div>;
}
