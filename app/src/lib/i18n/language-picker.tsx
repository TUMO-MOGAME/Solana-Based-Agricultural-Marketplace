"use client";

// <LanguagePicker /> — dropdown for the 11 South African official languages.
//
// Shown in the dashboard left sidebar. Persists choice via the I18nProvider's
// setLocale (which writes to localStorage). Displays the native endonym so a
// farmer who only reads their home language can find it.

import { Globe } from "lucide-react";
import { LOCALES } from "./locales";
import { useT } from "./provider";

export function LanguagePicker() {
  const { locale, setLocale } = useT();
  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 12px",
        margin: "8px 12px",
        borderRadius: 10,
        background: "rgba(0, 0, 0, 0.28)",
        border: "1px solid rgba(255, 230, 210, 0.14)",
        cursor: "pointer",
      }}
      title="Change the dashboard language"
    >
      <Globe size={14} style={{ color: "#ffb86b", flexShrink: 0 }} />
      <select
        value={locale}
        onChange={(e) => {
          const next = e.target.value;
          // Validated by the option list — narrow via LOCALES.
          const found = LOCALES.find((l) => l.code === next);
          if (found) setLocale(found.code);
        }}
        style={{
          flex: 1,
          background: "transparent",
          border: "none",
          outline: "none",
          color: "rgba(255, 245, 230, 0.95)",
          fontSize: 12,
          fontFamily: "inherit",
          fontWeight: 600,
          cursor: "pointer",
          minWidth: 0,
        }}
      >
        {LOCALES.map((l) => (
          <option
            key={l.code}
            value={l.code}
            style={{ background: "#1a0f0c", color: "rgba(255, 245, 230, 0.95)" }}
          >
            {l.native}
            {!l.reviewed && l.code !== "en" ? " *" : ""}
          </option>
        ))}
      </select>
    </label>
  );
}
