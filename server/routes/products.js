const express = require('express');
const { exec } = require('../db');
const { requireAdmin } = require('../auth');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { rows } = await exec('SELECT id, name, description, price, emoji FROM products WHERE active = 1 ORDER BY id');
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/admin', requireAdmin, async (req, res) => {
  try {
    const { rows } = await exec('SELECT * FROM products ORDER BY id');
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', requireAdmin, async (req, res) => {
  try {
    const { name, description = '', price, cost = 0, emoji = '🍪' } = req.body;
    if (!name || price == null) return res.status(400).json({ error: 'name and price required' });
    
    const result = await exec(
      'INSERT INTO products (name, description, price, cost, emoji) VALUES (?, ?, ?, ?, ?) RETURNING *',
      [name, description, Number(price), Number(cost), emoji]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/:id', requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const existing = (await exec('SELECT * FROM products WHERE id = ?', [id])).rows[0];
    if (!existing) return res.status(404).json({ error: 'Not found' });

    const fields = ['name', 'description', 'price', 'cost', 'emoji', 'active'];
    const updates = {};
    fields.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });
    if (Object.keys(updates).length === 0) return res.json(existing);

    const sets = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    const values = [...Object.values(updates), id];
    
    await exec(`UPDATE products SET ${sets} WHERE id = ?`, values);
    const updated = (await exec('SELECT * FROM products WHERE id = ?', [id])).rows[0];
    res.json(updated);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    await exec('UPDATE products SET active = 0 WHERE id = ?', [Number(req.params.id)]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;