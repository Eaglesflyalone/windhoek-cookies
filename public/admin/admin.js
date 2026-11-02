// ═══════════════════════════════════════════════════════════
// ADMIN DASHBOARD — Windhoek Cookies  (v7)
// ═══════════════════════════════════════════════════════════
console.log('[admin] admin.js v7 loaded at', new Date().toLocaleTimeString());

/* ─────────────────── API HELPER ─────────────────── */
const API = {
  async request(path, opts = {}) {
    console.log('[admin] →', opts.method || 'GET', path);
    const res = await fetch(path, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
      ...opts,
    });
    console.log('[admin] ←', res.status, path);
    if (res.status === 401) {
      const err = new Error('Unauthorized');
      err.status = 401;
      throw err;
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
    return data;
  },
  login:        (u, p) => API.request('/api/auth/login',  { method: 'POST', body: JSON.stringify({ username: u, password: p }) }),
  logout:       ()     => API.request('/api/auth/logout', { method: 'POST' }),
  me:           ()     => API.request('/api/auth/me'),
  stats:        ()     => API.request('/api/admin/stats'),
  revenue30:    ()     => API.request('/api/admin/revenue-last-30-days'),
  topProducts:  ()     => API.request('/api/admin/top-products'),
  orders:       (s)    => API.request('/api/orders' + (s ? `?status=${s}` : '')),
  updateOrder:  (id, s) => API.request(`/api/orders/${id}`, { method: 'PATCH', body: JSON.stringify({ status: s }) }),
  products:     ()     => API.request('/api/products/admin'),
  createProduct:(d)    => API.request('/api/products',   { method: 'POST',  body: JSON.stringify(d) }),
  updateProduct:(id, d)=> API.request(`/api/products/${id}`, { method: 'PATCH', body: JSON.stringify(d) }),
  deleteProduct:(id)   => API.request(`/api/products/${id}`, { method: 'DELETE' }),
};

const state = { ordersCache: [], productsCache: [] };

/* ─────────────────── SCREEN SWITCHING ─────────────────── */
function showLogin() {
  document.getElementById('login-screen').hidden = false;
  document.getElementById('dashboard-screen').hidden = true;
}
function showDashboard() {
  document.getElementById('login-screen').hidden = true;
  document.getElementById('dashboard-screen').hidden = false;
  loadOverview();
}

/* ─────────────────── LOGIN ─────────────────── */
document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  console.log('[admin] login form submitted');

  const errEl = document.getElementById('login-error');
  const btn   = document.getElementById('login-btn');
  const origText = btn.textContent;

  errEl.textContent = '';
  btn.disabled = true;
  btn.textContent = 'Signing in…';

  const data = new FormData(e.target);
  const username = (data.get('username') || '').trim();
  const password = (data.get('password') || '').trim();

  if (!username || !password) {
    errEl.textContent = 'Please enter username and password.';
    btn.disabled = false;
    btn.textContent = origText;
    return;
  }

  try {
    const result = await API.login(username, password);
    console.log('[admin] login success', result);
    showDashboard();
  } catch (err) {
    console.error('[admin] login failed:', err);
    errEl.textContent = err.status === 401
      ? '❌ Wrong username or password.'
      : '❌ ' + err.message;
    btn.disabled = false;
    btn.textContent = origText;
  }
});

/* ─────────────────── LOGOUT ─────────────────── */
document.getElementById('logout-btn').addEventListener('click', async () => {
  try { await API.logout(); } catch {}
  showLogin();
});

/* ─────────────────── TABS ─────────────────── */
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    const name = tab.dataset.tab;
    document.querySelector(`.tab-panel[data-panel="${name}"]`).classList.add('active');
    if (name === 'overview') loadOverview();
    if (name === 'orders')   loadOrders();
    if (name === 'products') loadProducts();
  });
});

