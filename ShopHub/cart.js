/* =========================================================
   ShopHub Marketplace — cart.js
   A tiny localStorage-backed cart shared by every page.
   Cart shape: [{ id, name, price, image_url, qty, stock }]
   ========================================================= */

const SHOPHUB_CART_KEY = "shophub_cart";

function ShopHubGetCart() {
  try {
    return JSON.parse(localStorage.getItem(SHOPHUB_CART_KEY)) || [];
  } catch {
    return [];
  }
}

function ShopHubSaveCart(cart) {
  localStorage.setItem(SHOPHUB_CART_KEY, JSON.stringify(cart));
  ShopHubUpdateCartBadge();
}

function ShopHubAddToCart(product, qty = 1) {
  const cart = ShopHubGetCart();
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
  ShopHubSaveCart(cart);
}

function ShopHubUpdateQty(id, qty) {
  let cart = ShopHubGetCart();
  cart = cart
    .map((item) => (item.id === id ? { ...item, qty: Math.max(0, qty) } : item))
    .filter((item) => item.qty > 0);
  ShopHubSaveCart(cart);
}

function ShopHubRemoveFromCart(id) {
  const cart = ShopHubGetCart().filter((item) => item.id !== id);
  ShopHubSaveCart(cart);
}

function ShopHubClearCart() {
  localStorage.removeItem(SHOPHUB_CART_KEY);
  ShopHubUpdateCartBadge();
}

function ShopHubCartCount() {
  return ShopHubGetCart().reduce((sum, item) => sum + item.qty, 0);
}

function ShopHubCartTotal() {
  return ShopHubGetCart().reduce((sum, item) => sum + item.qty * item.price, 0);
}

/** Updates the little red badge on the cart icon in the header, on every page. */
function ShopHubUpdateCartBadge() {
  document.querySelectorAll(".cart-badge").forEach((badge) => {
    const count = ShopHubCartCount();
    badge.textContent = count;
    badge.hidden = count === 0;
  });
}

document.addEventListener("DOMContentLoaded", ShopHubUpdateCartBadge);
