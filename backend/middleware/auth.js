const jwt = require('jsonwebtoken');

// Retrieve the secret from environment variables
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('FATAL SECURITY ERROR: The JWT_SECRET environment variable is not defined in production.');
  }
  console.warn('[ECHO BYTES Warning] JWT_SECRET is not defined. Falling back to default development secret.');
}

const secret = JWT_SECRET || 'echobytes-development-default-secret-key-replace-in-prod';

function authMiddleware(req, res, next) {
  const token = req.cookies?.echoToken;

  if (!token) {
    return res.status(401).json({ error: 'Authentication required. Please log in.' });
  }

  try {
    const payload = jwt.verify(token, secret);
    req.user = payload; // { id, username, role }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Session expired. Please log in again.' });
  }
}

module.exports = { authMiddleware, JWT_SECRET: secret };