/* ─────────────────── OVERVIEW ─────────────────── */
async function loadOverview() {
  try {
    const [stats, revenue, top] = await Promise.all([
      API.stats(), API.revenue30(), API.topProducts(),
    ]);

    document.getElementById('kpi-revenue-today').textContent = 'N$ ' + stats.revenue.today.toFixed(2);
    document.getElementById('kpi-profit-today').textContent  = 'Profit: N$ ' + stats.profit.today.toFixed(2);
    document.getElementById('kpi-revenue-month').textContent = 'N$ ' + stats.revenue.month.toFixed(2);
    document.getElementById('kpi-profit-month').textContent  = 'Profit: N$ ' + stats.profit.month.toFixed(2);
    document.getElementById('kpi-pending').textContent       = stats.pending.count + ' orders';
    document.getElementById('kpi-pending-value').textContent = 'N$ ' + stats.pending.revenue.toFixed(2) + ' outstanding';
    document.getElementById('kpi-aov').textContent           = 'N$ ' + stats.averageOrderValue.toFixed(2);
    document.getElementById('kpi-total-orders').textContent  = stats.orders.all + ' total orders';

    drawRevenueChart(revenue);
    renderTopProducts(top);
    renderCashflow(stats);
  } catch (err) {
    console.error('[admin] loadOverview failed:', err);
  }
}

/* Plain canvas chart */
function drawRevenueChart(data) {
  const canvas = document.getElementById('revenue-chart');
  if (!canvas) return;
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth;
  const h = 280;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  ctx.clearRect(0, 0, w, h);

  const pad = { top: 20, right: 20, bottom: 40, left: 60 };
  const chartW = w - pad.left - pad.right;
  const chartH = h - pad.top - pad.bottom;
  const max = Math.max(10, ...data.map(d => d.revenue));

  ctx.strokeStyle = '#e6dfd0';
  ctx.lineWidth = 1;
  ctx.font = '11px system-ui';
  ctx.fillStyle = '#707a6f';
  ctx.textAlign = 'right';
  for (let i = 0; i <= 4; i++) {
    const y = pad.top + (chartH / 4) * i;
    const val = max - (max / 4) * i;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(w - pad.right, y);
    ctx.stroke();
    ctx.fillText('N$' + val.toFixed(0), pad.left - 8, y + 4);
  }

  const barW = chartW / data.length;
  data.forEach((d, i) => {
    const barH = (d.revenue / max) * chartH;
    const x = pad.left + i * barW;
    const y = pad.top + chartH - barH;
    ctx.fillStyle = 'rgba(122,155,118,0.75)';
    ctx.fillRect(x + 1, y, Math.max(1, barW - 2), barH);
  });

  ctx.strokeStyle = '#c9c1b0';
  ctx.beginPath();
  ctx.moveTo(pad.left, pad.top + chartH);
  ctx.lineTo(w - pad.right, pad.top + chartH);
  ctx.stroke();

  ctx.fillStyle = '#707a6f';
  ctx.textAlign = 'center';
  [0, Math.floor(data.length / 2), data.length - 1].forEach(i => {
    if (data[i]) {
      const x = pad.left + i * barW + barW / 2;
      ctx.fillText(data[i].day.slice(5), x, h - pad.bottom + 20);
    }
  });

  if (data.every(d => d.revenue === 0)) {
    ctx.fillStyle = '#707a6f';
    ctx.textAlign = 'center';
    ctx.font = '14px system-ui';
    ctx.fillText('No revenue yet — mark orders as Paid to see it here.', w / 2, h / 2);
  }
}

function renderTopProducts(products) {
  const el = document.getElementById('top-products');
  if (products.length === 0) {
    el.innerHTML = '<p style="color:#707a6f">No paid orders yet.</p>';
    return;
  }
  el.innerHTML = products.map(p => `
    <div class="top-product-item">
      <span class="top-product-emoji">${p.emoji || '🍪'}</span>
      <div class="top-product-info">
        <div class="top-product-name">${p.name}</div>
        <div class="top-product-meta">${p.qty} sold</div>
      </div>
      <div class="top-product-revenue">N$ ${p.revenue.toFixed(2)}</div>
    </div>
  `).join('');
}

