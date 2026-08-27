/* =========================================================
   LUC Marketplace — app.js (index.html)
   Fetches luc_products, renders the grid, handles category
   chips, search, the product detail modal, and add-to-cart.
   ========================================================= */

const supabaseClient = supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);

let allProducts = [];
let activeCategory = "all";
let activeSearch = "";
let selectedProduct = null;
let selectedQty = 1;

const grid = document.getElementById("products-grid");
const loadingEl = document.getElementById("products-loading");
const emptyEl = document.getElementById("products-empty");
const categoryBar = document.getElementById("categoryBar");
const sectionTitle = document.getElementById("sectionTitle");

function escapeHtml(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderCard(product) {
  const imageUrl = product.image_url || "https://placehold.co/300x300?text=No+Image";
  const price = Number(product.price || 0).toFixed(2);
  const outOfStock = Number(product.stock ?? 0) <= 0;

  return `
    <div class="product-card" data-id="${product.id}">
      <div class="product-img-wrap">
        <img class="product-img" src="${imageUrl}" alt="${escapeHtml(product.name)}" loading="lazy" />
        ${outOfStock ? '<span class="stock-flag">Out of Stock</span>' : ""}
      </div>
      <div class="product-body">
        <h3>${escapeHtml(product.name)}</h3>
        <span class="badge">${escapeHtml(product.category)}</span>
        <div class="price-row">
          <span class="price-currency">GHS</span>
          <span class="price">${price}</span>
        </div>
        <button class="btn btn-add" data-id="${product.id}" ${outOfStock ? "disabled" : ""}>
          ${outOfStock ? "Unavailable" : "Add to Cart"}
        </button>
      </div>
    </div>
  `;
}

function renderCategoryChips() {
  const categories = ["all", ...new Set(allProducts.map((p) => p.category).filter(Boolean))];
  categoryBar.innerHTML = categories
    .map(
      (cat) => `
      <button class="chip ${cat === activeCategory ? "active" : ""}" data-category="${escapeHtml(cat)}">
        ${cat === "all" ? "All" : escapeHtml(cat)}
      </button>`
    )
    .join("");
}

function applyFilters() {
  let filtered = allProducts;
  if (activeCategory !== "all") {
    filtered = filtered.filter((p) => p.category === activeCategory);
  }
  if (activeSearch.trim()) {
    const q = activeSearch.trim().toLowerCase();
    filtered = filtered.filter(
      (p) => p.name.toLowerCase().includes(q) || (p.description || "").toLowerCase().includes(q)
    );
  }
  renderGrid(filtered);
}

function renderGrid(products) {
  sectionTitle.textContent = activeCategory === "all" ? "All Products" : activeCategory;
  if (!products || products.length === 0) {
    grid.innerHTML = "";
    emptyEl.hidden = false;
    return;
  }
  emptyEl.hidden = true;
  grid.innerHTML = products.map(renderCard).join("");
}

async function loadProducts() {
  loadingEl.hidden = false;
  emptyEl.hidden = true;
  grid.innerHTML = "";

  const { data, error } = await supabaseClient
    .from("luc_products")
    .select("*")
    .order("created_at", { ascending: false });

  loadingEl.hidden = true;

  if (error) {
    console.error("Error loading products:", error);
    emptyEl.hidden = false;
    emptyEl.textContent = "Something went wrong loading products. Please try again later.";
    return;
  }

  allProducts = data || [];
  renderCategoryChips();
  applyFilters();
}

/* ===== Realtime: new/updated/deleted products show up instantly ===== */
supabaseClient
  .channel("luc-products-realtime")
  .on("postgres_changes", { event: "*", schema: "public", table: "luc_products" }, () => {
    loadProducts();
  })
  .subscribe();

/* ===== Category chip clicks ===== */
categoryBar.addEventListener("click", (e) => {
  const btn = e.target.closest(".chip");
  if (!btn) return;
  activeCategory = btn.dataset.category;
  renderCategoryChips();
  applyFilters();
});

/* ===== Search (mobile + desktop bars stay in sync) ===== */
const searchMobile = document.getElementById("searchInputMobile");
const searchDesktop = document.getElementById("searchInputDesktop");

function onSearchInput(value) {
  activeSearch = value;
  searchMobile.value = value;
  searchDesktop.value = value;
  applyFilters();
}
searchMobile.addEventListener("input", (e) => onSearchInput(e.target.value));
searchDesktop.addEventListener("input", (e) => onSearchInput(e.target.value));

/* ===== Mobile nav toggle ===== */
document.getElementById("navToggle").addEventListener("click", () => {
  document.getElementById("mainNav").classList.toggle("open");
});

/* ===== Product detail modal ===== */
const modal = document.getElementById("productModal");
const modalImg = document.getElementById("modalImg");
const modalName = document.getElementById("modalName");
const modalCategory = document.getElementById("modalCategory");
const modalDesc = document.getElementById("modalDesc");
const modalPrice = document.getElementById("modalPrice");
const modalStock = document.getElementById("modalStock");
const qtyValue = document.getElementById("qtyValue");
const modalAddBtn = document.getElementById("modalAddBtn");
const modalMsg = document.getElementById("modalMsg");

function openModal(product) {
  selectedProduct = product;
  selectedQty = 1;
  qtyValue.textContent = "1";
  modalMsg.hidden = true;

  modalImg.src = product.image_url || "https://placehold.co/400x400?text=No+Image";
  modalName.textContent = product.name;
  modalCategory.textContent = product.category;
  modalDesc.textContent = product.description || "No description provided.";
  modalPrice.textContent = Number(product.price || 0).toFixed(2);

  const stock = Number(product.stock ?? 0);
  if (stock <= 0) {
    modalStock.textContent = "Out of stock";
    modalAddBtn.disabled = true;
    modalAddBtn.textContent = "Unavailable";
  } else {
    modalStock.textContent = `${stock} in stock`;
    modalAddBtn.disabled = false;
    modalAddBtn.textContent = "Add to Cart";
  }

  modal.hidden = false;
}

grid.addEventListener("click", (e) => {
  const addBtn = e.target.closest(".btn-add");
  const card = e.target.closest(".product-card");
  if (!card) return;

  const product = allProducts.find((p) => p.id === card.dataset.id);
  if (!product) return;

  if (addBtn) {
    // Quick add straight from the card, no need to open the modal
    if (addBtn.disabled) return;
    lucAddToCart(product, 1);
    addBtn.textContent = "Added ✓";
    setTimeout(() => {
      addBtn.textContent = "Add to Cart";
    }, 900);
    return;
  }

  openModal(product);
});

document.getElementById("qtyMinus").addEventListener("click", () => {
  selectedQty = Math.max(1, selectedQty - 1);
  qtyValue.textContent = selectedQty;
});
document.getElementById("qtyPlus").addEventListener("click", () => {
  const stock = Number(selectedProduct?.stock ?? 999);
  selectedQty = Math.min(stock || 999, selectedQty + 1);
  qtyValue.textContent = selectedQty;
});

modalAddBtn.addEventListener("click", () => {
  if (!selectedProduct) return;
  lucAddToCart(selectedProduct, selectedQty);
  modalMsg.textContent = "Added to cart!";
  modalMsg.className = "form-msg success";
  modalMsg.hidden = false;
});

document.getElementById("modalClose").addEventListener("click", () => (modal.hidden = true));
modal.addEventListener("click", (e) => {
  if (e.target === modal) modal.hidden = true;
});

/* ===== Kick things off ===== */
loadProducts();
