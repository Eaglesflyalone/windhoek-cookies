const express = require('express');
const { exec } = require('../db');
const { requireAdmin } = require('../auth');
const router = express.Router();

function generateOrderId() {
  return 'ORD-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase();
}

router.post('/', async (req, res) => {
  try {
    const { name, phone, orderType = 'Delivery', address = '', notes = '', items } = req.body;
    if (!name || !phone) return res.status(400).json({ error: 'Name and phone are required.' });
    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'Cart is empty.' });

    let subtotal = 0, costTotal = 0;
    const lineItems = [];
    
    for (const raw of items) {
      const product = (await exec('SELECT id, name, price, cost, emoji FROM products WHERE id = ? AND active = 1', [Number(raw.id)])).rows[0];
      if (!product) return res.status(400).json({ error: `Product ${raw.id} not found.` });
      
      const qty = Math.max(1, parseInt(raw.qty, 10) || 1);
      subtotal += product.price * qty;
      costTotal += product.cost * qty;
      lineItems.push({ id: product.id, name: product.name, emoji: product.emoji, price: product.price, qty });
    }

    const total = subtotal;
    const profit = total - costTotal;
    const id = generateOrderId();
    const now = new Date().toISOString();

    await exec(`
      INSERT INTO orders (id, customer_name, customer_phone, order_type, address, notes,
        items_json, subtotal, total, cost_total, profit, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
    `, [id, name, phone, orderType, address, notes, JSON.stringify(lineItems), subtotal, total, costTotal, profit, now, now]);

    res.status(201).json({
      success: true,
      order: { id, name, phone, orderType, address, notes, items: lineItems, total, status: 'pending', createdAt: now }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save order.' });
  }
});

router.get('/', requireAdmin, async (req, res) => {
  try {
    const { status } = req.query;
    let result;
    if (status) {
      result = await exec('SELECT * FROM orders WHERE status = ? ORDER BY created_at DESC', [status]);
    } else {
      result = await exec('SELECT * FROM orders ORDER BY created_at DESC');
    }
    res.json(result.rows.map(r => ({ ...r, items: JSON.parse(r.items_json) })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/:id', requireAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ['pending', 'paid', 'delivered', 'cancelled'];
    if (!allowed.includes(status)) return res.status(400).json({ error: 'Invalid status.' });

    const id = req.params.id;
    const existing = (await exec('SELECT * FROM orders WHERE id = ?', [id])).rows[0];
    if (!existing) return res.status(404).json({ error: 'Not found.' });

    const now = new Date().toISOString();
    const paidAt = (status === 'paid' || status === 'delivered') ? (existing.paid_at || now) : existing.paid_at;

    await exec('UPDATE orders SET status = ?, paid_at = ?, updated_at = ? WHERE id = ?', [status, paidAt, now, id]);
    
    const updated = (await exec('SELECT * FROM orders WHERE id = ?', [id])).rows[0];
    res.json(updated);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;