function renderCashflow(stats) {
  const collected = stats.revenue.all;
  const outstanding = stats.pending.revenue;
  const profit = stats.profit.all;
  document.getElementById('cashflow').innerHTML = `
    <div class="cashflow-row"><span class="label">Total collected</span><span class="value positive">N$ ${collected.toFixed(2)}</span></div>
    <div class="cashflow-row"><span class="label">Outstanding (pending)</span><span class="value warn">N$ ${outstanding.toFixed(2)}</span></div>
    <div class="cashflow-row"><span class="label">Total profit</span><span class="value positive">N$ ${profit.toFixed(2)}</span></div>
    <div class="cashflow-row"><span class="label">Potential (if all paid)</span><span class="value">N$ ${(collected + outstanding).toFixed(2)}</span></div>
  `;
}

/* ─────────────────── ORDERS ─────────────────── */
document.getElementById('refresh-orders').addEventListener('click', loadOrders);
document.getElementById('order-status-filter').addEventListener('change', loadOrders);

document.getElementById('export-csv-btn').addEventListener('click', () => {
  window.location.href = '/api/admin/export';
});

async function loadOrders() {
  const status = document.getElementById('order-status-filter').value;
  try {
    const orders = await API.orders(status);
    state.ordersCache = orders;
    renderOrders(orders);
  } catch (err) {
    console.error('[admin] loadOrders failed:', err);
  }
}

