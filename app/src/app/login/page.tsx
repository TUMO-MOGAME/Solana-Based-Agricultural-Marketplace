"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AuthCard from "../auth-card";
import SocialAuth from "../social-auth";
import styles from "../auth.module.css";
import {
  createSupabaseBrowserClient,
  isSupabaseConfigured,
} from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email || !password) {
      setError("Please enter your email and password.");
      return;
    }
    setBusy(true);

    // Demo mode: when Supabase env vars are not set, accept anything and
    // jump straight to the dashboard. Real auth kicks in automatically the
    // moment NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY are populated.
    if (!isSupabaseConfigured()) {
      router.push("/dashboard");
      return;
    }

    const supabase = createSupabaseBrowserClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (signInError) {
      setBusy(false);
      setError(
        signInError.message === "Email not confirmed"
          ? "Please confirm your email — check your inbox for the verification link."
          : signInError.message || "Could not sign in. Please try again.",
      );
      return;
    }
    router.push("/dashboard");
    router.refresh();
  };

  return (
    <AuthCard
      titleWords={["Welcome", "Back"]}
      subtitle="Mazra'at albaan"
      watermark="MA"
      footer={
        <>
          New here? <Link href="/signup">Create an account</Link>
        </>
      }
    >
      <SocialAuth mode="login" />

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
              placeholder="you@example.com"
              className={styles.input}
              required
            />
          </div>
        </div>

        <div className={styles.field}>
          <span className={styles.label}>Password</span>
          <div className={styles.inputWrap}>
            <svg className={styles.icon} data-auth-icon="" viewBox="0 0 24 24" aria-hidden="true">
              <rect x="5" y="11" width="14" height="10" rx="2" />
              <path d="M8 11V7a4 4 0 0 1 8 0v4" />
            </svg>
            <input
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className={`${styles.input} ${styles.inputWithToggle}`}
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

        <div className={styles.options}>
          <label className={styles.remember}>
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className={styles.checkbox}
            />
            Remember me
          </label>
          <Link href="/forgot-password" className={styles.forgot}>
            Forgot password?
          </Link>
        </div>

        {error ? <div className={styles.error}>{error}</div> : null}

        <button type="submit" className={styles.submit} disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </AuthCard>
  );
}
