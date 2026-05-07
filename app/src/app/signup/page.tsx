"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import AuthCard from "../auth-card";
import SocialAuth from "../social-auth";
import styles from "../auth.module.css";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!name || !email || !password) {
      setError("Please fill in every field to continue.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (!acceptTerms) {
      setError("Please accept the Terms & Privacy Policy to continue.");
      return;
    }
    setBusy(true);
    const supabase = createSupabaseBrowserClient();
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (signUpError) {
      setBusy(false);
      setError(signUpError.message || "Could not create account. Please try again.");
      return;
    }
    setBusy(false);
    setConfirmationSent(true);
  };

  if (confirmationSent) {
    return (
      <AuthCard
        titleWords={["Check", "Email"]}
        subtitle="Social Assembly"
        watermark="SA"
        footer={
          <>
            Wrong address? <Link href="/signup">Try again</Link>
          </>
        }
      >
        <div className={styles.confirmationNotice}>
          <p>
            We sent a verification link to <strong>{email}</strong>.
          </p>
          <p>Click the link in that email to activate your account, then sign in.</p>
        </div>
        <Link href="/login" className={styles.submit} style={{ textAlign: "center" }}>
          Go to sign in
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      titleWords={["Create", "Account"]}
      subtitle="Social Assembly"
      watermark="SA"
      footer={
        <>
          Already a member? <Link href="/login">Sign in</Link>
        </>
      }
    >
      <SocialAuth mode="signup" />

      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <div className={styles.field}>
          <span className={styles.label}>Full name</span>
          <div className={styles.inputWrap}>
            <svg className={styles.icon} data-auth-icon="" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 21c0-4.5 3.5-8 8-8s8 3.5 8 8" />
            </svg>
            <input
              type="text"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Emma Matlhaga"
              className={styles.input}
              required
            />
          </div>
        </div>

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

        <div className={styles.field}>
          <span className={styles.label}>Password</span>
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

        <label className={styles.terms}>
          <input
            type="checkbox"
            checked={acceptTerms}
            onChange={(e) => setAcceptTerms(e.target.checked)}
            className={styles.checkbox}
          />
          <span>
            I agree to the <Link href="/terms">Terms</Link> and{" "}
            <Link href="/privacy">Privacy Policy</Link>.
          </span>
        </label>

        {error ? <div className={styles.error}>{error}</div> : null}

        <button type="submit" className={styles.submit} disabled={busy}>
          {busy ? "Creating account…" : "Create account"}
        </button>
      </form>
    </AuthCard>
  );
}
