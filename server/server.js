require('dotenv').config(); // Loads .env file for local testing

const express = require('express');
const cookieSession = require('cookie-session');
const path = require('path');
const { checkCredentials } = require('./auth');

const productRoutes = require('./routes/products');
const orderRoutes   = require('./routes/orders');
const adminRoutes   = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Stateless session for Vercel
app.use(cookieSession({
  name: 'session',
  keys: [process.env.SESSION_SECRET || 'cookie-shop-dev-secret-change-me'],
  maxAge: 8 * 60 * 60 * 1000, // 8 hours
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
}));

// Serve static frontend
app.use(express.static(path.join(__dirname, '..', 'public')));

// Auth
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Missing credentials.' });
  if (!checkCredentials(username, password)) {
    return res.status(401).json({ error: 'Invalid username or password.' });
  }
  req.session.admin = { username };
  res.json({ success: true, user: { username } });
});

app.post('/api/auth/logout', (req, res) => {
  req.session = null;
  res.json({ success: true });
});

app.get('/api/auth/me', (req, res) => {
  if (req.session?.admin) return res.json({ user: req.session.admin });
  res.status(401).json({ error: 'Not logged in.' });
});

// API
app.use('/api/products', productRoutes);
app.use('/api/orders',   orderRoutes);
app.use('/api/admin',    adminRoutes);

// Admin SPA
app.get('/admin',     (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'admin', 'index.html')));
app.get('/admin/*',   (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'admin', 'index.html')));

// Customer SPA fallback
app.use((req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

module.exports = app;

// Only listen locally (Vercel handles the serverless invocation)
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => console.log(`🍪 Server running locally at http://localhost:${PORT}`));
}