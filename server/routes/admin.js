const express = require('express');
const { exec } = require('../db');
const { requireAdmin } = require('../auth');
const router = express.Router();

router.use(requireAdmin);

router.get('/stats', async (req, res) => {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const weekStart  = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const getSum = async (where, params = []) => {
      const r = await exec(`SELECT COALESCE(SUM(total), 0) AS revenue, COALESCE(SUM(profit), 0) AS profit, COUNT(*) AS count FROM orders WHERE ${where}`, params);
      return r.rows[0];
    };

    const paid = "status IN ('paid', 'delivered')";
    const all = await getSum(paid);
    const today = await getSum(`${paid} AND created_at >= ?`, [todayStart]);
    const week = await getSum(`${paid} AND created_at >= ?`, [weekStart]);
    const month = await getSum(`${paid} AND created_at >= ?`, [monthStart]);
    
    const pendingRes = await exec("SELECT COUNT(*) AS count, COALESCE(SUM(total), 0) AS revenue FROM orders WHERE status = 'pending'");
    const pending = pendingRes.rows[0];
    
    const totalOrdersRes = await exec('SELECT COUNT(*) AS c FROM orders');
    const totalOrders = totalOrdersRes.rows[0].c;

    res.json({
      revenue: { today: today.revenue, week: week.revenue, month: month.revenue, all: all.revenue },
      profit:  { today: today.profit,  week: week.profit,  month: month.profit,  all: all.profit },
      orders:  { today: today.count,   week: week.count,   month: month.count,   all: totalOrders },
      pending: { count: pending.count, revenue: pending.revenue },
      averageOrderValue: all.count > 0 ? all.revenue / all.count : 0,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/revenue-last-30-days', async (req, res) => {
  try {
    const result = await exec(`
      SELECT substr(created_at, 1, 10) AS day, SUM(total) AS revenue, SUM(profit) AS profit, COUNT(*) AS orders
      FROM orders WHERE status IN ('paid','delivered') AND created_at >= date('now', '-29 days')
      GROUP BY day ORDER BY day ASC
    `);

    const map = new Map(result.rows.map(r => [r.day, r]));
    const out = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() - i);
      const key = d.toISOString().slice(0, 10);
      const row = map.get(key);
      out.push({
        day: key,
        revenue: row ? row.revenue : 0,
        profit:  row ? row.profit  : 0,
        orders:  row ? row.orders  : 0,
      });
    }
    res.json(out);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/top-products', async (req, res) => {
  try {
    const result = await exec("SELECT items_json FROM orders WHERE status IN ('paid','delivered')");
    const agg = {};
    for (const o of result.rows) {
      for (const it of JSON.parse(o.items_json)) {
        if (!agg[it.id]) agg[it.id] = { id: it.id, name: it.name, emoji: it.emoji, qty: 0, revenue: 0 };
        agg[it.id].qty += it.qty;
        agg[it.id].revenue += it.price * it.qty;
      }
    }
    res.json(Object.values(agg).sort((a, b) => b.revenue - a.revenue).slice(0, 10));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/export', async (req, res) => {
  try {
    const result = await exec('SELECT * FROM orders ORDER BY created_at DESC');
    const orders = result.rows;
    
    const esc = (str) => {
      if (str === null || str === undefined) return '';
      const s = String(str);
      if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };

    const headers = ['Order ID', 'Date', 'Customer Name', 'Phone', 'Delivery/Pickup', 'Address', 'Items', 'Notes', 'Total (N$)', 'Profit (N$)', 'Status'];
    let csv = headers.join(',') + '\n';

    for (const o of orders) {
      const items = JSON.parse(o.items_json).map(i => `${i.qty}x ${i.name}`).join(' | ');
      const row = [
        esc(o.id), esc(new Date(o.created_at).toLocaleString('en-NA')), esc(o.customer_name), esc(o.customer_phone),
        esc(o.order_type), esc(o.address), esc(items), esc(o.notes), esc(o.total.toFixed(2)), esc(o.profit.toFixed(2)), esc(o.status.toUpperCase())
      ];
      csv += row.join(',') + '\n';
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="katrinas-cookies-sales.csv"');
    res.send(csv);
  } catch (err) { res.status(500).send('Error generating CSV'); }
});

module.exports = router;