/* =========================================================
   LUC Marketplace — admin.js
   Runs on admin.html:
     - Email/password login (Supabase Auth), restricted to
       window.LUC_ADMIN_EMAIL (real enforcement is via RLS,
       see setup.sql — this check just improves the UI).
     - Add / edit / delete products in luc_products.
     - Orders tab: list every order in luc_orders and update
       its order_status.
   ========================================================= */

const supabaseClient = supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);

const loginSection = document.getElementById("loginSection");
const dashboardSection = document.getElementById("dashboardSection");
const loginForm = document.getElementById("loginForm");
const loginError = document.getElementById("loginError");
const logoutBtn = document.getElementById("logoutBtn");

function escapeHtml(str) {
  if (!str) return "";
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/* =========================================================
   AUTH
   ========================================================= */

async function checkSession() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  const isAdmin = !!session && session.user.email?.toLowerCase() === window.LUC_ADMIN_EMAIL.toLowerCase();

  if (session && !isAdmin) {
    // Logged in, but not the admin account — sign out immediately.
    await supabaseClient.auth.signOut();
  }

  toggleView(isAdmin);
  if (isAdmin) {
    loadProductsTable();
    loadOrdersTable();
  }
}

function toggleView(isLoggedIn) {
  loginSection.hidden = isLoggedIn;
  dashboardSection.hidden = !isLoggedIn;
  logoutBtn.hidden = !isLoggedIn;
}

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginError.hidden = true;

  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;

  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

  if (error) {
    loginError.textContent = error.message;
    loginError.hidden = false;
    return;
  }

  if (data.user.email?.toLowerCase() !== window.LUC_ADMIN_EMAIL.toLowerCase()) {
    await supabaseClient.auth.signOut();
    loginError.textContent = "This account is not authorized as admin.";
    loginError.hidden = false;
    return;
  }

  toggleView(true);
  loadProductsTable();
  loadOrdersTable();
});

logoutBtn.addEventListener("click", async () => {
  await supabaseClient.auth.signOut();
  toggleView(false);
});

/* =========================================================
   TAB SWITCHING
   ========================================================= */

document.querySelectorAll(".admin-tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".admin-tab-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    const tab = btn.dataset.tab;
    document.getElementById("productsTab").hidden = tab !== "products";
    document.getElementById("ordersTab").hidden = tab !== "orders";
    if (tab === "orders") loadOrdersTable();
  });
});

/* =========================================================
   PRODUCTS: add / edit / list / delete
   ========================================================= */

const productForm = document.getElementById("productForm");
const addProductBtn = document.getElementById("addProductBtn");
const cancelEditBtn = document.getElementById("cancelEditBtn");
const productMsg = document.getElementById("productMsg");
const productFormTitle = document.getElementById("productFormTitle");
const editingProductId = document.getElementById("editingProductId");
const currentImageHint = document.getElementById("currentImageHint");

const tableBody = document.getElementById("productsTableBody");
const tableLoading = document.getElementById("tableLoading");

function showMsg(el, text, type) {
  el.textContent = text;
  el.className = `form-msg ${type}`;
  el.hidden = false;
}

productForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  productMsg.hidden = true;
  addProductBtn.disabled = true;
  addProductBtn.textContent = editingProductId.value ? "Saving..." : "Adding...";

  try {
    const fileInput = document.getElementById("productImage");
    const file = fileInput.files[0];
    const name = document.getElementById("productName").value.trim();
    const description = document.getElementById("productDescription").value.trim();
    const category = document.getElementById("productCategory").value.trim();
    const price = parseFloat(document.getElementById("productPrice").value);
    const stock = parseInt(document.getElementById("productStock").value, 10);

    const payload = { name, description, category, price, stock };

    // Only upload a new image if one was chosen.
    if (file) {
      const fileExt = file.name.split(".").pop();
      const filePath = `${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;

      const { error: uploadError } = await supabaseClient.storage
        .from("luc-product-images")
        .upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabaseClient.storage
        .from("luc-product-images")
        .getPublicUrl(filePath);

      payload.image_url = publicUrlData.publicUrl;
    } else if (!editingProductId.value) {
      throw new Error("Please choose a product image.");
    }

    if (editingProductId.value) {
      const { error: updateError } = await supabaseClient
        .from("luc_products")
        .update(payload)
        .eq("id", editingProductId.value);
      if (updateError) throw updateError;
      showMsg(productMsg, "Product updated successfully.", "success");
    } else {
      const { error: insertError } = await supabaseClient.from("luc_products").insert([payload]);
      if (insertError) throw insertError;
      showMsg(productMsg, "Product added successfully.", "success");
    }

    resetProductForm();
    loadProductsTable();
  } catch (err) {
    console.error(err);
    showMsg(productMsg, err.message || "Something went wrong.", "error");
  } finally {
    addProductBtn.disabled = false;
    addProductBtn.textContent = editingProductId.value ? "Save Changes" : "Add Product";
  }
});

function resetProductForm() {
  productForm.reset();
  editingProductId.value = "";
  productFormTitle.textContent = "Add New Product";
  addProductBtn.textContent = "Add Product";
  cancelEditBtn.hidden = true;
  currentImageHint.textContent = "";
  document.getElementById("productImage").required = true;
}

cancelEditBtn.addEventListener("click", resetProductForm);

async function loadProductsTable() {
  tableLoading.hidden = false;
  tableBody.innerHTML = "";

  const { data, error } = await supabaseClient
    .from("luc_products")
    .select("*")
    .order("created_at", { ascending: false });

  tableLoading.hidden = true;

  if (error) {
    console.error(error);
    tableBody.innerHTML = `<tr><td colspan="6">Failed to load products.</td></tr>`;
    return;
  }

  if (!data || data.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="6">No products yet.</td></tr>`;
    return;
  }

  tableBody.innerHTML = data.map(productRowHtml).join("");
  window.__lucProducts = data;
}

function productRowHtml(product) {
  return `
    <tr data-id="${product.id}">
      <td><img src="${product.image_url}" alt="${escapeHtml(product.name)}" /></td>
      <td>${escapeHtml(product.name)}</td>
      <td>${escapeHtml(product.category)}</td>
      <td>GHS ${Number(product.price).toFixed(2)}</td>
      <td>${product.stock}</td>
      <td>
        <button class="btn btn-outline btn-edit" data-id="${product.id}" style="margin-right:4px;">Edit</button>
        <button class="btn btn-danger btn-delete" data-id="${product.id}" data-image="${product.image_url}">Delete</button>
      </td>
    </tr>
  `;
}

tableBody.addEventListener("click", async (e) => {
  const id = e.target.dataset.id;
  if (!id) return;

  if (e.target.classList.contains("btn-edit")) {
    const product = (window.__lucProducts || []).find((p) => p.id === id);
    if (!product) return;

    editingProductId.value = product.id;
    document.getElementById("productName").value = product.name;
    document.getElementById("productDescription").value = product.description || "";
    document.getElementById("productCategory").value = product.category;
    document.getElementById("productPrice").value = product.price;
    document.getElementById("productStock").value = product.stock;
    document.getElementById("productImage").required = false;
    currentImageHint.textContent = "Leave image blank to keep the current photo.";

    productFormTitle.textContent = "Edit Product";
    addProductBtn.textContent = "Save Changes";
    cancelEditBtn.hidden = false;
    productForm.scrollIntoView({ behavior: "smooth" });
    return;
  }

  if (e.target.classList.contains("btn-delete")) {
    if (!confirm("Delete this product? This cannot be undone.")) return;

    e.target.disabled = true;
    e.target.textContent = "Deleting...";

    const { error: deleteError } = await supabaseClient.from("luc_products").delete().eq("id", id);

    if (deleteError) {
      alert("Failed to delete product: " + deleteError.message);
      e.target.disabled = false;
      e.target.textContent = "Delete";
      return;
    }

    try {
      const imageUrl = e.target.dataset.image;
      const path = imageUrl.split("/luc-product-images/")[1];
      if (path) {
        await supabaseClient.storage.from("luc-product-images").remove([path]);
      }
    } catch (err) {
      console.warn("Could not remove storage file:", err);
    }

    loadProductsTable();
  }
});

