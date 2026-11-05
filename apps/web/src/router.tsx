import { createBrowserRouter } from "react-router";
import { Landing } from "./routes/Landing";
import { Track } from "./routes/Track";

const placeholder = (titleKey: string, ownerOnly = false) => ({
  HydrateFallback: Loading,
  lazy: async () => {
    const { Placeholder } = await import("./routes/admin/Placeholder");
    return { element: <Placeholder titleKey={titleKey} ownerOnly={ownerOnly} /> };
  },
});

function Loading() {
  return <p className="px-4 py-8 text-center text-sm text-muted">Loading…</p>;
}

// Admin code is lazy-loaded so clients opening the WhatsApp link download less.
export const router = createBrowserRouter([
  { path: "/", element: <Landing /> },
  { path: "/t/:ref", element: <Track /> },
  {
    path: "/admin/login",
    HydrateFallback: Loading,
    lazy: async () => ({ Component: (await import("./routes/admin/AdminLogin")).AdminLogin }),
  },
  {
    path: "/admin",
    HydrateFallback: Loading,
    lazy: async () => ({ Component: (await import("./routes/admin/AdminLayout")).AdminLayout }),
    children: [
      { index: true, ...placeholder("admin.inbox") },
      { path: "schedule", ...placeholder("admin.schedule") },
      { path: "associates", ...placeholder("admin.associates") },
      { path: "team", ...placeholder("admin.team", true) },
      { path: "settings", ...placeholder("admin.settings", true) },
    ],
  },
]);
