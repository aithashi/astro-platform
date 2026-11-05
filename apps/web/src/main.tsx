import "./index.css";
import "./i18n";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { lazy, StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";
import { UpdatePrompt } from "./components/UpdatePrompt";
import { router } from "./router";

// Dev-only helpers; the DEV check lets Vite drop the import from production builds.
const DevTools = import.meta.env.DEV
  ? lazy(async () => ({ default: (await import("./components/DevTools")).DevTools }))
  : () => null;

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 60_000, retry: 1 } },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={null}>
        <DevTools />
      </Suspense>
      <RouterProvider router={router} />
      <UpdatePrompt />
    </QueryClientProvider>
  </StrictMode>,
);
