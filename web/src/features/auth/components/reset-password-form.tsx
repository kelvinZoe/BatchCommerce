"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { INITIAL_AUTH_STATE } from "@/lib/auth/types";
import { updatePasswordAction } from "../server/actions";
import { AlertIcon, ArrowRightIcon, CheckIcon, EyeIcon, EyeOffIcon, KeyIcon, LockIcon } from "./icons";
import styles from "./auth.module.css";

function UpdateButton() {
  const { pending } = useFormStatus();
  return <button className={styles.primaryAction} type="submit" disabled={pending} aria-busy={pending}>
    {pending ? <span className={styles.spinner} aria-hidden="true" /> : null}
    <span>{pending ? "Updating password…" : "Update password"}</span>
    {!pending ? <ArrowRightIcon /> : null}
  </button>;
}

export function ResetPasswordForm() {
  const [state, formAction] = useActionState(updatePasswordAction, INITIAL_AUTH_STATE);
  const [visible, setVisible] = useState(false);
  const [bridge, setBridge] = useState<{ pending: boolean; error: string }>({ pending: true, error: "" });
  const errorRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (state.status === "error") errorRef.current?.focus(); }, [state]);

  useEffect(() => {
    let active = true;
    async function restoreLegacyRecoverySession() {
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const hashError = hash.get("error_description");
      if (hashError) throw new Error(hashError);

      if (hash.get("access_token") && hash.get("refresh_token")) {
        const result = await createBrowserSupabaseClient().auth.setSession({
          access_token: hash.get("access_token")!,
          refresh_token: hash.get("refresh_token")!
        });
        if (result.error) throw result.error;
        window.history.replaceState(null, "", window.location.pathname);
      }
      const session = await createBrowserSupabaseClient().auth.getSession();
      if (!session.data.session) {
        throw new Error("This password reset link is invalid or has expired. Request a new link.");
      }
      if (active) setBridge({ pending: false, error: "" });
    }

    restoreLegacyRecoverySession().catch((error: unknown) => {
      if (active) {
        setBridge({ pending: false, error: error instanceof Error ? error.message : "This reset link is invalid." });
      }
    });
    return () => { active = false; };
  }, []);

  return <div className={styles.authCard}>
    <header className={`${styles.authHeader} ${styles.resetHeader}`}>
      <div className={styles.resetMark}><KeyIcon /></div>
      <p className={styles.eyebrow}>Secure account recovery</p>
      <h1>Set a new password</h1>
      <p>Choose a password with at least six characters.</p>
    </header>
    {bridge.pending ? <div className={styles.callbackProgress} role="status"><span className={styles.darkSpinner} aria-hidden="true" /><span>Preparing your secure reset…</span></div> : bridge.error ? <div className={`${styles.notice} ${styles.noticeError}`} role="alert"><AlertIcon /><span>{bridge.error}</span></div> : state.status === "success" ? <div className={`${styles.notice} ${styles.noticeSuccess} ${styles.successPanel}`} role="status">
      <CheckIcon /><span>{state.message}</span><Link className={styles.inlineAction} href="/login?password=updated">Sign in</Link>
    </div> : <form action={formAction} noValidate>
      <div className={styles.field}>
        <label htmlFor="new-password">New password</label>
        <div className={styles.fieldControl}>
          <LockIcon className={styles.leadingIcon} />
          <input id="new-password" name="password" type={visible ? "text" : "password"} autoComplete="new-password" placeholder="At least 6 characters" required />
          <button className={styles.passwordToggle} type="button" onClick={() => setVisible((value) => !value)} aria-label={visible ? "Hide password" : "Show password"} aria-pressed={visible}>{visible ? <EyeOffIcon /> : <EyeIcon />}</button>
        </div>
      </div>
      <div className={styles.field}>
        <label htmlFor="confirm-password">Confirm password</label>
        <div className={styles.fieldControl}>
          <LockIcon className={styles.leadingIcon} />
          <input id="confirm-password" name="confirmPassword" type={visible ? "text" : "password"} autoComplete="new-password" placeholder="Repeat your password" required />
        </div>
      </div>
      {state.status === "error" ? <div ref={errorRef} tabIndex={-1} className={`${styles.notice} ${styles.noticeError}`} role="alert"><AlertIcon /><span>{state.message}</span></div> : null}
      <UpdateButton />
    </form>}
  </div>;
}