function renderOrders(orders) {
  const el = document.getElementById('orders-table');
  if (orders.length === 0) {
    el.innerHTML = '<p style="color:#707a6f;text-align:center;padding:20px">No orders yet.</p>';
    return;
  }
  el.innerHTML = `
    <table class="admin-table">
      <thead><tr>
        <th>Order</th><th>Customer</th><th>Total</th><th>Profit</th><th>Status</th><th>Date</th><th></th>
      </tr></thead>
      <tbody>
        ${orders.map(o => `
          <tr>
            <td><strong>${o.id}</strong></td>
            <td>${o.customer_name}<br><span style="color:#707a6f;font-size:.8rem">${o.customer_phone}</span></td>
            <td>N$ ${o.total.toFixed(2)}</td>
            <td>N$ ${o.profit.toFixed(2)}</td>
            <td><span class="badge ${o.status}">${o.status}</span></td>
            <td style="font-size:.85rem;color:#707a6f">${new Date(o.created_at).toLocaleString()}</td>
            <td><button class="btn-sm" onclick="openOrder('${o.id}')">View</button></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

window.openOrder = function(id) {
  const order = state.ordersCache.find(o => o.id === id);
  if (!order) return;
  document.getElementById('order-modal-body').innerHTML = `
    <h3>Order ${order.id}</h3>
    <dl class="order-detail-grid">
      <dt>Customer</dt><dd>${order.customer_name}</dd>
      <dt>Phone</dt><dd>${order.customer_phone}</dd>
      <dt>Type</dt><dd>${order.order_type}</dd>
      ${order.order_type === 'Delivery' ? `<dt>Address</dt><dd>${order.address || '—'}</dd>` : ''}
      <dt>Notes</dt><dd>${order.notes || '—'}</dd>
      <dt>Created</dt><dd>${new Date(order.created_at).toLocaleString()}</dd>
      <dt>Status</dt><dd><span class="badge ${order.status}">${order.status}</span></dd>
    </dl>
    <div class="order-items-list">
      ${order.items.map(i => `<div>${i.qty}× ${i.emoji || ''} ${i.name} — N$ ${(i.price * i.qty).toFixed(2)}</div>`).join('')}
      <div class="order-total-row"><span>Total</span><span>N$ ${order.total.toFixed(2)}</span></div>
      <div style="text-align:right;color:#4a7c59;font-size:.85rem;margin-top:6px">Profit: N$ ${order.profit.toFixed(2)}</div>
    </div>
    <div class="order-actions">
      ${order.status === 'pending' ? `<button class="btn-sm primary" onclick="setStatus('${order.id}','paid')">✓ Mark as Paid</button>` : ''}
      ${order.status === 'paid'    ? `<button class="btn-sm primary" onclick="setStatus('${order.id}','delivered')">✓ Mark Delivered</button>` : ''}
      ${!['cancelled','delivered'].includes(order.status) ? `<button class="btn-sm danger" onclick="setStatus('${order.id}','cancelled')">Cancel</button>` : ''}
      ${order.status !== 'pending' ? `<button class="btn-sm" onclick="setStatus('${order.id}','pending')">Reset to Pending</button>` : ''}
    </div>
  `;
  document.getElementById('order-modal').classList.add('show');
};

window.setStatus = async function(id, status) {
  try {
    await API.updateOrder(id, status);
    document.getElementById('order-modal').classList.remove('show');
    loadOrders();
    loadOverview();
  } catch (err) {
    alert(err.message);
  }
};

/* ─────────────────── PRODUCTS ─────────────────── */
document.getElementById('add-product-btn').addEventListener('click', () => openProductModal());

async function loadProducts() {
  try {
    const products = await API.products();
    state.productsCache = products;
    renderProducts(products);
  } catch (err) {
    console.error('[admin] loadProducts failed:', err);
  }
}

function renderProducts(products) {
  const el = document.getElementById('products-table');
  if (products.length === 0) {
    el.innerHTML = '<p style="color:#707a6f;text-align:center;padding:20px">No products.</p>';
    return;
  }
  el.innerHTML = `
    <table class="admin-table">
      <thead><tr>
        <th></th><th>Name</th><th>Sell</th><th>Cost</th><th>Margin</th><th>Active</th><th></th>
      </tr></thead>
      <tbody>
        ${products.map(p => `
          <tr>
            <td style="font-size:1.5rem">${p.emoji || '🍪'}</td>
            <td><strong>${p.name}</strong><br><span style="color:#707a6f;font-size:.8rem">${p.description || ''}</span></td>
            <td>N$ ${p.price.toFixed(2)}</td>
            <td>N$ ${p.cost.toFixed(2)}</td>
            <td style="color:#4a7c59;font-weight:600">N$ ${(p.price - p.cost).toFixed(2)}</td>
            <td>${p.active ? '✓' : '—'}</td>
            <td class="actions">
              <button class="btn-sm" onclick="editProduct(${p.id})">Edit</button>
              ${p.active ? `<button class="btn-sm danger" onclick="deleteProduct(${p.id})">Delete</button>` : ''}
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

window.editProduct = (id) => {
  const p = state.productsCache.find(x => x.id === id);
  if (p) openProductModal(p);
};

window.deleteProduct = async (id) => {
  if (!confirm('Deactivate this product? Existing orders are unaffected.')) return;
  try { await API.deleteProduct(id); loadProducts(); }
  catch (err) { alert(err.message); }
};

function openProductModal(product) {
  const form = document.getElementById('product-form');
  form.reset();
  document.getElementById('product-modal-title').textContent = product ? 'Edit Product' : 'New Product';
  if (product) {
    form.id.value          = product.id;
    form.name.value        = product.name;
    form.description.value = product.description || '';
    form.price.value       = product.price;
    form.cost.value        = product.cost;
    form.emoji.value       = product.emoji || '';
  } else {
    form.id.value    = '';
    form.emoji.value = '🍪';
  }
  document.getElementById('product-modal').classList.add('show');
}

document.getElementById('product-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const data = {
    name:        form.name.value.trim(),
    description: form.description.value.trim(),
    price:       Number(form.price.value),
    cost:        Number(form.cost.value),
    emoji:       form.emoji.value.trim() || '🍪',
  };
  try {
    if (form.id.value) await API.updateProduct(form.id.value, data);
    else               await API.createProduct(data);
    document.getElementById('product-modal').classList.remove('show');
    loadProducts();
  } catch (err) {
    alert(err.message);
  }
});

/* ─────────────────── MODAL CLOSE ─────────────────── */
document.querySelectorAll('[data-close]').forEach(el => {
  el.addEventListener('click', () => {
    document.getElementById(el.dataset.close).classList.remove('show');
  });
});
document.querySelectorAll('.modal').forEach(m => {
  m.addEventListener('click', (e) => { if (e.target === m) m.classList.remove('show'); });
});

/* ─────────────────── BOOT ─────────────────── */
(async function init() {
  console.log('[admin] init — checking session');
  try {
    await API.me();
    console.log('[admin] ✓ session valid → showing dashboard');
    showDashboard();
  } catch {
    console.log('[admin] no session → showing login');
    showLogin();
  }
})();