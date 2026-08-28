# ShopHub Marketplace

A ready-to-run online store: customers browse products, add to cart, pay
with Paystack or order over WhatsApp, and can log in to track their orders.
You get an admin panel to manage products and orders. It's a static
site (plain HTML/CSS/JS) with Supabase as the backend, so there's nothing
to compile and nothing weird to install.

**What you get:**
- A storefront with categories, search, and a product detail popup
- A cart that works even before someone logs in
- Checkout with either Paystack (card/mobile money) or a "send us your
  order on WhatsApp" option
- Customer accounts (sign up, log in, see past orders)
- An admin dashboard to add/edit/delete products and manage order status

Give it about 15-20 minutes to set up the first time. After that it's
just editing products from the admin panel.

## Before you start

You'll need two free accounts if you don't already have them:
- [supabase.com](https://supabase.com) — this is your database and login
  system
- [paystack.com](https://paystack.com) — this is what takes payments (you
  can skip this and just use WhatsApp checkout if you want, but you'll
  probably want it eventually)

You'll also need somewhere to host the site. [Netlify](https://netlify.com)
is the easiest option and it's what these instructions assume — drag the
folder in, or connect a GitHub repo, and you're live.

## Step 1: Set up your database

1. Log into Supabase, create a new project (pick any name/region, doesn't
   matter), and wait a minute or two for it to spin up.
2. Open the **SQL Editor** on the left sidebar, click **New query**.
3. Open the `setup.sql` file from this package, find and replace every
   `YOUR_ADMIN_EMAIL` with the email address you want to log into the
   admin panel with. Paste the whole thing into the SQL editor and hit
   **Run**. This creates the two tables the store needs (`shophub_products`
   and `shophub_orders`) plus the permissions around them.
4. Still in Supabase, go to **Storage** in the sidebar → **New bucket**.
   Name it exactly `shophub-product-images` (lowercase, with the dashes —
   the code expects this exact name) and turn on **Public bucket**, then
   save.
5. Go to **Authentication → Users** → **Add user**, and create your admin
   login using the same email you used in step 3. Set whatever password
   you want to log in with.

That's the database side done — you won't need to touch it again unless
you're adding more admin accounts later.

## Step 2: Point the site at your Supabase project

Open `supabase-config.js` in a text editor and fill in these two lines
with your project's own details (Supabase dashboard → **Project Settings
→ API**):

```js
window.SUPABASE_URL = "https://xxxxxxxxxxxx.supabase.co";
window.SUPABASE_ANON_KEY = "your-anon-public-key";
```

Then a bit further down in the same file, set your admin email, your
WhatsApp number, and your Paystack public key:

```js
window.SHOPHUB_ADMIN_EMAIL = "your-admin-email@example.com";       // same email as step 3 above
window.SHOPHUB_WHATSAPP_NUMBER = "233241234567";                    // no + and no spaces
window.SHOPHUB_PAYSTACK_PUBLIC_KEY = "pk_test_xxxxxxxxxxxxxxxxxxxx"; // starts with pk_, from Paystack
```

Grab the Paystack key from your Paystack dashboard under **Settings → API
Keys & Webhooks**. Only ever put the **public** key here — never the
secret one, since this file gets sent straight to anyone visiting your
site.

If you want to sell in a different currency, that's a one-line change in
`config.js`:

```js
window.SHOPHUB_CONFIG = {
  currency: "GHS",
  symbol: "₵",
  paystack_currency: "GHS",
};
```

Change `symbol` and the two `currency` fields and every price on the site
updates — product cards, cart, checkout, order history, admin, all of it.

## Step 3: Put it online

This is a plain static site, so deploying it is just "upload the folder."
Easiest way with Netlify:

1. Either drag the whole project folder into Netlify's dashboard, or push
   it to a GitHub repo and connect that repo in Netlify.
2. Netlify will pick up `netlify.toml` automatically — you don't need to
   set a build command, there isn't one.
3. If everything in this folder ends up at the root of your repo, you're
   done. If it's sitting in a subfolder instead, open `netlify.toml` and
   change `publish = "."` to `publish = "your-subfolder-name"`.

