// Public endpoint behind the concern form. Validates with the same zod schema as the UI.
// M1 adds: upsert client, classify case A/B/C, insert ticket + consent, issue signed
// upload URLs for attachments, and (M2) send the WhatsApp confirmation.
import { classifyTicket, initialStatus, ticketFormSchema } from "@astro/shared";
import { corsHeaders, json } from "../_shared/http.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const parsed = ticketFormSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return json({ error: "invalid", issues: parsed.error.issues.map((i) => ({ path: i.path, code: i.message })) }, 400);
  }

  // Placeholder until client lookup lands in M1.
  const caseType = classifyTicket({ knownClient: false, queryKind: parsed.data.queryKind });
  return json({ error: "not_implemented", preview: { caseType, status: initialStatus(caseType) } }, 501);
});
