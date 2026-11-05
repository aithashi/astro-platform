// Razorpay webhook: the source of truth for payments (never trust the browser callback).
// Signature = hex HMAC-SHA256(raw body, webhook secret) in X-Razorpay-Signature.
// M4 adds: on payment.captured, mark the payment captured and confirm the held booking.
import { hmacSha256Hex, requireEnv, safeEqual } from "../_shared/http.ts";

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });

  const raw = await req.text();
  const expected = await hmacSha256Hex(requireEnv("RAZORPAY_WEBHOOK_SECRET"), raw);
  if (!safeEqual(req.headers.get("x-razorpay-signature") ?? "", expected)) {
    return new Response("bad signature", { status: 401 });
  }

  const event = JSON.parse(raw);
  console.log("razorpay event", event.event, event.payload?.payment?.entity?.id);
  // TODO(M4): idempotent update keyed on razorpay_payment_id.

  return new Response("ok");
});
