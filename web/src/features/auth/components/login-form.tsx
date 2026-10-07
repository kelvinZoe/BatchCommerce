"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { INITIAL_AUTH_STATE } from "@/lib/auth/types";
import { signInAction } from "../server/actions";
import { AlertIcon, ArrowLeftIcon, ArrowRightIcon, CheckIcon, MailIcon, SendIcon, UserIcon } from "./icons";
import { PasswordField } from "./password-field";
import styles from "./auth.module.css";

function SignInButton() {
  const { pending } = useFormStatus();
  return (
    <button className={styles.primaryAction} type="submit" disabled={pending} aria-busy={pending}>
      {pending ? <span className={styles.spinner} aria-hidden="true" /> : null}
      <span>{pending ? "Signing you in…" : "Sign in to BatchCommerce"}</span>
      {!pending ? <ArrowRightIcon /> : null}
    </button>
  );
}

function ForgotPassword({ onBack }: Readonly<{ onBack: () => void }>) {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<{ kind: "error" | "success"; text: string } | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    if (!email.trim()) {
      setNotice({ kind: "error", text: "Please enter your email address." });
      return;
    }

    setPending(true);
    try {
      const response = await fetch("/api/auth/password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string; message?: string };
      setNotice(response.ok
        ? { kind: "success", text: payload.message || "If an account exists, a reset link has been sent." }
        : { kind: "error", text: payload.error || "Could not send the reset link." });
    } catch {
      setNotice({ kind: "error", text: "Could not reach the BatchCommerce email service." });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className={styles.authCard}>
      <button type="button" className={styles.backButton} onClick={onBack}><ArrowLeftIcon /> Back to sign in</button>
      <header className={`${styles.authHeader} ${styles.resetHeader}`}>
        <div className={styles.resetMark}><MailIcon /></div>
        <p className={styles.eyebrow}>Account recovery</p>
        <h1>Reset your password</h1>
        <p>We’ll send a secure reset link to your email address.</p>
      </header>
      <form onSubmit={submit} noValidate>
        <div className={styles.field}>
          <label htmlFor="reset-email">Email address</label>
          <div className={styles.fieldControl}>
            <MailIcon className={styles.leadingIcon} />
            <input id="reset-email" type="email" value={email} onChange={(event) => { setEmail(event.target.value); setNotice(null); }} autoComplete="email" placeholder="you@example.com" />
          </div>
        </div>
        {notice ? <div className={`${styles.notice} ${notice.kind === "success" ? styles.noticeSuccess : styles.noticeError}`} role={notice.kind === "error" ? "alert" : "status"} aria-live="polite">
          {notice.kind === "success" ? <CheckIcon /> : <AlertIcon />}<span>{notice.text}</span>
        </div> : null}
        <button className={styles.primaryAction} type="submit" disabled={pending} aria-busy={pending}>
          {pending ? <span className={styles.spinner} aria-hidden="true" /> : null}
          <span>{pending ? "Sending reset link…" : "Send reset link"}</span>
          {!pending ? <SendIcon /> : null}
        </button>
      </form>
    </div>
  );
}

export function LoginForm({ initialNotice }: Readonly<{ initialNotice?: string }>) {
  const [forgot, setForgot] = useState(false);
  const [state, formAction] = useActionState(signInAction, INITIAL_AUTH_STATE);
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state.status === "error") errorRef.current?.focus();
  }, [state]);

  if (forgot) return <ForgotPassword onBack={() => setForgot(false)} />;

  return (
    <div className={styles.authCard}>
      <header className={styles.authHeader}>
        <p className={styles.eyebrow}>Secure workspace access</p>
        <h1>Welcome back</h1>
        <p>Sign in to continue managing your shop.</p>
      </header>
      {initialNotice ? <div className={`${styles.notice} ${styles.noticeSuccess}`} role="status"><CheckIcon /><span>{initialNotice}</span></div> : null}
      <form action={formAction} noValidate>
        <div className={styles.field}>
          <label htmlFor="login-identifier">Email or username</label>
          <div className={styles.fieldControl}>
            <UserIcon className={styles.leadingIcon} />
            <input id="login-identifier" name="identifier" type="text" autoComplete="username" inputMode="email" placeholder="you@example.com" defaultValue={state.fields?.identifier} required />
          </div>
        </div>
        <div className={styles.field}>
          <div className={styles.fieldHeading}>
            <label htmlFor="login-password">Password</label>
            <button type="button" className={styles.textButton} onClick={() => setForgot(true)}>Forgot password?</button>
          </div>
          <PasswordField
            id="login-password"
            autoComplete="current-password"
            placeholder="Enter your password"
          />
        </div>
        {state.status === "error" ? <div ref={errorRef} tabIndex={-1} className={`${styles.notice} ${styles.noticeError}`} role="alert"><AlertIcon /><span>{state.message}</span></div> : null}
        <SignInButton />
      </form>
      <div className={styles.cardFooter}>
        <span>New to BatchCommerce?</span>
        <Link className={styles.createShop} href="/setup">Create your shop <span aria-hidden="true">↗</span></Link>
      </div>
    </div>
  );
}
