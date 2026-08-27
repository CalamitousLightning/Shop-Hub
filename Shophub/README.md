# LUC Marketplace
**LUC = Logozor Unique Computer**

A general-purpose Jumia/Temu-style e-commerce demo, rebuilt from the SwapZone
Market codebase. Same Supabase project and connection code — new tables so
nothing from SwapZone is touched or removed.

## What's new vs SwapZone Market

- General items instead of just phones — flexible categories, stock counts
- Cart (localStorage, works without login) → Checkout → Paystack **or** WhatsApp
- Customer Login / Sign Up (Supabase Auth) + My Orders page
- Admin panel: Products tab (unchanged workflow, now with Edit) + new **Orders** tab

## 1. Database setup

1. Open your Supabase project → **SQL Editor** → New query.
2. Open `setup.sql`, replace every `YOUR_ADMIN_EMAIL` with your real admin
   email address, then run it. This creates `luc_products` and `luc_orders`
   only — it does not touch the old `products` table.
3. Go to **Storage** → New bucket → name it exactly `luc-product-images` →
   turn **Public bucket** ON → Save. (The storage policies at the bottom of
   `setup.sql` already assume this bucket name.)
4. Go to **Authentication → Users** → Add user → create your admin account
   with the same email you put in `setup.sql`.

## 2. App configuration

Open `supabase-config.js` and set:

```js
window.LUC_ADMIN_EMAIL = "your-admin-email@example.com";       // must match setup.sql
window.LUC_WHATSAPP_NUMBER = "233241234567";                    // no + or spaces
window.LUC_PAYSTACK_PUBLIC_KEY = "pk_test_xxxxxxxxxxxxxxxxxxxx"; // Paystack PUBLIC key only
```

Get the Paystack public key from your Paystack Dashboard → Settings → API
Keys & Webhooks. Never put the **secret** key in this file — it's exposed
to every visitor's browser.

## 3. Pages

| File | Purpose |
|---|---|
| `index.html` | Storefront — search, category chips, product modal, add to cart |
| `cart.html` | Cart with quantity controls, order total |
| `checkout.html` | Requires login. Delivery form, Paystack or WhatsApp checkout |
| `login.html` | Customer login / sign up |
| `orders.html` | Customer's own order history |
| `admin.html` | Admin login → Products tab (CRUD) + Orders tab (status updates) |

## 4. How checkout works

- **Paystack**: opens the Paystack inline popup for the cart total (GHS →
  pesewas conversion is automatic). On success, an order is saved with
  `payment_status = 'paid'`.
- **WhatsApp**: opens `wa.me` with a prefilled order message (items, total,
  delivery details) to `LUC_WHATSAPP_NUMBER`. An order is saved with
  `payment_status = 'pending'` for you to confirm manually once payment is
  received.

Every order's `order_status` (processing → confirmed → shipped → delivered
→ cancelled) is managed from the admin Orders tab.

## 5. Deploying

This is still a static site — no build command needed — but it now also
ships two **Netlify Functions** (small backend endpoints) for Paystack
verification. Netlify detects `netlify.toml` automatically and deploys
them alongside the site; nothing extra to configure in the Netlify UI
beyond the environment variables below.

> If your GitHub repo has these files at the repo root, you're done. If
> they live in a subfolder, open `netlify.toml` and change `publish = "."`
> to `publish = "your-subfolder-name"`.

## 6. Paystack live payments (server-verified)

Paystack success is no longer trusted straight from the browser — it's a
common way demo sites get spoofed fake "successful" orders. The flow now
is:

1. Checkout creates the order as `pending` first, using the **order's own
   id** as the Paystack reference.
2. When the Paystack popup reports success, the browser calls
   `/api/verify-paystack` (a Netlify Function), which re-checks the
   transaction directly with Paystack using your **secret** key, confirms
   the amount matches, and only then marks the order `paid`.
3. `/api/paystack-webhook` is a backup: register it in your Paystack
   dashboard so if a customer closes the tab right after paying (before
   step 2 finishes), Paystack still notifies your backend directly.

**Setup:**

1. **Netlify → Site configuration → Environment variables**, add:
   | Key | Value |
   |---|---|
   | `PAYSTACK_SECRET_KEY` | From Paystack Dashboard → Settings → API Keys & Webhooks. Use `sk_test_...` while testing, switch to `sk_live_...` when you go live. **Secret — never put this in `supabase-config.js` or any file the browser loads.** |
   | `SUPABASE_URL` | Same value as in `supabase-config.js`. |
   | `SUPABASE_ANON_KEY` | Same value as in `supabase-config.js` (used to validate the customer's session token). |
   | `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → `service_role` key. **Secret** — this bypasses Row Level Security, so it must only ever live in Netlify env vars, never in client code. |
2. Redeploy the site (env var changes need a new deploy to take effect).
3. **Paystack Dashboard → Settings → API Keys & Webhooks → Webhook URL**:
   set it to `https://YOUR-SITE.netlify.app/api/paystack-webhook`.
4. Test with a `sk_test_...` key and Paystack's test cards first. Once
   confirmed working, swap `PAYSTACK_SECRET_KEY` for the live key and
   `LUC_PAYSTACK_PUBLIC_KEY` in `supabase-config.js` for the live public
   key, then redeploy.

## 7. Confirming MoMo / WhatsApp payments manually

Orders placed via WhatsApp checkout are saved as `payment_status: pending`
since payment happens outside the app. In the admin dashboard's **Orders**
tab, any pending order now shows a **Mark as Paid** button — click it once
you've confirmed the MoMo transfer (or any other manual payment) yourself.
This is a manual, trust-based action (protected only by the same admin RLS
policy as everything else in the dashboard), so only give admin access to
people you trust to confirm payments honestly.

## 8. Security notes

- Admin access is enforced by **Row Level Security** matching your admin
  email — the client-side check in `admin.js` is just a UX nicety, not the
  real gate.
- If you add more admins later, you'll need to update the RLS policies in
  `setup.sql` (e.g. check against a list, or a `luc_admins` table) instead
  of a single hardcoded email.
- **Run `harden-orders-rls.sql`** (Supabase SQL Editor) if you haven't
  already — it closes a gap where the original insert policy let a
  customer insert an order with `payment_status: 'paid'` directly,
  bypassing checkout entirely. Every new order must now start as
  `pending` / `processing`; only the Netlify functions (service role key)
  or the admin dashboard (matching admin email) can move it to `paid`.
- Paystack payments are verified server-side (section 6), tied to the
  logged-in customer's own session, and idempotent (re-confirming an
  already-paid order is a no-op) — this closes the main ways someone
  could fake or double-credit a "successful" order.
- The **Mark as Paid** button for MoMo/WhatsApp orders is still a manual,
  honor-system confirmation — there's no automated verification for
  transfers made outside the app.
- **Rate limiting**: Netlify Functions don't rate-limit by default.
  `verify-paystack` now requires a valid logged-in session, which rules
  out anonymous spam, but a compromised/scripted account could still
  hammer the endpoint. For real protection against abuse (brute force,
  scraping, bot signups) at scale, put the site behind Cloudflare (free
  tier) for rate limiting/WAF, or use a paid rate-limiting service like
  Upstash Redis in front of the functions. This wasn't added here to keep
  the stack dependency-free — say the word if you want it wired in.
- No stock is reserved or decremented at checkout — two customers could
  both order the last unit of something before you notice. Fine for low
  volume with manual fulfillment; worth fixing with a database function
  if order volume grows.
