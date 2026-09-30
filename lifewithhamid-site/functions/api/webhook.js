// POST /api/webhook
// Stripe webhook endpoint. Register this URL in the Stripe Dashboard
// (Developers -> Webhooks) once the site is live, listening at minimum
// for "checkout.session.completed".
//
// This is a safety net alongside success.html/verify-session.js: it
// catches orders even if the buyer closes the tab before the success
// page loads. Right now it just verifies the signature and logs the
// order to KV if you've bound one (optional) — wire in email delivery
// here as a fast-follow (e.g. call Resend's API) once you're ready.

export async function onRequestPost({ request, env }) {
  const signatureHeader = request.headers.get("stripe-signature");
  const rawBody = await request.text();

  if (!signatureHeader || !env.STRIPE_WEBHOOK_SECRET) {
    return new Response("Missing signature or webhook secret not configured", { status: 400 });
  }

  const valid = await verifyStripeSignature(rawBody, signatureHeader, env.STRIPE_WEBHOOK_SECRET);
  if (!valid) {
    return new Response("Invalid signature", { status: 400 });
  }

  const event = JSON.parse(rawBody);

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;

    // Optional: persist a minimal order record if you've bound a KV
    // namespace called ORDERS_KV in your Pages project settings.
    if (env.ORDERS_KV) {
      await env.ORDERS_KV.put(
        session.id,
        JSON.stringify({
          sessionId: session.id,
          email: session.customer_details?.email,
          productSlug: session.metadata?.product_slug,
          amountTotal: session.amount_total,
          currency: session.currency,
          createdAt: new Date().toISOString(),
        })
      );
    }

    // TODO (fast-follow): send a confirmation + download-link email here
    // via an email API (e.g. Resend/Postmark) as a backup to success.html.
  }

  return new Response("ok", { status: 200 });
}

async function verifyStripeSignature(payload, signatureHeader, secret) {
  const parts = Object.fromEntries(
    signatureHeader.split(",").map((pair) => pair.split("="))
  );
  const timestamp = parts.t;
  const signatures = signatureHeader
    .split(",")
    .filter((p) => p.startsWith("v1="))
    .map((p) => p.slice(3));

  if (!timestamp || signatures.length === 0) return false;

  // Reject events older than 5 minutes to reduce replay risk.
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (age > 300) return false;

  const signedPayload = `${timestamp}.${payload}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signatureBuffer = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signedPayload));
  const expected = toHex(signatureBuffer);

  return signatures.some((sig) => timingSafeEqual(sig, expected));
}

function toHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
