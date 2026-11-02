function initCheckout() {
  const form     = document.getElementById('checkout-form');
  const modal    = document.getElementById('checkout-modal');
  const openBtn  = document.getElementById('checkout-btn');
  const closeBtn = document.getElementById('close-checkout');

  if (!form) return;

  openBtn.addEventListener('click', () => {
    if (getCart().length === 0) {
      alert('Your cart is empty 🍪 — add a cookie first!');
      return;
    }
    modal.classList.add('show');
  });

  closeBtn.addEventListener('click', () => modal.classList.remove('show'));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const data = new FormData(form);
    const cart = getCart();
    if (cart.length === 0) { alert('Cart is empty.'); return; }

    const payload = {
      name:      data.get('name').trim(),
      phone:     data.get('phone').trim(),
      orderType: data.get('orderType'),
      address:   (data.get('address') || '').trim(),
      notes:     (data.get('notes')   || '').trim(),
      items:     cart.map(i => ({ id: i.id, qty: i.qty })),
    };

    const submitBtn = form.querySelector('button[type="submit"]');
    const origText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving order…';

    try {
      const res = await fetch('/api/orders', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Could not save order.');

      const message = buildWhatsAppMessage({
        ...payload,
        orderId: result.order.id,
        cart:    result.order.items,
        total:   result.order.total,
      });

      const url = `https://wa.me/${CONFIG.whatsappNumber}?text=${encodeURIComponent(message)}`;

      saveCart([]);
      renderCart();
      modal.classList.remove('show');
      closeCart();
      window.open(url, '_blank');

      setTimeout(() => {
        alert(
          `Order ${result.order.id} saved!\n\n` +
          `You'll be redirected to WhatsApp to complete payment.\n` +
          `Your order is CONFIRMED only after we receive payment.`
        );
      }, 300);
    } catch (err) {
      alert('❌ ' + err.message);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = origText;
    }
  });
}

function buildWhatsAppMessage({ name, phone, orderType, address, notes, cart, orderId, total }) {
  const lines = [];
  lines.push(`🍪 *New Order ${orderId} — ${CONFIG.shopName}*`);
  lines.push('');
  lines.push(`*Name:* ${name}`);
  lines.push(`*Phone:* ${phone}`);
  lines.push(`*Order type:* ${orderType}`);
  if (orderType === 'Delivery' && address) lines.push(`*Address:* ${address}`);
  lines.push('');
  lines.push('*Order details:*');
  cart.forEach((item) => {
    lines.push(`• ${item.qty}× ${item.name} — ${CONFIG.currency}${(item.price * item.qty).toFixed(2)}`);
  });
  lines.push('');
  lines.push(`*TOTAL: ${CONFIG.currency}${total.toFixed(2)}*`);
  if (notes) { lines.push(''); lines.push(`*Notes:* ${notes}`); }
  lines.push('');
  lines.push('Please send payment details so I can pay and finalize this order. 🙏');
  return lines.join('\n');
}