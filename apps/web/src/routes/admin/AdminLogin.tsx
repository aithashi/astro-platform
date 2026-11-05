import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/lib/supabase";

export function AdminLogin() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      // Staff are invited by the owner; never self-register here.
      options: { shouldCreateUser: false, emailRedirectTo: `${location.origin}/admin` },
    });
    if (error) setError(error.message);
    else setSent(true);
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-xl font-semibold text-brand">{t("admin.login")}</h1>
      {sent ? (
        <p className="mt-4 text-sm">{t("admin.linkSent")}</p>
      ) : (
        <form onSubmit={onSubmit} className="mt-6 grid gap-3">
          <label className="grid gap-1 text-sm">
            {t("admin.emailLabel")}
            <input
              type="email"
              required
              autoComplete="email"
              className="rounded-lg border border-brand/20 bg-white px-3 py-2"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          {error && <p className="text-sm text-red-700">{error}</p>}
          <button className="rounded-lg bg-brand px-4 py-2 font-medium text-white">{t("admin.sendLink")}</button>
        </form>
      )}
    </div>
  );
}
