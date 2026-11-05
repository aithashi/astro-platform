// Loaded only in dev (see main.tsx).
import { useQuery } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { supabaseConfig } from "@/lib/supabase";

async function checkBackend(): Promise<string | null> {
  if (!supabaseConfig.configured) {
    return "Supabase env missing. Copy apps/web/.env.example to apps/web/.env.local and fill in the keys.";
  }
  try {
    await fetch(`${supabaseConfig.url}/auth/v1/health`, { headers: { apikey: supabaseConfig.key } });
    return null;
  } catch {
    return `Supabase not reachable at ${supabaseConfig.url}. Run \`pnpm db:start\` (needs Docker), or point .env.local at a hosted project.`;
  }
}

function BackendBanner() {
  const { data: problem } = useQuery({ queryKey: ["dev-backend-check"], queryFn: checkBackend, refetchInterval: 10_000 });
  if (!problem) return null;
  return (
    <div role="alert" className="sticky top-0 z-50 bg-amber-100 px-4 py-2 text-xs text-amber-900">
      <strong>Dev:</strong> {problem}
    </div>
  );
}

export function DevTools() {
  return (
    <>
      <BackendBanner />
      <ReactQueryDevtools buttonPosition="bottom-left" />
    </>
  );
}
