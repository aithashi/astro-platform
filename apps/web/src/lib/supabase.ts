import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabaseConfig = {
  url: url ?? "http://127.0.0.1:54321",
  key: key ?? "missing-key",
  configured: Boolean(url && key),
};

export const supabase = createClient(supabaseConfig.url, supabaseConfig.key);

/** Calls a Supabase Edge Function; all client-side writes go through these. */
export async function callFunction<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>(name, { body });
  if (error) throw error;
  return data as T;
}
