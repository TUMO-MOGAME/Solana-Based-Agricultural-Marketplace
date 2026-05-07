import type { Metadata } from "next";
import Link from "next/link";
import { Cinzel, Manrope } from "next/font/google";
import { ArrowLeft, Mail } from "lucide-react";
import styles from "./team.module.css";

export const metadata: Metadata = {
  title: "The Team — Social Assembly",
  description:
    "The three people behind Social Assembly: Emma Matlhaga, Tumo Mogame, Kgaume Pitsi.",
};

// Same font pairing as / and /about — keeps the public pages consistent.
const cinzel = Cinzel({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--font-cinzel",
  display: "swap",
});

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-manrope",
  display: "swap",
});

// Official LinkedIn brand mark — lucide-react's `Linkedin` icon is flagged
// deprecated in the version pinned for this project, so we inline the SVG.
function LinkedInIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.852 3.37-1.852 3.601 0 4.267 2.37 4.267 5.455v6.288zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

/* ── Team members ─────────────────────────────────────────────────────
   Avatars are i.pravatar.cc placeholders. Linkedin URLs and the two
   missing emails are "#" placeholders — fill them in once confirmed.
   ────────────────────────────────────────────────────────────────── */
const TEAM = [
  {
    name: "Emma Matlhaga",
    role: "Founder & CEO",
    avatar: "https://i.pravatar.cc/300?img=26",
    email: "emma.m.strategy@gmail.com",
    linkedin: "#",
  },
  {
    name: "Tumo Mogame",
    role: "Co-founder · Developer",
    avatar: "https://i.pravatar.cc/300?img=7",
    email: "#",
    linkedin: "#",
  },
  {
    name: "Kgaume Pitsi",
    role: "Co-founder · Developer",
    avatar: "https://i.pravatar.cc/300?img=8",
    email: "#",
    linkedin: "#",
  },
];

export default function TeamPage() {
  return (
    <main
      className={`${cinzel.variable} ${manrope.variable} ${styles.wrapper}`}
    >
      <div className={styles.ambientLight} aria-hidden="true" />

      <Link href="/" className={styles.back}>
        <ArrowLeft size={14} /> Back
      </Link>

      <section className={styles.gallery}>
        {/* Title — centre of the gallery. Plain <div> with just an <h1>
            (no <hgroup>) so it doesn't inherit the absolute-positioned
            hgroup rule that's meant for the member labels. */}
        <div>
          <h1>The Team</h1>
        </div>

        {/* Each member — surrounds the title. The <hgroup> inside each
            card anchor-positions itself over the title slot on hover.
            Wrapper is <article tabIndex={0}> (not <a>) so the social
            anchors inside the hgroup aren't nested inside another anchor. */}
        {TEAM.map((person) => {
          const hasEmail = person.email !== "#";
          const hasLinkedin = person.linkedin !== "#";
          const emailHref = hasEmail ? `mailto:${person.email}` : "#";
          return (
            <article key={person.name} tabIndex={0} className={styles.member}>
              <hgroup>
                <h2>{person.name}</h2>
                <p>{person.role}</p>
                <div className={styles.socials}>
                  <a
                    href={emailHref}
                    aria-label={
                      hasEmail
                        ? `Email ${person.name}`
                        : `Email for ${person.name} coming soon`
                    }
                    aria-disabled={hasEmail ? undefined : true}
                    tabIndex={hasEmail ? undefined : -1}
                    title={hasEmail ? person.email : "Email coming soon"}
                  >
                    <Mail size={14} strokeWidth={1.75} />
                  </a>
                  <a
                    href={person.linkedin}
                    target={hasLinkedin ? "_blank" : undefined}
                    rel={hasLinkedin ? "noopener noreferrer" : undefined}
                    aria-label={
                      hasLinkedin
                        ? `${person.name} on LinkedIn`
                        : `LinkedIn for ${person.name} coming soon`
                    }
                    aria-disabled={hasLinkedin ? undefined : true}
                    tabIndex={hasLinkedin ? undefined : -1}
                    title={hasLinkedin ? "LinkedIn" : "LinkedIn coming soon"}
                  >
                    <LinkedInIcon size={14} />
                  </a>
                </div>
              </hgroup>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={person.avatar}
                width={100}
                height={100}
                alt={person.name}
              />
            </article>
          );
        })}
      </section>
    </main>
  );
}
