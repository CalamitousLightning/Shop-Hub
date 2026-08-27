/*
  supabase-config.js
  ------------------
  Same Supabase project as SwapZone Market — connection code is unchanged.
  window.SUPABASE_URL and window.SUPABASE_ANON_KEY are loaded globally
  before every other script on every page.
*/

window.SUPABASE_URL = "https://ttcavdmgylcxmzdijcsx.supabase.co";
window.SUPABASE_ANON_KEY = "sb_publishable_QWFfDsgSa4gGiMPKAO5EsQ_DLLa_D5y";

/*
  ------------------------------------------------------------------
  LUC MARKETPLACE SETTINGS — edit these two values for your business
  ------------------------------------------------------------------
*/

// The email address that is allowed to log into admin.html.
// This MUST match the "YOUR_ADMIN_EMAIL" value you use in setup.sql.
window.LUC_ADMIN_EMAIL = "logozorasare@gmail.com";

// WhatsApp number for "Checkout via WhatsApp" (international format, no + or spaces).
// Example: Ghana number 024 123 4567 -> "233241234567"
window.LUC_WHATSAPP_NUMBER = "233245955704";

// Paystack PUBLIC key (starts with pk_test_ or pk_live_). Never put the secret key here.
window.LUC_PAYSTACK_PUBLIC_KEY = "pk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";
