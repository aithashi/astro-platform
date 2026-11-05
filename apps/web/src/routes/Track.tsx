import { useTranslation } from "react-i18next";
import { useParams } from "react-router";

export function Track() {
  const { t } = useTranslation();
  const { ref } = useParams();
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-xl font-semibold text-brand">
        {t("track.title")} {ref}
      </h1>
      <p className="mt-2 text-sm text-muted">{t("track.pending")}</p>
    </div>
  );
}
