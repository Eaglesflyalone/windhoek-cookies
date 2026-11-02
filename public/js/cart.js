const CART_KEY = 'windhoek_cookies_cart';

function getCart() {
  try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; }
  catch { return []; }
}

function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
}

function addToCart(productId) {
  const product = PRODUCTS.find(p => p.id === productId);
  if (!product) return;

  const cart = getCart();
  const existing = cart.find(i => i.id === productId);

  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({ id: productId, name: product.name, price: product.price, qty: 1 });
  }

  saveCart(cart);
  renderCart();
  openCart();
}

function updateQty(productId, delta) {
  const cart = getCart();
  const item = cart.find(i => i.id === productId);
  if (!item) return;

  item.qty += delta;
  if (item.qty <= 0) {
    cart.splice(cart.indexOf(item), 1);
  }

  saveCart(cart);
  renderCart();
}

function removeItem(productId) {
  saveCart(getCart().filter(i => i.id !== productId));
  renderCart();
}

function getCartTotal() {
  return getCart().reduce((sum, i) => sum + i.price * i.qty, 0);
}

function getCartCount() {
  return getCart().reduce((sum, i) => sum + i.qty, 0);
}

function renderCart() {
  const container = document.getElementById('cart-items');
  const countEl   = document.getElementById('cart-count');
  const totalEl   = document.getElementById('cart-total');
  if (!container) return;

  const cart = getCart();
  countEl.textContent = getCartCount();
  totalEl.textContent = getCartTotal().toFixed(2);

  if (cart.length === 0) {
    container.innerHTML = '<p class="cart-empty">Your cart is empty 🍪</p>';
    return;
  }

  container.innerHTML = cart.map(item => `
    <div class="cart-item">
      <div class="cart-item-info">
        <div class="cart-item-name">${item.name}</div>
        <div class="cart-item-price">N$ ${item.price.toFixed(2)}</div>
      </div>
      <div class="qty-controls">
        <button class="qty-btn" onclick="updateQty(${item.id}, -1)">−</button>
        <span>${item.qty}</span>
        <button class="qty-btn" onclick="updateQty(${item.id}, 1)">+</button>
      </div>
      <button class="remove-btn" onclick="removeItem(${item.id})">×</button>
    </div>
  `).join('');
}

function openCart() {
  document.getElementById('cart-panel').classList.add('open');
  document.getElementById('overlay').classList.add('show');
}

function closeCart() {
  document.getElementById('cart-panel').classList.remove('open');
  document.getElementById('overlay').classList.remove('show');
}