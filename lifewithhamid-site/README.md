# Life With Hamid — Digital Products Site

A static site (Cloudflare Pages) with two small serverless functions handling
Stripe Checkout. No WordPress/WooCommerce, no separate server.

## What's in here

```
index.html              Home page
products.html           Product catalog (reads products.json, starts checkout)
success.html            Post-purchase page (verifies payment, reveals download)
privacy-policy.html     Legal — edit placeholders before going live
refund-policy.html      Legal — edit placeholders before going live
terms-of-service.html   Legal — edit placeholders before going live
contact.html            Contact info
style.css               Shared styling
products.json           Product catalog: name, price, Stripe price ID, access link
functions/api/
  create-checkout-session.js   Creates a Stripe Checkout Session for a product
  verify-session.js            Confirms payment, returns the download link
  webhook.js                   Verifies Stripe webhook signature, logs orders
```

## Before you go live — fill these in

1. **Legal pages**: replace `[LEGAL ENTITY NAME]` and `[DATE]` placeholders in
   `privacy-policy.html`, `refund-policy.html`, `terms-of-service.html`. These
   are starting templates, not legal advice — worth a quick lawyer review,
   especially the refund policy given UAE consumer rules.
2. **Contact email**: update the address in `contact.html` (and the mailto
   link) to your real support inbox.
3. **products.json**: the `accessUrl` for `budget-tracker` is a placeholder
   Google Sheets link — replace `REPLACE_WITH_YOUR_TEMPLATE_ID` with your
   real template's "Make a copy" link once it's built. To add more products
   later, add another entry here with its own Stripe `priceId`.

## Deploying to Cloudflare Pages

1. Push this folder to a GitHub repo (Cloudflare Pages deploys from Git).
2. In the Cloudflare dashboard: **Workers & Pages → Create → Pages → Connect
   to Git**, pick the repo. No build command needed — this is a static site
   with a `functions/` folder, which Cloudflare Pages picks up automatically.
   Leave the build output directory as the repo root (`/`).
3. Under the new Pages project's **Settings → Environment variables**, add:
   - `STRIPE_SECRET_KEY` — your Stripe **secret** key (test key to start —
     `sk_test_...`; switch to `sk_live_...` only once your Stripe account is
     activated for live payments).
   - `STRIPE_WEBHOOK_SECRET` — see step 5 below.
   - (Optional) bind a **KV namespace** named `ORDERS_KV` under
     **Settings → Functions → KV namespace bindings** if you want a simple
     order log — not required for the checkout flow to work.
4. Under **Custom domains**, add `lifewithhamid.com` (and `www` if you want
   it). Since the domain is already on Cloudflare, this is a couple of clicks
   with no manual DNS editing needed.
5. **Register the webhook** in the Stripe Dashboard (Developers → Webhooks →
   Add endpoint) pointing to `https://lifewithhamid.com/api/webhook`,
   listening for at least `checkout.session.completed`. Stripe will show you
   a signing secret (`whsec_...`) — paste that into the `STRIPE_WEBHOOK_SECRET`
   environment variable from step 3.
6. Redeploy (Cloudflare Pages redeploys automatically on env var changes, or
   trigger one manually) and test an end-to-end purchase using a
   [Stripe test card](https://docs.stripe.com/testing) before switching to
   live keys.

## Going live with real payments

Switching `STRIPE_SECRET_KEY` from `sk_test_...` to `sk_live_...` only works
once your Stripe account has completed activation/verification. Until then,
the site works fully in test mode — good enough to have a live, working
website for Stripe's activation review.

## Adding a new product later

1. Create the Product + Price in the Stripe Dashboard (or ask me to do it via
   the Stripe MCP tools).
2. Add an entry to `products.json` with the new `priceId`, name, description,
   price display text, and access/download URL.
3. No code changes needed — `products.html` and the checkout function both
   read from this file automatically.
