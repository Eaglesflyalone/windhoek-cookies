const crypto = require('crypto');

const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'changeme123';

const SALT = crypto.randomBytes(16).toString('hex');
const PASS_HASH = crypto.scryptSync(ADMIN_PASS, SALT, 64).toString('hex');

function checkCredentials(user, pass) {
  if (user !== ADMIN_USER) return false;
  const candidate = crypto.scryptSync(pass, SALT, 64).toString('hex');
  return crypto.timingSafeEqual(
    Buffer.from(PASS_HASH, 'hex'),
    Buffer.from(candidate, 'hex')
  );
}

function requireAdmin(req, res, next) {
  if (req.session && req.session.admin) return next();
  res.status(401).json({ error: 'Unauthorized' });
}

module.exports = { checkCredentials, requireAdmin, ADMIN_USER };