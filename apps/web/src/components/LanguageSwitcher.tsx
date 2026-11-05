import { useTranslation } from "react-i18next";
import { LANGUAGES } from "@/i18n";

export function LanguageSwitcher() {
  const { i18n } = useTranslation();
  return (
    <select
      aria-label="Language"
      className="rounded-lg border border-brand/20 bg-white px-2 py-1 text-sm"
      value={i18n.resolvedLanguage}
      onChange={(e) => void i18n.changeLanguage(e.target.value)}
    >
      {LANGUAGES.map((l) => (
        <option key={l.code} value={l.code}>
          {l.label}
        </option>
      ))}
    </select>
  );
}
