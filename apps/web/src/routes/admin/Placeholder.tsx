import { useTranslation } from "react-i18next";
import { Navigate, useOutletContext } from "react-router";
import type { AdminOutletContext } from "./AdminLayout";

export function Placeholder({ titleKey, ownerOnly }: { titleKey: string; ownerOnly?: boolean }) {
  const { t } = useTranslation();
  const { staff } = useOutletContext<AdminOutletContext>();
  if (ownerOnly && staff.role !== "owner") return <Navigate to="/admin" replace />;
  return (
    <section>
      <h2 className="text-lg font-semibold">{t(titleKey)}</h2>
      <p className="mt-1 text-sm text-muted">{t("admin.comingSoon")}</p>
    </section>
  );
}
