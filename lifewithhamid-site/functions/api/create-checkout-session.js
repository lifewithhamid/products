// POST /api/create-checkout-session
// Body: { "slug": "budget-tracker" }
// Looks up the product in products.json, creates a Stripe Checkout Session
// for its price, and returns { url } for the browser to redirect to.

export async function onRequestPost({ request, env }) {
  try {
    const { slug } = await request.json();

    if (!slug) {
      return json({ error: "Missing product slug" }, 400);
    }

    const origin = new URL(request.url).origin;

    // Load the product catalog from the same deployment's static assets.
    const productsRes = await fetch(`${origin}/products.json`);
    if (!productsRes.ok) {
      return json({ error: "Could not load product catalog" }, 500);
    }
    const products = await productsRes.json();
    const product = products[slug];

    if (!product) {
      return json({ error: "Unknown product" }, 404);
    }

    if (!env.STRIPE_SECRET_KEY) {
      return json({ error: "Server is not configured with a Stripe secret key" }, 500);
    }

    const body = new URLSearchParams();
    body.set("mode", "payment");
    body.set("line_items[0][price]", product.priceId);
    body.set("line_items[0][quantity]", "1");
    body.set("success_url", `${origin}/success.html?session_id={CHECKOUT_SESSION_ID}`);
    body.set("cancel_url", `${origin}/products.html`);
    body.set("metadata[product_slug]", slug);

    const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });

    const session = await stripeRes.json();

    if (!stripeRes.ok) {
      return json({ error: session.error?.message || "Stripe error creating session" }, 502);
    }

    return json({ url: session.url });
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
