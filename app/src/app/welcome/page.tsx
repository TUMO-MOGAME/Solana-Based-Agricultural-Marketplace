"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./welcome.module.css";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/* Splash route shown immediately after sign-in / sign-up. Reads the user
   from the Supabase session, renders the blob with their avatar inside,
   then auto-navigates to /dashboard. */

const SPLASH_MS = 4000;

const DEFAULT_AVATAR = "/content_creator.webp";
const FALLBACK = {
  name: "Emma Matlhaga",
  email: "emma.m.strategy@gmail.com",
  avatar: DEFAULT_AVATAR,
};

type WelcomeUser = { name: string; email: string; avatar: string };

export default function WelcomePage() {
  const router = useRouter();
  const [user, setUser] = useState<WelcomeUser>(FALLBACK);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createSupabaseBrowserClient();
      const { data } = await supabase.auth.getUser();
      if (cancelled || !data.user) return;

      const email = data.user.email?.trim() || FALLBACK.email;
      const meta = (data.user.user_metadata ?? {}) as Record<string, unknown>;
      const name =
        (typeof meta.full_name === "string" && meta.full_name.trim()) ||
        (typeof meta.name === "string" && meta.name.trim()) ||
        email.split("@")[0]?.replace(/[._-]+/g, " ") ||
        FALLBACK.name;
      const local = email.split("@")[0]?.toLowerCase() ?? "";
      const isEmma = local.startsWith("emma") || name.toLowerCase().startsWith("emma");
      const avatarFromMeta =
        typeof meta.avatar_url === "string" ? meta.avatar_url : null;
      const avatar =
        avatarFromMeta || (isEmma ? "/Emma.webp" : DEFAULT_AVATAR);

      setUser({ name, email, avatar });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Auto-advance to the dashboard. `replace` so back-button doesn't return here.
  useEffect(() => {
    const t = setTimeout(() => router.replace("/dashboard"), SPLASH_MS);
    return () => clearTimeout(t);
  }, [router]);

  return (
    <main className={styles.wrapper} aria-label={`Welcome, ${user.name}`}>
      <svg
        className={styles.svg}
        viewBox="0 0 200 200"
        xmlns="http://www.w3.org/2000/svg"
      >
        <clipPath id="blobClip">
          <path
            d="M43.1,-68.5C56.2,-58.6,67.5,-47.3,72.3,-33.9C77.2,-20.5,75.5,-4.9,74.2,11.3C72.9,27.6,71.9,44.5,63.8,57.2C55.7,69.8,40.6,78.2,25.5,79.2C10.4,80.1,-4.7,73.6,-20.9,69.6C-37.1,65.5,-54.5,63.9,-66,54.8C-77.5,45.8,-83.2,29.3,-85.7,12.3C-88.3,-4.8,-87.7,-22.3,-79.6,-34.8C-71.5,-47.3,-55.8,-54.9,-41.3,-64.2C-26.7,-73.6,-13.4,-84.7,0.8,-86C15,-87.2,29.9,-78.5,43.1,-68.5Z"
            transform="translate(100 100)"
          />
        </clipPath>

        {/* The user's avatar — clipped to the blob shape. */}
        <image
          href={user.avatar}
          width="200"
          height="200"
          preserveAspectRatio="xMidYMid slice"
          clipPath="url(#blobClip)"
        />

        {/* Invisible path the rotating text rides on. */}
        <path
          id="welcomeTextPath"
          d="M43.1,-68.5C56.2,-58.6,67.5,-47.3,72.3,-33.9C77.2,-20.5,75.5,-4.9,74.2,11.3C72.9,27.6,71.9,44.5,63.8,57.2C55.7,69.8,40.6,78.2,25.5,79.2C10.4,80.1,-4.7,73.6,-20.9,69.6C-37.1,65.5,-54.5,63.9,-66,54.8C-77.5,45.8,-83.2,29.3,-85.7,12.3C-88.3,-4.8,-87.7,-22.3,-79.6,-34.8C-71.5,-47.3,-55.8,-54.9,-41.3,-64.2C-26.7,-73.6,-13.4,-84.7,0.8,-86C15,-87.2,29.9,-78.5,43.1,-68.5Z"
          transform="translate(100 100)"
          fill="none"
          stroke="none"
          pathLength="100"
        />

        <text className={styles.textContent}>
          <textPath href="#welcomeTextPath" startOffset="0%">
            ❤ MADE WITH LOVE ❤ MADE WITH LOVE ❤ MADE WITH LOVE ❤ MADE WITH LOVE
            <animate
              attributeName="startOffset"
              from="0%"
              to="100%"
              dur="15s"
              repeatCount="indefinite"
            />
          </textPath>
          <textPath href="#welcomeTextPath" startOffset="100%">
            ❤ MADE WITH LOVE ❤ MADE WITH LOVE ❤ MADE WITH LOVE ❤ MADE WITH LOVE
            <animate
              attributeName="startOffset"
              from="-100%"
              to="0%"
              dur="15s"
              repeatCount="indefinite"
            />
          </textPath>
        </text>
      </svg>
    </main>
  );
}
