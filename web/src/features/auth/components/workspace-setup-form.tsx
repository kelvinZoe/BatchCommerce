"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { INITIAL_AUTH_STATE } from "@/lib/auth/types";
import { createWorkspaceAction } from "../server/setup-actions";
import { AlertIcon, ArrowRightIcon, CheckIcon, PhoneIcon, StoreIcon, UserIcon } from "./icons";
import styles from "./auth.module.css";

function WorkspaceButton() {
  const { pending } = useFormStatus();
  return (
    <button className={styles.primaryAction} type="submit" disabled={pending} aria-busy={pending}>
      {pending ? <span className={styles.spinner} aria-hidden="true" /> : null}
      <span>{pending ? "Creating your workspace…" : "Create shop workspace"}</span>
      {!pending ? <ArrowRightIcon /> : null}
    </button>
  );
}

export function WorkspaceSetupForm({
  email,
  initialFullName,
  initialPhone
}: Readonly<{
  email: string;
  initialFullName: string;
  initialPhone: string;
}>) {
  const [state, formAction] = useActionState(createWorkspaceAction, INITIAL_AUTH_STATE);
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state.status === "error") errorRef.current?.focus();
  }, [state]);

  return (
    <div className={styles.authCard}>
      <header className={styles.authHeader}>
        <p className={styles.eyebrow}>Email verified</p>
        <h1>Name your shop</h1>
        <p>Create the workspace your customers and team will see in BatchCommerce.</p>
      </header>
      <div className={styles.identityPanel} role="status">
        <CheckIcon />
        <span>Signed in as <strong>{email}</strong></span>
      </div>
      <form action={formAction} noValidate>
        <div className={styles.field}>
          <label htmlFor="setup-shop-name">Shop name</label>
          <div className={styles.fieldControl}>
            <StoreIcon className={styles.leadingIcon} />
            <input id="setup-shop-name" name="shopName" type="text" autoComplete="organization" placeholder="Ama's Boutique" defaultValue={state.fields?.shopName} required />
          </div>
        </div>
        <div className={styles.field}>
          <label htmlFor="setup-full-name">Your full name</label>
          <div className={styles.fieldControl}>
            <UserIcon className={styles.leadingIcon} />
            <input id="setup-full-name" name="fullName" type="text" autoComplete="name" placeholder="Ama Mensah" defaultValue={state.fields?.fullName || initialFullName} required />
          </div>
        </div>
        <div className={styles.field}>
          <label htmlFor="setup-phone">Phone number</label>
          <div className={styles.fieldControl}>
            <PhoneIcon className={styles.leadingIcon} />
            <input id="setup-phone" name="phone" type="tel" autoComplete="tel" inputMode="tel" placeholder="+233 24 000 0000" defaultValue={state.fields?.phone || initialPhone} required />
          </div>
        </div>
        {state.status === "error" ? (
          <div ref={errorRef} tabIndex={-1} className={`${styles.notice} ${styles.noticeError}`} role="alert">
            <AlertIcon /><span>{state.message}</span>
          </div>
        ) : null}
        <WorkspaceButton />
      </form>
    </div>
  );
}
