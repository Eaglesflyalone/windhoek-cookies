document.addEventListener('DOMContentLoaded', () => {
  // Render
  renderProducts();
  renderCart();

  // Wire up checkout
  initCheckout();

  // Cart open/close
  document.getElementById('cart-btn').addEventListener('click', openCart);
  document.getElementById('close-cart').addEventListener('click', closeCart);
  document.getElementById('overlay').addEventListener('click', closeCart);

  // Smooth scroll for nav links
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
      const target = document.querySelector(anchor.getAttribute('href'));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });
});