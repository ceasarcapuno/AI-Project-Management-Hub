// ─── Authentication Middleware ─────────────────────────────────────────────────
// Verifies Supabase JWT tokens sent in the Authorization header.
// On success: attaches req.user and req.token for use in route handlers.
// On failure: returns 401 Unauthorized.
//
// Usage in routes:
//   const { requireAuth } = require('../middleware/auth');
//   router.get('/protected', requireAuth, handler);
// ─────────────────────────────────────────────────────────────────────────────

const { supabaseAdmin } = require('../services/supabase');

/**
 * Express middleware that validates a Supabase JWT Bearer token.
 *
 * Flow:
 *   1. Extract the Bearer token from the Authorization header
 *   2. Call supabaseAdmin.auth.getUser(token) to verify it server-side
 *   3. If valid, attach req.user (Supabase user object) and req.token
 *   4. If invalid or missing, return 401
 *
 * @type {import('express').RequestHandler}
 */
async function requireAuth(req, res, next) {
  try {
    // Extract token from "Authorization: Bearer <token>" header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Unauthorised',
        message: 'Missing or malformed Authorization header. Expected: Bearer <token>',
      });
    }

    const token = authHeader.slice(7).trim(); // Remove "Bearer " prefix

    if (!token) {
      return res.status(401).json({
        error: 'Unauthorised',
        message: 'Bearer token is empty',
      });
    }

    // Verify the JWT with Supabase Auth (this validates signature and expiry)
    const { data, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !data?.user) {
      return res.status(401).json({
        error: 'Unauthorised',
        message: error?.message ?? 'Invalid or expired token',
      });
    }

    // Attach the verified user and raw token to the request for downstream use
    req.user = data.user;   // { id, email, user_metadata, app_metadata, ... }
    req.token = token;      // Raw JWT for creating user-scoped Supabase clients

    return next();
  } catch (err) {
    console.error('[requireAuth] Unexpected error:', err.message);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Authentication check failed unexpectedly',
    });
  }
}

module.exports = { requireAuth };
