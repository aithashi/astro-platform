import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { pickText, type I18nText } from "@/lib/i18nText";
import { supabase } from "@/lib/supabase";

interface Service {
  id: string;
  name: I18nText;
  description: I18nText | null;
}

interface Associate {
  id: string;
  name: string;
  services: I18nText;
  phone: string;
}

function useServices() {
  return useQuery({
    queryKey: ["services"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select("id, name, description")
        .eq("active", true)
        .order("sort_order");
      if (error) throw error;
      return data as Service[];
    },
  });
}

function useAssociates() {
  return useQuery({
    queryKey: ["associates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("associates")
        .select("id, name, services, phone")
        .eq("active", true)
        .order("sort_order");
      if (error) throw error;
      return data as Associate[];
    },
  });
}

export function Landing() {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage ?? "en";
  const services = useServices();
  const associates = useAssociates();

  return (
    <div className="mx-auto max-w-2xl px-4 pb-16">
      <header className="flex items-center justify-between py-4">
        <div>
          <h1 className="text-xl font-semibold text-brand">{t("app.name")}</h1>
          <p className="text-sm text-muted">{t("app.tagline")}</p>
        </div>
        <LanguageSwitcher />
      </header>

      <section className="mt-4">
        <h2 className="mb-3 text-lg font-semibold">{t("landing.servicesTitle")}</h2>
        {services.data?.length ? (
          <ul className="grid gap-3 sm:grid-cols-2">
            {services.data.map((s) => (
              <li key={s.id} className="rounded-xl border border-brand/15 bg-white p-4">
                <p className="font-medium">{pickText(s.name, lang)}</p>
                {s.description && <p className="mt-1 text-sm text-muted">{pickText(s.description, lang)}</p>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">{t("landing.servicesPending")}</p>
        )}
      </section>

      <section className="mt-8 rounded-xl border border-dashed border-brand/30 bg-white p-4">
        <h2 className="text-lg font-semibold">{t("landing.formTitle")}</h2>
        <p className="mt-1 text-sm text-muted">{t("landing.formPending")}</p>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">{t("landing.associatesTitle")}</h2>
        <p className="mb-3 text-sm text-muted">{t("landing.associatesIntro")}</p>
        {associates.data?.length ? (
          <ul className="grid gap-3">
            {associates.data.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 rounded-xl border border-brand/15 bg-white p-4">
                <div className="min-w-0">
                  <p className="font-medium">{a.name}</p>
                  <p className="text-sm text-muted">{pickText(a.services, lang)}</p>
                </div>
                <div className="flex shrink-0 gap-2 text-sm">
                  <a className="rounded-lg border border-brand/30 px-3 py-1" href={`tel:${a.phone}`}>
                    {t("landing.call")}
                  </a>
                  <a className="rounded-lg bg-brand px-3 py-1 text-white" href={`https://wa.me/${a.phone.replace("+", "")}`}>
                    {t("landing.whatsapp")}
                  </a>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">{t("landing.associatesPending")}</p>
        )}
      </section>
    </div>
  );
}
