import type { Metadata, Viewport } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import "./globals.css";

// Satoshi is loaded locally via @font-face in globals.css (see public/fonts/).
// Geist_Mono is kept as the monospace face for code blocks and artifacts.
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Inter is loaded globally so the /login and /signup pages render with it
// on first navigation (no FOUT / blurry flash). Satoshi remains the default
// sans via globals.css — Inter is applied only inside the auth card wrapper
// via the --font-inter CSS variable.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "700", "900"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Social Assembly",
    template: "%s · Social Assembly",
  },
  description:
    "AI-powered growth platform for South African content creators — upload a video and get second-by-second coaching on hooks, pacing, and thumbnails before you post.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: "#ffffff",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistMono.variable} ${inter.variable} font-sans antialiased min-h-[100svh] w-full overflow-x-hidden`}
      >
        {children}
      </body>
    </html>
  );
}
