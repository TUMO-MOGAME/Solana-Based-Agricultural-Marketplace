import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import TrendsView from "./trends-view";

export const metadata: Metadata = {
  title: "Trends 2025 — Social Assembly",
  description:
    "Month-by-month look at what is trending in 2025, based on Google Trends.",
};

// Roboto matches the reference design the trends slideshow was built from.
// Scoped via --font-roboto on the page wrapper — does not leak elsewhere.
const roboto = Roboto({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-roboto",
  display: "swap",
});

export default function TrendsPage() {
  return <TrendsView fontVar={roboto.variable} />;
}
