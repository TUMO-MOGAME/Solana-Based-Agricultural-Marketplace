"use client";

import { useState } from "react";
import styles from "./auth.module.css";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Provider = "google" | "apple" | "azure";

interface SocialAuthProps {
  /** "Continue with" on signup, "Sign in with" on login. */
  mode: "login" | "signup";
}

const PROVIDER_LABEL: Record<Provider, string> = {
  google: "Google",
  apple: "Apple",
  azure: "Microsoft",
};

export default function SocialAuth({ mode }: SocialAuthProps) {
  const [busy, setBusy] = useState<Provider | null>(null);
  const [error, setError] = useState("");

  const handleProvider = async (provider: Provider) => {
    if (busy) return;
    setError("");
    setBusy(provider);
    const supabase = createSupabaseBrowserClient();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (oauthError) {
      setBusy(null);
      setError(oauthError.message || `Could not start ${PROVIDER_LABEL[provider]} sign-in.`);
    }
    // On success the browser is redirected by Supabase — no further action here.
  };

  const verb = mode === "signup" ? "Sign up" : "Sign in";

  return (
    <div className={styles.socialGroup}>
      <div className={styles.socialRow}>
        <button
          type="button"
          className={styles.socialBtn}
          onClick={() => handleProvider("google")}
          disabled={busy !== null}
          aria-label={`${verb} with Google`}
        >
          <GoogleIcon />
          <span>{busy === "google" ? "…" : PROVIDER_LABEL.google}</span>
        </button>
        <button
          type="button"
          className={styles.socialBtn}
          onClick={() => handleProvider("apple")}
          disabled={busy !== null}
          aria-label={`${verb} with Apple`}
        >
          <AppleIcon />
          <span>{busy === "apple" ? "…" : PROVIDER_LABEL.apple}</span>
        </button>
        <button
          type="button"
          className={styles.socialBtn}
          onClick={() => handleProvider("azure")}
          disabled={busy !== null}
          aria-label={`${verb} with Microsoft`}
        >
          <MicrosoftIcon />
          <span>{busy === "azure" ? "…" : PROVIDER_LABEL.azure}</span>
        </button>
      </div>

      {error ? <div className={styles.error}>{error}</div> : null}

      <div className={styles.orDivider}>
        <span>or use email</span>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg
      className={styles.socialIcon}
      viewBox="0 0 48 48"
      aria-hidden="true"
      width="18"
      height="18"
    >
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C33.9 6.2 29.2 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C33.9 6.2 29.2 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.8-2 13.3-5.2l-6.1-5.2c-2 1.5-4.5 2.4-7.2 2.4-5.2 0-9.7-3.3-11.3-8l-6.5 5C9.6 39.7 16.3 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4.1 5.6l6.1 5.2C41.8 36 44 30.5 44 24c0-1.3-.1-2.4-.4-3.5z"
      />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg
      className={styles.socialIcon}
      viewBox="0 0 24 24"
      aria-hidden="true"
      width="18"
      height="18"
      fill="currentColor"
    >
      <path d="M16.365 1.43c0 1.14-.44 2.23-1.16 3.02-.77.86-2.05 1.53-3.09 1.45-.14-1.14.42-2.33 1.13-3.07.8-.83 2.18-1.47 3.12-1.4zm4.5 16.04c-.55 1.28-.81 1.86-1.52 2.99-.99 1.58-2.38 3.54-4.1 3.56-1.53.01-1.92-1-3.99-.99-2.07.01-2.5 1-4.03.99-1.72-.02-3.04-1.8-4.03-3.38-2.77-4.42-3.06-9.6-1.35-12.36 1.22-1.96 3.13-3.11 4.93-3.11 1.83 0 2.98 1 4.49 1 1.47 0 2.36-1 4.48-1 1.6 0 3.3.87 4.51 2.38-3.97 2.17-3.32 7.84.61 9.92z" />
    </svg>
  );
}

function MicrosoftIcon() {
  return (
    <svg
      className={styles.socialIcon}
      viewBox="0 0 24 24"
      aria-hidden="true"
      width="18"
      height="18"
    >
      <path fill="#F25022" d="M2 2h9.5v9.5H2z" />
      <path fill="#7FBA00" d="M12.5 2H22v9.5h-9.5z" />
      <path fill="#00A4EF" d="M2 12.5h9.5V22H2z" />
      <path fill="#FFB900" d="M12.5 12.5H22V22h-9.5z" />
    </svg>
  );
}
