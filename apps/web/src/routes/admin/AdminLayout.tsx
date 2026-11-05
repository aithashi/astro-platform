import { useTranslation } from "react-i18next";
import { Navigate, NavLink, Outlet } from "react-router";
import { supabase } from "@/lib/supabase";
import { useSession, useStaff, type Staff } from "@/lib/useStaff";

const NAV = [
  { to: "/admin", key: "admin.inbox", end: true },
  { to: "/admin/schedule", key: "admin.schedule" },
  { to: "/admin/associates", key: "admin.associates" },
  { to: "/admin/team", key: "admin.team", ownerOnly: true },
  { to: "/admin/settings", key: "admin.settings", ownerOnly: true },
];

export type AdminOutletContext = { staff: Staff };

export function AdminLayout() {
  const { t } = useTranslation();
  const session = useSession();
  const staff = useStaff(session?.user.id);

  if (session === undefined || staff.isLoading) return null;
  if (!session) return <Navigate to="/admin/login" replace />;
  if (!staff.data) {
    // Signed in but not on the team (or deactivated).
    void supabase.auth.signOut();
    return <Navigate to="/admin/login" replace />;
  }

  return (
    <div className="mx-auto max-w-5xl px-4">
      <header className="flex flex-wrap items-center justify-between gap-2 py-4">
        <h1 className="text-lg font-semibold text-brand">{t("admin.title")}</h1>
        <button className="text-sm text-muted underline" onClick={() => void supabase.auth.signOut()}>
          {t("admin.signOut")}
        </button>
      </header>
      <nav className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-3 text-sm">
        {NAV.filter((n) => !n.ownerOnly || staff.data!.role === "owner").map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            className={({ isActive }) =>
              `whitespace-nowrap rounded-lg px-3 py-1.5 ${isActive ? "bg-brand text-white" : "bg-white text-ink"}`
            }
          >
            {t(n.key)}
          </NavLink>
        ))}
      </nav>
      <main className="py-4">
        <Outlet context={{ staff: staff.data } satisfies AdminOutletContext} />
      </main>
    </div>
  );
}
