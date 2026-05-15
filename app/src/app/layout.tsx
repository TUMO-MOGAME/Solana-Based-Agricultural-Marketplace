import type { Metadata, Viewport } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import { VunaWalletProvider } from "@/lib/vuna/provider";
import { BackgroundVideo } from "@/components/background-video";
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
    default: "Mazra'at albaan",
    template: "%s · Mazra'at albaan",
  },
  description:
    "Mazra'at albaan — credit, certified inputs, and parametric drought insurance for South African smallholder farmers, bundled into one Grow Pack and repaid at harvest.",
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
        <BackgroundVideo />
        <VunaWalletProvider>{children}</VunaWalletProvider>
      </body>
    </html>
  );
}
