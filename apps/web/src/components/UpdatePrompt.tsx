import { useTranslation } from "react-i18next";
import { useRegisterSW } from "virtual:pwa-register/react";

export function UpdatePrompt() {
  const { t } = useTranslation();
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) return null;
  return (
    <div className="fixed inset-x-4 bottom-4 mx-auto flex max-w-md items-center justify-between gap-3 rounded-xl bg-ink px-4 py-3 text-sm text-white shadow-lg">
      <span>{t("pwa.update")}</span>
      <button className="rounded-lg bg-brand-soft px-3 py-1 font-medium text-ink" onClick={() => updateServiceWorker(true)}>
        {t("pwa.reload")}
      </button>
    </div>
  );
}
