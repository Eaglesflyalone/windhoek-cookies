const { createClient } = require('@libsql/client');

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// Helper to execute SQL (async)
async function exec(sql, args = []) {
  return await db.execute({ sql, args });
}

async function initDB() {
  await exec(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      price REAL NOT NULL,
      cost REAL NOT NULL DEFAULT 0,
      emoji TEXT DEFAULT '🍪',
      active INTEGER NOT NULL DEFAULT 1
    );
  `);
  
  await exec(`
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      order_type TEXT NOT NULL DEFAULT 'Delivery',
      address TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      items_json TEXT NOT NULL,
      subtotal REAL NOT NULL,
      total REAL NOT NULL,
      cost_total REAL NOT NULL DEFAULT 0,
      profit REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending',
      paid_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  // Seed products if empty
  const countRes = await exec('SELECT COUNT(*) as c FROM products');
  if (countRes.rows[0].c === 0) {
    const rows = [
      ['Classic Chocolate Chip', 'Buttery dough loaded with rich chocolate chips', 25, 10, '🍪'],
      ['Marula Nut Cookie', 'Local Namibian marula flavour with crunchy nuts', 30, 13, '🥜'],
      ['Double Chocolate', "Chocolate lovers' dream — double the cocoa", 28, 12, '🍫'],
      ['Oatmeal Raisin', 'Chewy oats with sweet raisins', 22, 9, '🌾'],
      ['Peanut Butter', 'Creamy peanut butter in every bite', 26, 11, '🥜'],
      ['Sugar Cookie', 'Simple, sweet, and perfectly crisp', 20, 7, '🧁'],
    ];
    for (const r of rows) {
      await exec(
        'INSERT INTO products (name, description, price, cost, emoji) VALUES (?, ?, ?, ?, ?)',
        r
      );
    }
  }
}

// Initialize tables
initDB().catch(console.error);

module.exports = { exec };