/** DB text stored as {"en": "...", "kn": "..."}; falls back to English. */
export type I18nText = Partial<Record<"en" | "kn" | "hi", string>>;

export function pickText(text: I18nText | null | undefined, lang: string): string {
  if (!text) return "";
  return text[lang as keyof I18nText] ?? text.en ?? "";
}
