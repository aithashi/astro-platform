// Meta WhatsApp Cloud API webhook.
// GET  = subscription verification handshake.
// POST = inbound messages + delivery statuses, signed with X-Hub-Signature-256.
// M2 adds: reply to "Hi" with the app link, and store delivery statuses.
import { hmacSha256Hex, requireEnv, safeEqual } from "../_shared/http.ts";
import { supabaseAdmin } from "../_shared/supabaseAdmin.ts";

interface InboundMessage {
  from: string;
  id: string;
  type: string;
  text?: { body: string };
}

Deno.serve(async (req) => {
  const url = new URL(req.url);

  if (req.method === "GET") {
    const ok =
      url.searchParams.get("hub.mode") === "subscribe" &&
      url.searchParams.get("hub.verify_token") === requireEnv("WHATSAPP_VERIFY_TOKEN");
    return ok ? new Response(url.searchParams.get("hub.challenge") ?? "") : new Response("forbidden", { status: 403 });
  }
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });

  const raw = await req.text();
  const expected = `sha256=${await hmacSha256Hex(requireEnv("WHATSAPP_APP_SECRET"), raw)}`;
  if (!safeEqual(req.headers.get("x-hub-signature-256") ?? "", expected)) {
    return new Response("bad signature", { status: 401 });
  }

  const payload = JSON.parse(raw);
  const messages: InboundMessage[] =
    payload.entry?.flatMap((e: any) => e.changes?.flatMap((c: any) => c.value?.messages ?? []) ?? []) ?? [];

  for (const m of messages) {
    // provider_message_id is unique, so Meta's retries are ignored.
    await supabaseAdmin.from("message_log").upsert(
      {
        direction: "inbound",
        from_phone: `+${m.from}`,
        body: m.text?.body ?? `[${m.type}]`,
        provider_message_id: m.id,
      },
      { onConflict: "provider_message_id", ignoreDuplicates: true },
    );
    // TODO(M2): send the greeting + signed app link as a free service message.
  }

  // Always 200 quickly; Meta retries on anything else.
  return new Response("ok");
});
