"use client";

// <I18nProvider> + useT() — minimal client-side i18n for the farmer surface.
//
// We deliberately don't use next-intl or i18next:
//   - Persistence is localStorage (per-device, simple).
//   - Strings live in one TS module (lib/i18n/messages.ts), type-checked.
//   - No need for SSR-resolved locale because the dashboard is fully client.
//
// Provider is mounted in app/layout.tsx so every route has access. Reading
// the locale before hydration falls back to English (DEFAULT_LOCALE) to
// avoid a flicker between server-rendered and client-rendered UI.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  DEFAULT_LOCALE,
  isLocaleCode,
  LOCALE_STORAGE_KEY,
  type LocaleCode,
} from "./locales";
import { MESSAGES, type MessageKey } from "./messages";

interface I18nContextValue {
  locale: LocaleCode;
  setLocale: (next: LocaleCode) => void;
  /**
   * Look up a localised string. Falls back to English, then to the supplied
   * fallback string, then to the raw key. Never returns undefined.
   */
  t: (key: MessageKey, fallback?: string) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<LocaleCode>(DEFAULT_LOCALE);

  // Hydrate from localStorage AFTER mount so SSR + first client render agree
  // (preventing hydration mismatches in Next.js).
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
      if (isLocaleCode(stored)) setLocaleState(stored);
    } catch {
      // Privacy-mode browsers throw on localStorage access. Stay on default.
    }
  }, []);

  const setLocale = useCallback((next: LocaleCode) => {
    setLocaleState(next);
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(LOCALE_STORAGE_KEY, next);
      }
    } catch {
      // ignore
    }
  }, []);

  const t = useCallback(
    (key: MessageKey, fallback?: string): string => {
      const map = MESSAGES[locale] ?? MESSAGES[DEFAULT_LOCALE];
      const value = map[key];
      if (value) return value;
      const enValue = MESSAGES[DEFAULT_LOCALE][key];
      if (enValue) return enValue;
      return fallback ?? key;
    },
    [locale],
  );

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

/** Get the current locale + setter + translator. Must be used inside <I18nProvider>. */
export function useT(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useT() must be used inside <I18nProvider>");
  }
  return ctx;
}

/**
 * Map a GrowPack status string (the raw enum from the on-chain decoder)
 * to its localised label. Returns the original status as a fallback when
 * we receive an unexpected value — that way bad data on chain still renders
 * something, instead of an empty badge.
 */
export function translateStatus(
  status: string,
  t: (key: MessageKey, fallback?: string) => string,
): string {
  switch (status) {
    case "Requested":
      return t("status.requested");
    case "Approved":
      return t("status.approved");
    case "Active":
      return t("status.active");
    case "InsurancePaid":
      return t("status.insurance_paid");
    case "Repaid":
      return t("status.repaid");
    case "Defaulted":
      return t("status.defaulted");
    default:
      return status;
  }
}
