/*
  supabase-config.js
  ------------------
  Connect this file to YOUR OWN Supabase project (Project Settings -> API).
  window.SUPABASE_URL and window.SUPABASE_ANON_KEY are loaded globally
  before every other script on every page.

  IMPORTANT FOR RESALE/BUYERS: the values below are PLACEHOLDERS. You must
  create your own free Supabase project at https://supabase.com, then
  replace both values with your own Project URL and anon/publishable key
  before deploying. Never ship a real project's URL/key inside a template
  you're distributing — anyone who doesn't change it will be reading and
  writing into that same database.
*/

window.SUPABASE_URL = "YOUR_SUPABASE_PROJECT_URL"; // e.g. "https://xxxxxxxxxxxx.supabase.co"
window.SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY"; // Project Settings -> API -> anon/public key

/*
  ------------------------------------------------------------------
  ShopHub MARKETPLACE SETTINGS — edit these two values for your business
  ------------------------------------------------------------------
*/

// The email address that is allowed to log into admin.html.
// This MUST match the "YOUR_ADMIN_EMAIL" value you use in setup.sql.
window.SHOPHUB_ADMIN_EMAIL = "YOUR_ADMIN_EMAIL"; // TODO: replace with your real admin email (must match setup.sql exactly)

// WhatsApp number for "Checkout via WhatsApp" (international format, no + or spaces).
// Example: Ghana number 024 123 4567 -> "233241234567"
window.SHOPHUB_WHATSAPP_NUMBER = "233245955704";

// Paystack PUBLIC key (starts with pk_test_ or pk_live_). Never put the secret key here.
window.SHOPHUB_PAYSTACK_PUBLIC_KEY = "pk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";
