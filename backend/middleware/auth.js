// ─── JWT Authentication Middleware ────────────────────────────────────────────
// Verifies a JWT Bearer token signed with JWT_SECRET.
// On success: attaches req.user = { id, email, name } to the request.
// On failure: returns 401 Unauthorized.
// ─────────────────────────────────────────────────────────────────────────────

const jwt = require('jsonwebtoken');

async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Unauthorised',
        message: 'Missing or malformed Authorization header. Expected: Bearer <token>',
      });
    }

    const token = authHeader.slice(7).trim();

    if (!token) {
      return res.status(401).json({ error: 'Unauthorised', message: 'Bearer token is empty' });
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET);

    // Attach minimal user object — all routes use req.user.id to scope queries
    req.user = { id: payload.sub, email: payload.email, name: payload.name };

    return next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Unauthorised', message: 'Token has expired' });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Unauthorised', message: 'Invalid token' });
    }
    console.error('[requireAuth] Unexpected error:', err.message);
    return res.status(500).json({ error: 'Internal Server Error', message: 'Authentication check failed' });
  }
}

module.exports = { requireAuth };
