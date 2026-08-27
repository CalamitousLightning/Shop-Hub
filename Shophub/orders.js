/* =========================================================
   LUC Marketplace — orders.js
   Shows the logged-in customer's own orders from luc_orders.
   ========================================================= */

const supabaseClient = supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);

const loadingEl = document.getElementById("ordersLoading");
const notLoggedInEl = document.getElementById("notLoggedIn");
const emptyEl = document.getElementById("ordersEmpty");
const listEl = document.getElementById("ordersList");

function escapeHtml(str) {
  if (!str) return "";
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function formatDate(iso) {
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function renderOrder(order) {
  const items = order.items || [];
  const itemsSummary = items.map((i) => `${i.qty} x ${i.name}`).join(", ");

  return `
    <div class="order-card">
      <div class="order-card-head">
        <span class="order-id">Order #${order.id.slice(0, 8).toUpperCase()} — ${formatDate(order.created_at)}</span>
        <span class="status-pill status-${order.order_status}">${escapeHtml(order.order_status)}</span>
      </div>
      <p class="order-items-mini">${escapeHtml(itemsSummary)}</p>
      <div style="display:flex; justify-content:space-between; align-items:center; margin-top:6px;">
        <span class="order-total">GHS ${Number(order.total).toFixed(2)}</span>
        <span class="status-pill status-${order.payment_status}">${escapeHtml(order.payment_status)} · ${escapeHtml(order.payment_method)}</span>
      </div>
    </div>
  `;
}

async function loadOrders() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  loadingEl.hidden = true;

  if (!session) {
    notLoggedInEl.hidden = false;
    return;
  }

  const { data, error } = await supabaseClient
    .from("luc_orders")
    .select("*")
    .eq("user_id", session.user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    emptyEl.hidden = false;
    emptyEl.textContent = "Something went wrong loading your orders.";
    return;
  }

  if (!data || data.length === 0) {
    emptyEl.hidden = false;
    return;
  }

  listEl.innerHTML = data.map(renderOrder).join("");
}

loadOrders();
