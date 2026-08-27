/* =========================================================
   LUC Marketplace — netlify/functions/paystack-webhook.js

   Safety net for payments. If a customer closes the tab right
   after paying (before verify-paystack.js gets to run), Paystack
   still calls this webhook directly so the order gets marked paid.

   Setup:
     1. Deploy this file (it becomes:
        https://YOUR-SITE.netlify.app/.netlify/functions/paystack-webhook
        or https://YOUR-SITE.netlify.app/api/paystack-webhook if you
        keep the redirect in netlify.toml).
     2. Paystack Dashboard -> Settings -> API Keys & Webhooks ->
        Webhook URL -> paste that URL -> Save.
     3. Same environment variables as verify-paystack.js are required:
        PAYSTACK_SECRET_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
   ========================================================= */

const crypto = require("crypto");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const { PAYSTACK_SECRET_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!PAYSTACK_SECRET_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return { statusCode: 500, body: "Server is missing required environment variables" };
  }

  // Verify this request genuinely came from Paystack.
  const signature = event.headers["x-paystack-signature"] || event.headers["X-Paystack-Signature"];
  const expectedHash = crypto.createHmac("sha512", PAYSTACK_SECRET_KEY).update(event.body).digest("hex");

  if (!signature || signature !== expectedHash) {
    return { statusCode: 401, body: "Invalid signature" };
  }

  let payload;
  try {
    payload = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: "Invalid JSON" };
  }

  if (payload.event === "charge.success") {
    const reference = payload.data.reference; // this is the luc_orders.id, see checkout.js
    const amountPaid = payload.data.amount / 100;

    try {
      const orderRes = await fetch(
        `${SUPABASE_URL}/rest/v1/luc_orders?id=eq.${encodeURIComponent(reference)}&select=id,total,payment_status`,
        {
          headers: {
            apikey: SUPABASE_SERVICE_ROLE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
        }
      );
      const orders = await orderRes.json();
      const order = orders && orders[0];

      if (order && order.payment_status !== "paid" && Math.abs(amountPaid - Number(order.total)) < 0.01) {
        await fetch(`${SUPABASE_URL}/rest/v1/luc_orders?id=eq.${encodeURIComponent(reference)}`, {
          method: "PATCH",
          headers: {
            apikey: SUPABASE_SERVICE_ROLE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            "Content-Type": "application/json",
            Prefer: "return=minimal",
          },
          body: JSON.stringify({ payment_status: "paid", paystack_reference: reference }),
        });
      }
    } catch (err) {
      console.error("paystack-webhook error:", err);
      // Still return 200 so Paystack doesn't hammer retries over a transient
      // DB blip — verify-paystack.js on the client is the primary path anyway.
    }
  }

  return { statusCode: 200, body: "OK" };
};
