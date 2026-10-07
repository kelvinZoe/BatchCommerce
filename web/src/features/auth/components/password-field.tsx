"use client";

import { useState } from "react";
import { EyeIcon, EyeOffIcon, LockIcon } from "./icons";
import styles from "./auth.module.css";

export function PasswordField({
  id,
  name = "password",
  autoComplete,
  placeholder
}: Readonly<{
  id: string;
  name?: string;
  autoComplete: "current-password" | "new-password";
  placeholder: string;
}>) {
  const [visible, setVisible] = useState(false);

  return (
    <div className={styles.fieldControl}>
      <LockIcon className={styles.leadingIcon} />
      <input
        id={id}
        name={name}
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        placeholder={placeholder}
        required
      />
      <button
        className={styles.passwordToggle}
        type="button"
        onClick={() => setVisible((value) => !value)}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
      >
        {visible ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </div>
  );
}
