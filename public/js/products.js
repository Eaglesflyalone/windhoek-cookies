// Product catalog (kept in sync with server/data/products.json)
const PRODUCTS = [
  { id: 1, name: 'Classic Chocolate Chip', price: 25, description: 'Buttery dough loaded with rich chocolate chips', emoji: '🍪' },
  { id: 2, name: 'Marula Nut Cookie',      price: 30, description: 'Local Namibian marula flavour with crunchy nuts', emoji: '🥜' },
  { id: 3, name: 'Double Chocolate',       price: 28, description: "Chocolate lovers' dream — double the cocoa",     emoji: '🍫' },
  { id: 4, name: 'Oatmeal Raisin',         price: 22, description: 'Chewy oats with sweet raisins',                  emoji: '🌾' },
  { id: 5, name: 'Peanut Butter',          price: 26, description: 'Creamy peanut butter in every bite',             emoji: '🥜' },
  { id: 6, name: 'Sugar Cookie',           price: 20, description: 'Simple, sweet, and perfectly crisp',             emoji: '🧁' },
];

function renderProducts() {
  const grid = document.getElementById('products-grid');
  if (!grid) return;

  grid.innerHTML = PRODUCTS.map(p => `
    <div class="product-card">
      <div class="product-emoji">${p.emoji}</div>
      <h3>${p.name}</h3>
      <p class="product-desc">${p.description}</p>
      <div class="product-price">N$ ${p.price.toFixed(2)}</div>
      <button class="btn btn-primary add-to-cart" data-id="${p.id}">Add to Cart</button>
    </div>
  `).join('');

  grid.querySelectorAll('.add-to-cart').forEach(btn => {
    btn.addEventListener('click', () => addToCart(Number(btn.dataset.id)));
  });
}