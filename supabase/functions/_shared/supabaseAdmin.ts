import { createClient } from "@supabase/supabase-js";
import { requireEnv } from "./http.ts";

/** Service-role client: bypasses RLS, so only use it after validating the request. */
export const supabaseAdmin = createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false },
});