/* =========================================================
   ORDERS: list all + update status
   ========================================================= */

const ordersTableBody = document.getElementById("ordersTableBody");
const ordersTableLoading = document.getElementById("ordersTableLoading");
const ORDER_STATUSES = ["processing", "confirmed", "shipped", "delivered", "cancelled"];

async function loadOrdersTable() {
  ordersTableLoading.hidden = false;
  ordersTableBody.innerHTML = "";

  const { data, error } = await supabaseClient
    .from("luc_orders")
    .select("*")
    .order("created_at", { ascending: false });

  ordersTableLoading.hidden = true;

  if (error) {
    console.error(error);
    ordersTableBody.innerHTML = `<tr><td colspan="7">Failed to load orders.</td></tr>`;
    return;
  }

  if (!data || data.length === 0) {
    ordersTableBody.innerHTML = `<tr><td colspan="7">No orders yet.</td></tr>`;
    return;
  }

  ordersTableBody.innerHTML = data.map(orderRowHtml).join("");
}

function orderRowHtml(order) {
  const items = order.items || [];
  const itemsText = items.map((i) => `${i.qty}x ${i.name}`).join(", ");

  const statusOptions = ORDER_STATUSES.map(
    (s) => `<option value="${s}" ${s === order.order_status ? "selected" : ""}>${s}</option>`
  ).join("");

  return `
    <tr data-id="${order.id}">
      <td>#${order.id.slice(0, 8).toUpperCase()}</td>
      <td>${escapeHtml(order.customer_name)}<br><span class="hint">${escapeHtml(order.customer_phone)}</span></td>
      <td class="order-items-cell">${escapeHtml(itemsText)}</td>
      <td>GHS ${Number(order.total).toFixed(2)}</td>
      <td><span class="status-pill status-${order.payment_status}">${escapeHtml(order.payment_status)}</span><br><span class="hint">${escapeHtml(order.payment_method)}</span></td>
      <td>
        ${
          order.payment_status === "pending"
            ? `<button class="btn btn-outline btn-mark-paid" data-id="${order.id}">Mark as Paid</button>`
            : `<span class="hint">—</span>`
        }
      </td>
      <td>
        <select class="order-status-select" data-id="${order.id}">
          ${statusOptions}
        </select>
      </td>
    </tr>
  `;
}

ordersTableBody.addEventListener("change", async (e) => {
  if (!e.target.classList.contains("order-status-select")) return;

  const id = e.target.dataset.id;
  const newStatus = e.target.value;

  const { error } = await supabaseClient
    .from("luc_orders")
    .update({ order_status: newStatus })
    .eq("id", id);

  if (error) {
    alert("Failed to update order status: " + error.message);
  }
});

ordersTableBody.addEventListener("click", async (e) => {
  if (!e.target.classList.contains("btn-mark-paid")) return;

  const id = e.target.dataset.id;
  if (!confirm("Mark this order as paid? Only do this once you've confirmed the transfer (e.g. MoMo) yourself.")) {
    return;
  }

  e.target.disabled = true;
  e.target.textContent = "Saving...";

  const { error } = await supabaseClient
    .from("luc_orders")
    .update({ payment_status: "paid" })
    .eq("id", id);

  if (error) {
    alert("Failed to update payment status: " + error.message);
    e.target.disabled = false;
    e.target.textContent = "Mark as Paid";
    return;
  }

  loadOrdersTable();
});

/* =========================================================
   Kick things off
   ========================================================= */
checkSession();
