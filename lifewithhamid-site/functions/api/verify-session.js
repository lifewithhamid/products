// GET /api/verify-session?session_id=cs_test_...
// Confirms a Checkout Session was actually paid, then returns the
// product's access/download link. This is what gates delivery on
// success.html — a buyer only sees the download link if Stripe
// confirms the payment server-side.

export async function onRequestGet({ request, env }) {
  try {
    const url = new URL(request.url);
    const sessionId = url.searchParams.get("session_id");

    if (!sessionId) {
      return json({ error: "Missing session_id" }, 400);
    }

    if (!env.STRIPE_SECRET_KEY) {
      return json({ error: "Server is not configured with a Stripe secret key" }, 500);
    }

    const stripeRes = await fetch(
      `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`,
      { headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` } }
    );

    const session = await stripeRes.json();

    if (!stripeRes.ok) {
      return json({ error: session.error?.message || "Could not retrieve session" }, 502);
    }

    if (session.payment_status !== "paid") {
      return json({ paid: false });
    }

    const slug = session.metadata?.product_slug;
    const origin = url.origin;
    const productsRes = await fetch(`${origin}/products.json`);
    const products = await productsRes.json();
    const product = slug ? products[slug] : null;

    if (!product) {
      // Paid, but we couldn't map it to a product — surface enough to
      // support the buyer manually rather than fail silently.
      return json({ paid: true, name: null, accessUrl: null });
    }

    return json({ paid: true, name: product.name, accessUrl: product.accessUrl });
  } catch (err) {
    return json({ error: "Unexpected server error" }, 500);
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
