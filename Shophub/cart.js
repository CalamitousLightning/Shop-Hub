/* =========================================================
   Shop Hub Marketplace — cart.js
   A tiny localStorage-backed cart shared by every page.
   Cart shape: [{ id, name, price, image_url, qty, stock }]
   ========================================================= */

const Shop Hub_CART_KEY = "Shop Hub_cart";

function Shop HubGetCart() {
  try {
    return JSON.parse(localStorage.getItem(Shop Hub_CART_KEY)) || [];
  } catch {
    return [];
  }
}

function Shop HubSaveCart(cart) {
  localStorage.setItem(Shop Hub_CART_KEY, JSON.stringify(cart));
  Shop HubUpdateCartBadge();
}

function Shop HubAddToCart(product, qty = 1) {
  const cart = Shop HubGetCart();
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
  Shop HubSaveCart(cart);
}

function Shop HubUpdateQty(id, qty) {
  let cart = Shop HubGetCart();
  cart = cart
    .map((item) => (item.id === id ? { ...item, qty: Math.max(0, qty) } : item))
    .filter((item) => item.qty > 0);
  Shop HubSaveCart(cart);
}

function Shop HubRemoveFromCart(id) {
  const cart = Shop HubGetCart().filter((item) => item.id !== id);
  Shop HubSaveCart(cart);
}

function Shop HubClearCart() {
  localStorage.removeItem(Shop Hub_CART_KEY);
  Shop HubUpdateCartBadge();
}

function Shop HubCartCount() {
  return Shop HubGetCart().reduce((sum, item) => sum + item.qty, 0);
}

function Shop HubCartTotal() {
  return Shop HubGetCart().reduce((sum, item) => sum + item.qty * item.price, 0);
}

/** Updates the little red badge on the cart icon in the header, on every page. */
function Shop HubUpdateCartBadge() {
  document.querySelectorAll(".cart-badge").forEach((badge) => {
    const count = Shop HubCartCount();
    badge.textContent = count;
    badge.hidden = count === 0;
  });
}

document.addEventListener("DOMContentLoaded", Shop HubUpdateCartBadge);
