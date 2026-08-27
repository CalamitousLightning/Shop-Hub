/* =========================================================
   LUC Marketplace — checkout.js
   Requires login. Reads the cart from localStorage, lets the
   shopper fill delivery details, then either:
     - Pays with Paystack (inline popup) and records the order, or
     - Sends a prefilled WhatsApp message and records the order
       with payment_status "pending" for manual confirmation.
   ========================================================= */

const supabaseClient = supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);

let currentUser = null;

const loadingEl = document.getElementById("checkoutLoading");
const contentEl = document.getElementById("checkoutContent");
const emptyEl = document.getElementById("checkoutEmpty");
const summaryItems = document.getElementById("summaryItems");
const checkoutTotal = document.getElementById("checkoutTotal");
const checkoutMsg = document.getElementById("checkoutMsg");

function escapeHtml(str) {
  if (!str) return "";
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function showMsg(text, type) {
  checkoutMsg.textContent = text;
  checkoutMsg.className = `form-msg ${type}`;
  checkoutMsg.hidden = false;
}

async function init() {
  const { data: { session } } = await supabaseClient.auth.getSession();

  if (!session) {
    window.location.href = "login.html?redirect=checkout";
    return;
  }
  currentUser = session.user;

  const cart = lucGetCart();
  loadingEl.hidden = true;

  if (cart.length === 0) {
    emptyEl.hidden = false;
    return;
  }

  // Prefill name/phone from signup metadata, if available
  document.getElementById("custName").value = currentUser.user_metadata?.full_name || "";
  document.getElementById("custPhone").value = currentUser.user_metadata?.phone || "";

  renderSummary(cart);
  contentEl.hidden = false;
}

function renderSummary(cart) {
  summaryItems.innerHTML = cart
    .map((item) => `<div>${item.qty} x ${escapeHtml(item.name)} — GHS ${(item.qty * item.price).toFixed(2)}</div>`)
    .join("");
  checkoutTotal.textContent = lucCartTotal().toFixed(2);
}

function getDeliveryDetails() {
  const name = document.getElementById("custName").value.trim();
  const phone = document.getElementById("custPhone").value.trim();
  const address = document.getElementById("custAddress").value.trim();
  if (!name || !phone || !address) {
    showMsg("Please fill in your name, phone number, and delivery address.", "error");
    return null;
  }
  return { name, phone, address };
}

/** Inserts the order row into luc_orders. Returns the created order, or null on failure. */
async function createOrder({ paymentMethod, paymentStatus, paystackReference = null }) {
  const cart = lucGetCart();
  const details = getDeliveryDetails();
  if (!details) return null;

  const items = cart.map((item) => ({
    product_id: item.id,
    name: item.name,
    price: item.price,
    qty: item.qty,
    image_url: item.image_url,
  }));

  const { data, error } = await supabaseClient
    .from("luc_orders")
    .insert([
      {
        user_id: currentUser.id,
        customer_name: details.name,
        customer_phone: details.phone,
        customer_email: currentUser.email,
        delivery_address: details.address,
        items: items,
        total: lucCartTotal(),
        payment_method: paymentMethod,
        payment_status: paymentStatus,
        paystack_reference: paystackReference,
        order_status: "processing",
      },
    ])
    .select()
    .single();

  if (error) {
    console.error(error);
    showMsg("Could not save your order: " + error.message, "error");
    return null;
  }
  return data;
}

/* ===== Paystack =====
   Flow: create the order first as "pending" -> open Paystack using the
   order's own id as the reference -> on success, ask our Netlify function
   to verify the transaction server-side (with the secret key) before the
   order is ever marked paid. The client's "success" callback is NOT
   trusted on its own — see netlify/functions/verify-paystack.js. */
document.getElementById("paystackBtn").addEventListener("click", async () => {
  const details = getDeliveryDetails();
  if (!details) return;

  const total = lucCartTotal();
  if (total <= 0) {
    showMsg("Your cart total must be greater than zero.", "error");
    return;
  }

  const paystackBtn = document.getElementById("paystackBtn");
  paystackBtn.disabled = true;

  const order = await createOrder({ paymentMethod: "paystack", paymentStatus: "pending" });
  if (!order) {
    paystackBtn.disabled = false;
    return;
  }

  const handler = PaystackPop.setup({
    key: window.LUC_PAYSTACK_PUBLIC_KEY,
    email: currentUser.email,
    amount: Math.round(total * 100), // GHS to pesewas
    currency: "GHS",
    ref: order.id, // ties the Paystack transaction directly to this order
    callback: function (response) {
      showMsg("Confirming your payment...", "success");
      supabaseClient.auth.getSession().then(({ data: { session } }) => {
        fetch("/api/verify-paystack", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ reference: response.reference }),
        })
          .then((res) => res.json())
          .then((result) => {
            if (result.success) {
              lucClearCart();
              window.location.href = "orders.html";
            } else {
              showMsg(
                "We received your payment but couldn't confirm it automatically. " +
                  "Your order is saved as pending — contact us if it isn't updated shortly.",
                "error"
              );
            }
          })
          .catch(() => {
            showMsg(
              "We received your payment but couldn't confirm it automatically. " +
                "Your order is saved as pending — contact us if it isn't updated shortly.",
              "error"
            );
          })
          .finally(() => {
            paystackBtn.disabled = false;
          });
      });
    },
    onClose: function () {
      showMsg("Payment window closed. Your order is saved as pending — you can retry from My Orders.", "error");
      paystackBtn.disabled = false;
    },
  });
  handler.openIframe();
});

/* ===== WhatsApp checkout ===== */
document.getElementById("whatsappBtn").addEventListener("click", async () => {
  const details = getDeliveryDetails();
  if (!details) return;

  const cart = lucGetCart();
  const lines = cart.map((item) => `• ${item.qty} x ${item.name} — GHS ${(item.qty * item.price).toFixed(2)}`);
  const message =
    `Hi LUC Marketplace! I'd like to place an order:\n\n` +
    lines.join("\n") +
    `\n\nTotal: GHS ${lucCartTotal().toFixed(2)}` +
    `\n\nName: ${details.name}` +
    `\nPhone: ${details.phone}` +
    `\nDelivery Address: ${details.address}`;

  const order = await createOrder({ paymentMethod: "whatsapp", paymentStatus: "pending" });
  if (!order) return;

  const waUrl = `https://wa.me/${window.LUC_WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
  window.open(waUrl, "_blank");

  lucClearCart();
  window.location.href = "orders.html";
});

init();
