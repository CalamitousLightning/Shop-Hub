/* =========================================================
   LUC Marketplace — netlify/functions/verify-paystack.js

   Called by checkout.js right after the Paystack popup reports
   success. Re-verifies the transaction with Paystack's API using
   the SECRET key (never exposed to the browser), checks the paid
   amount against the order total, then marks the order as paid
   using the Supabase SERVICE ROLE key (bypasses RLS).

   Hardening notes:
     - "reference" IS the order id (checkout.js sets ref: order.id),
       so there's no separate orderId param to mix up — one value,
       one lookup, no room for a mismatched reference/order pairing.
     - Requires the caller's Supabase session token and checks it
       belongs to the order's own customer, so random/anonymous
       callers can't probe or spam this endpoint with guessed ids.
     - Refuses to re-mark an already-paid order (idempotent).

   Required Netlify environment variables (Site settings ->
   Environment variables):
     PAYSTACK_SECRET_KEY        sk_live_... or sk_test_...
     SUPABASE_URL                same value as in supabase-config.js
     SUPABASE_ANON_KEY           same value as in supabase-config.js
     SUPABASE_SERVICE_ROLE_KEY   Supabase -> Project Settings -> API
                                  -> service_role key (SECRET, never
                                  put this in any browser-facing file)
   ========================================================= */

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  let reference;
  try {
    ({ reference } = JSON.parse(event.body || "{}"));
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON body" }) };
  }

  if (!reference) {
    return { statusCode: 400, body: JSON.stringify({ error: "reference is required" }) };
  }

  const authHeader = event.headers.authorization || event.headers.Authorization;
  const accessToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!accessToken) {
    return { statusCode: 401, body: JSON.stringify({ error: "Missing session token" }) };
  }

  const { PAYSTACK_SECRET_KEY, SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!PAYSTACK_SECRET_KEY || !SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: "Server is missing required environment variables" }) };
  }

  try {
    // 1. Confirm the access token belongs to a real, currently-logged-in user.
    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${accessToken}` },
    });
    if (!userRes.ok) {
      return { statusCode: 401, body: JSON.stringify({ error: "Invalid or expired session" }) };
    }
    const user = await userRes.json();

    // 2. Load the order (id === reference by design) using the service role key.
    const orderRes = await fetch(
      `${SUPABASE_URL}/rest/v1/luc_orders?id=eq.${encodeURIComponent(reference)}&select=id,user_id,total,payment_method,payment_status`,
      {
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
      }
    );
    const orders = await orderRes.json();
    const order = orders && orders[0];

    if (!order) {
      return { statusCode: 404, body: JSON.stringify({ error: "Order not found" }) };
    }
    if (order.user_id !== user.id) {
      return { statusCode: 403, body: JSON.stringify({ error: "This order does not belong to you" }) };
    }
    if (order.payment_method !== "paystack") {
      return { statusCode: 400, body: JSON.stringify({ error: "Order is not a Paystack order" }) };
    }
    if (order.payment_status === "paid") {
      return { statusCode: 200, body: JSON.stringify({ success: true, alreadyPaid: true }) };
    }

    // 3. Ask Paystack directly whether this transaction really succeeded.
    const verifyRes = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      { headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` } }
    );
    const verifyJson = await verifyRes.json();

    if (!verifyRes.ok || !verifyJson.status || verifyJson.data?.status !== "success") {
      return { statusCode: 400, body: JSON.stringify({ error: "Payment could not be verified" }) };
    }

    const paidAmount = verifyJson.data.amount / 100; // pesewas -> GHS
    if (Math.abs(paidAmount - Number(order.total)) > 0.01) {
      return { statusCode: 400, body: JSON.stringify({ error: "Amount paid does not match order total" }) };
    }

    // 4. Mark the order paid (service role key bypasses RLS, so this is
    //    the ONLY place other than the admin dashboard that can do this).
    const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/luc_orders?id=eq.${encodeURIComponent(reference)}`, {
      method: "PATCH",
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ payment_status: "paid", paystack_reference: reference }),
    });

    if (!updateRes.ok) {
      return { statusCode: 500, body: JSON.stringify({ error: "Payment verified but failed to update order" }) };
    }

    return { statusCode: 200, body: JSON.stringify({ success: true }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