Your store is now live. Try adding a test product from the admin panel
(`/admin.html`) and make sure it shows up on the homepage.

## Turning on Paystack properly (server-verified payments)

The card popup alone isn't enough to trust — anyone could fake a
"successful" payment message in their browser without actually paying.
So this template double-checks every payment on the server before
marking an order as paid:

1. Checkout saves the order as `pending` first, using the order's own ID
   as the Paystack reference.
2. When Paystack reports success, the browser calls a small serverless
   function (`/api/verify-paystack`) which asks Paystack directly, using
   your *secret* key, whether that payment really went through and for
   the right amount. Only then does it mark the order paid.
3. There's a second function, `/api/paystack-webhook`, as a backup — if
   someone closes the tab right after paying (before step 2 finishes),
   Paystack pings this instead so the order still gets marked paid.

To wire this up:

1. In Netlify, go to **Site configuration → Environment variables** and
   add:
   - `PAYSTACK_SECRET_KEY` — from Paystack, starts with `sk_test_` while
     you're testing, `sk_live_` once you're live. Keep this one secret,
     it never goes in any file that loads in the browser.
   - `SUPABASE_URL` — same value you put in `supabase-config.js`.
   - `SUPABASE_ANON_KEY` — same value you put in `supabase-config.js`.
   - `SUPABASE_SERVICE_ROLE_KEY` — from Supabase, **Project Settings →
     API → service_role key**. This one bypasses all your security rules,
     so it's Netlify-env-var-only, never in the code.
2. Redeploy the site — env var changes only take effect on the next
   deploy.
3. In Paystack, go to **Settings → API Keys & Webhooks → Webhook URL**
   and set it to `https://your-site.netlify.app/api/paystack-webhook`.
4. Test with Paystack's test cards and your `sk_test_` key first. Once
   you're happy it works, swap in the live secret key on Netlify and the
   live public key in `supabase-config.js`, then redeploy one more time.

## The pages, quickly

| File | What it's for |
|---|---|
| `index.html` | The storefront — search, categories, product popup, add to cart |
| `cart.html` | Cart page, quantity +/-, running total |
| `checkout.html` | Delivery details, then pay with Paystack or WhatsApp (login required) |
| `login.html` | Customer login and sign up |
| `orders.html` | A customer's own order history |
| `admin.html` | Your dashboard — products (add/edit/delete) and orders (update status) |

## Handling orders day to day

- **Paystack orders** get marked `paid` automatically once payment is
  confirmed server-side — you don't have to do anything.
- **WhatsApp orders** come in as `pending`. The customer sends you their
  order details on WhatsApp, you sort out payment with them however you
  normally do (MoMo, cash on delivery, whatever), then go to the admin
  Orders tab and hit **Mark as Paid** once you've actually received the
  money. This one's on the honor system — there's no way to automatically
  verify a MoMo transfer, so only give admin access to people you trust.
- Every order also has a status you move along as you fulfill it:
  processing → confirmed → shipped → delivered (or cancelled). That's
  all done from the same Orders tab.

## A few things worth knowing before you go live

- Your admin login is protected at the database level (Row Level
  Security), not just by a check in the JavaScript — so even if someone
  is clever with the browser console, they still can't get into products
  or orders they shouldn't. The check in `admin.js` is just there to show
  the right screen, it's not the actual security.
- There's a second SQL file, `harden-orders-rls.sql` — run this once in
  the Supabase SQL Editor after `setup.sql`. It closes a small gap where,
  without it, someone could theoretically insert an order marked as
  already paid without going through checkout. Worth the thirty seconds.
- Nothing decrements stock automatically when someone checks out. For a
  small shop doing manual fulfillment that's rarely an issue, but if two
  people order the very last unit of something at the same time, you'll
  need to sort that out by hand. Fine for most stores starting out.
- If you want more than one admin account later, you'll need to update
  the policies in `setup.sql` — right now it checks against a single
  hardcoded email.
- Netlify's serverless functions don't rate-limit by default. The
  verify-payment function does require a logged-in session, so random
  bots can't hit it, but a determined attacker with a real account
  technically still could. If you're doing serious volume, worth putting
  Cloudflare in front of the site (free tier is fine) for extra
  protection — not something you need on day one.
