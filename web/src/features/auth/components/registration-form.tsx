"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { INITIAL_AUTH_STATE } from "@/lib/auth/types";
import { registerAccountAction } from "../server/setup-actions";
import { AlertIcon, ArrowRightIcon, CheckIcon, MailIcon, PhoneIcon, UserIcon } from "./icons";
import { PasswordField } from "./password-field";
import styles from "./auth.module.css";

function RegistrationButton() {
  const { pending } = useFormStatus();
  return (
    <button className={styles.primaryAction} type="submit" disabled={pending} aria-busy={pending}>
      {pending ? <span className={styles.spinner} aria-hidden="true" /> : null}
      <span>{pending ? "Creating your account…" : "Create account"}</span>
      {!pending ? <ArrowRightIcon /> : null}
    </button>
  );
}

export function RegistrationForm() {
  const [state, formAction] = useActionState(registerAccountAction, INITIAL_AUTH_STATE);
  const noticeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state.status !== "idle") noticeRef.current?.focus();
  }, [state]);

  if (state.status === "success") {
    return (
      <div className={styles.authCard}>
        <header className={`${styles.authHeader} ${styles.resetHeader}`}>
          <div className={styles.resetMark}><MailIcon /></div>
          <p className={styles.eyebrow}>Check your inbox</p>
          <h1>Verify your email</h1>
          <p>Use the secure link in your email to activate your account.</p>
        </header>
        <div ref={noticeRef} tabIndex={-1} className={`${styles.notice} ${styles.noticeSuccess}`} role="status" aria-live="polite">
          <CheckIcon /><span>{state.message}</span>
        </div>
        <Link className={styles.primaryLink} href="/login">Return to sign in</Link>
      </div>
    );
  }

  return (
    <div className={styles.authCard}>
      <header className={styles.authHeader}>
        <p className={styles.eyebrow}>Start your workspace</p>
        <h1>Create your account</h1>
        <p>Verify your email first, then name your shop and open your workspace.</p>
      </header>
      <form action={formAction} noValidate>
        <div className={styles.field}>
          <label htmlFor="register-full-name">Full name</label>
          <div className={styles.fieldControl}>
            <UserIcon className={styles.leadingIcon} />
            <input id="register-full-name" name="fullName" type="text" autoComplete="name" placeholder="Ama Mensah" defaultValue={state.fields?.fullName} required />
          </div>
        </div>
        <div className={styles.field}>
          <label htmlFor="register-email">Email address</label>
          <div className={styles.fieldControl}>
            <MailIcon className={styles.leadingIcon} />
            <input id="register-email" name="email" type="email" autoComplete="email" inputMode="email" placeholder="you@example.com" defaultValue={state.fields?.email} required />
          </div>
        </div>
        <div className={styles.field}>
          <label htmlFor="register-phone">Phone number</label>
          <div className={styles.fieldControl}>
            <PhoneIcon className={styles.leadingIcon} />
            <input id="register-phone" name="phone" type="tel" autoComplete="tel" inputMode="tel" placeholder="+233 24 000 0000" defaultValue={state.fields?.phone} required />
          </div>
        </div>
        <div className={styles.field}>
          <label htmlFor="register-password">Password</label>
          <PasswordField id="register-password" autoComplete="new-password" placeholder="At least 6 characters" />
        </div>
        {state.status === "error" ? (
          <div ref={noticeRef} tabIndex={-1} className={`${styles.notice} ${styles.noticeError}`} role="alert">
            <AlertIcon /><span>{state.message}</span>
          </div>
        ) : null}
        <RegistrationButton />
      </form>
      <div className={styles.cardFooter}>
        <span>Already registered?</span>
        <Link className={styles.createShop} href="/login">Sign in</Link>
      </div>
    </div>
  );
}
