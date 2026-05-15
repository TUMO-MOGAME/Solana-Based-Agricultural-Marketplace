// South Africa has 11 official languages (12 if you count SA Sign Language,
// but that doesn't have a text rendering — we leave it off the picker).
//
// `code` matches ISO 639-1 / 639-3 conventions where available:
//   - en, af, zu, xh: ISO 639-1
//   - st (Southern Sotho), tn (Tswana), ss (Swati), ve (Venda), ts (Tsonga): ISO 639-1
//   - nso (Northern Sotho / Sepedi), nr (Southern Ndebele): ISO 639-3
//
// `native` is the endonym — what speakers of that language call their own
// language. This is what we show in the picker so a farmer who can only
// read their own language can still find it.

export type LocaleCode =
  | "en"
  | "af"
  | "zu"
  | "xh"
  | "st"
  | "tn"
  | "nso"
  | "ss"
  | "nr"
  | "ve"
  | "ts";

export interface Locale {
  code: LocaleCode;
  /** English name — e.g. "isiZulu". */
  english: string;
  /** Endonym — e.g. "isiZulu". */
  native: string;
  /** True if the translation has been spot-checked by a native speaker.
   *  All false for now — see CLAUDE.md "Translation review" caveat. */
  reviewed: boolean;
}

export const LOCALES: readonly Locale[] = [
  { code: "en",  english: "English",          native: "English",          reviewed: true  },
  { code: "af",  english: "Afrikaans",        native: "Afrikaans",        reviewed: false },
  { code: "zu",  english: "isiZulu",          native: "isiZulu",          reviewed: false },
  { code: "xh",  english: "isiXhosa",         native: "isiXhosa",         reviewed: false },
  { code: "st",  english: "Sesotho",          native: "Sesotho",          reviewed: false },
  { code: "tn",  english: "Setswana",         native: "Setswana",         reviewed: false },
  { code: "nso", english: "Sepedi",           native: "Sesotho sa Leboa", reviewed: false },
  { code: "ss",  english: "siSwati",          native: "siSwati",          reviewed: false },
  { code: "nr",  english: "isiNdebele",       native: "isiNdebele",       reviewed: false },
  { code: "ve",  english: "Tshivenda",        native: "Tshivenḓa",        reviewed: false },
  { code: "ts",  english: "Xitsonga",         native: "Xitsonga",         reviewed: false },
] as const;

export const DEFAULT_LOCALE: LocaleCode = "en";

/** localStorage key for the farmer's chosen language. */
export const LOCALE_STORAGE_KEY = "vuna.locale";

export function isLocaleCode(value: unknown): value is LocaleCode {
  if (typeof value !== "string") return false;
  return LOCALES.some((l) => l.code === value);
}

export function findLocale(code: LocaleCode): Locale {
  return LOCALES.find((l) => l.code === code) ?? LOCALES[0];
}
