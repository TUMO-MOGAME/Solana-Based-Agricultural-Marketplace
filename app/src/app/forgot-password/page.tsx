"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import AuthCard from "../auth-card";
import styles from "../auth.module.css";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [linkSent, setLinkSent] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email) {
      setError("Please enter the email on your account.");
      return;
    }
    setBusy(true);
    const supabase = createSupabaseBrowserClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });
    if (resetError) {
      setBusy(false);
      setError(resetError.message || "Could not send reset link. Please try again.");
      return;
    }
    setBusy(false);
    setLinkSent(true);
  };

  if (linkSent) {
    return (
      <AuthCard
        titleWords={["Check", "Email"]}
        subtitle="Mazra'at albaan"
        watermark="MA"
        footer={
          <>
            Remembered it? <Link href="/login">Back to sign in</Link>
          </>
        }
      >
        <div className={styles.confirmationNotice}>
          <p>
            If an account exists for <strong>{email}</strong>, a password reset link
            is on its way.
          </p>
          <p>Click the link in the email to choose a new password.</p>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      titleWords={["Forgot", "Password"]}
      subtitle="Mazra'at albaan"
      watermark="MA"
      footer={
        <>
          Remembered it? <Link href="/login">Back to sign in</Link>
        </>
      }
    >
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <div className={styles.field}>
          <span className={styles.label}>Email</span>
          <div className={styles.inputWrap}>
            <svg className={styles.icon} data-auth-icon="" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 6h16v12H4z" />
              <path d="M4 6l8 7 8-7" />
            </svg>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@socialassembly.co"
              className={styles.input}
              required
            />
          </div>
        </div>

        {error ? <div className={styles.error}>{error}</div> : null}

        <button type="submit" className={styles.submit} disabled={busy}>
          {busy ? "Sending link…" : "Send reset link"}
        </button>
      </form>
    </AuthCard>
  );
}
