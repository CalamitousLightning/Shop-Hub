/* =========================================================
   LUC Marketplace — cart.js
   A tiny localStorage-backed cart shared by every page.
   Cart shape: [{ id, name, price, image_url, qty, stock }]
   ========================================================= */

const LUC_CART_KEY = "luc_cart";

function lucGetCart() {
  try {
    return JSON.parse(localStorage.getItem(LUC_CART_KEY)) || [];
  } catch {
    return [];
  }
}

function lucSaveCart(cart) {
  localStorage.setItem(LUC_CART_KEY, JSON.stringify(cart));
  lucUpdateCartBadge();
}

function lucAddToCart(product, qty = 1) {
  const cart = lucGetCart();
  const existing = cart.find((item) => item.id === product.id);
  const stock = Number(product.stock ?? 999);

  if (existing) {
    existing.qty = Math.min(existing.qty + qty, stock || 999);
  } else {
    cart.push({
      id: product.id,
      name: product.name,
      price: Number(product.price),
      image_url: product.image_url,
      qty: Math.min(qty, stock || 999),
      stock: stock,
    });
  }
  lucSaveCart(cart);
}

function lucUpdateQty(id, qty) {
  let cart = lucGetCart();
  cart = cart
    .map((item) => (item.id === id ? { ...item, qty: Math.max(0, qty) } : item))
    .filter((item) => item.qty > 0);
  lucSaveCart(cart);
}

function lucRemoveFromCart(id) {
  const cart = lucGetCart().filter((item) => item.id !== id);
  lucSaveCart(cart);
}

function lucClearCart() {
  localStorage.removeItem(LUC_CART_KEY);
  lucUpdateCartBadge();
}

function lucCartCount() {
  return lucGetCart().reduce((sum, item) => sum + item.qty, 0);
}

function lucCartTotal() {
  return lucGetCart().reduce((sum, item) => sum + item.qty * item.price, 0);
}

/** Updates the little red badge on the cart icon in the header, on every page. */
function lucUpdateCartBadge() {
  document.querySelectorAll(".cart-badge").forEach((badge) => {
    const count = lucCartCount();
    badge.textContent = count;
    badge.hidden = count === 0;
  });
}

document.addEventListener("DOMContentLoaded", lucUpdateCartBadge);
