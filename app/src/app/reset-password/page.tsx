"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AuthCard from "../auth-card";
import styles from "../auth.module.css";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

// Reached via the email link from /forgot-password — the recovery code is
// exchanged in /auth/callback before we land here, so the user is already
// authenticated and we can call updateUser({ password }) directly.
export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setBusy(true);
    const supabase = createSupabaseBrowserClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setBusy(false);
      setError(
        updateError.message === "Auth session missing!"
          ? "This reset link has expired. Request a new one."
          : updateError.message || "Could not update password.",
      );
      return;
    }
    router.push("/welcome");
    router.refresh();
  };

  return (
    <AuthCard
      titleWords={["Reset", "Password"]}
      subtitle="Mazra'at albaan"
      watermark="MA"
      footer={
        <>
          Need a new link? <Link href="/forgot-password">Start over</Link>
        </>
      }
    >
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <div className={styles.field}>
          <span className={styles.label}>New password</span>
          <div className={styles.inputWrap}>
            <svg className={styles.icon} data-auth-icon="" viewBox="0 0 24 24" aria-hidden="true">
              <rect x="5" y="11" width="14" height="10" rx="2" />
              <path d="M8 11V7a4 4 0 0 1 8 0v4" />
            </svg>
            <input
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              className={`${styles.input} ${styles.inputWithToggle}`}
              minLength={8}
              required
            />
            <button
              type="button"
              className={styles.passwordToggle}
              onClick={() => setShowPassword((s) => !s)}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M3 3l18 18" />
                  <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
                  <path d="M9.9 5.1A10.9 10.9 0 0 1 12 5c5 0 9 4 10 7a12.3 12.3 0 0 1-3.2 4.3M6.3 6.3C3.9 7.9 2.4 10.2 2 12c1 3 5 7 10 7a10.9 10.9 0 0 0 4-.8" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>
        </div>

        <div className={styles.field}>
          <span className={styles.label}>Confirm password</span>
          <div className={styles.inputWrap}>
            <svg className={styles.icon} data-auth-icon="" viewBox="0 0 24 24" aria-hidden="true">
              <rect x="5" y="11" width="14" height="10" rx="2" />
              <path d="M8 11V7a4 4 0 0 1 8 0v4" />
            </svg>
            <input
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Repeat new password"
              className={styles.input}
              minLength={8}
              required
            />
          </div>
        </div>

        {error ? <div className={styles.error}>{error}</div> : null}

        <button type="submit" className={styles.submit} disabled={busy}>
          {busy ? "Updating…" : "Update password"}
        </button>
      </form>
    </AuthCard>
  );
}
