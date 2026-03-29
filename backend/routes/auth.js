// ─── Auth Router ──────────────────────────────────────────────────────────────
// POST /api/auth/register — create account, return JWT
// POST /api/auth/login    — verify credentials, return JWT
// GET  /api/auth/me       — return current user (protected)
// ─────────────────────────────────────────────────────────────────────────────

const express = require('express');
const bcrypt  = require('bcrypt');
const jwt     = require('jsonwebtoken');
const pool    = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const BCRYPT_ROUNDS = 12;
const JWT_EXPIRY    = '7d';

function signToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );
}

// ─── POST /api/auth/register ──────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({ error: 'Valid email is required' });
    }
    if (!password || typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const password_hash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const { rows } = await pool.query(
      `INSERT INTO users (email, password_hash, name)
       VALUES ($1, $2, $3)
       RETURNING id, email, name, created_at`,
      [email.toLowerCase().trim(), password_hash, name?.trim() ?? null]
    );

    const user  = rows[0];
    const token = signToken(user);

    return res.status(201).json({ token, user: { id: user.id, email: user.email, name: user.name } });
  } catch (err) {
    if (err.code === '23505') { // unique_violation
      return res.status(409).json({ error: 'An account with that email already exists' });
    }
    console.error('[POST /auth/register]', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/auth/login ──────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const { rows } = await pool.query(
      'SELECT id, email, name, password_hash FROM users WHERE email = $1',
      [email.toLowerCase().trim()]
    );

    const user = rows[0];
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = signToken(user);

    return res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
  } catch (err) {
    console.error('[POST /auth/login]', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/auth/token ─────────────────────────────────────────────────────
// Generate a fresh JWT for the currently authenticated user (for API access)
router.post('/token', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, email, name FROM users WHERE id = $1',
      [req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'User not found' });
    const token = signToken(rows[0]);
    return res.json({ token, expires_in: '7d' });
  } catch (err) {
    console.error('[POST /auth/token]', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/auth/me ──────────────────────────────────────────────────────────
router.get('/me', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, email, name, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'User not found' });
    return res.json(rows[0]);
  } catch (err) {
    console.error('[GET /auth/me]', err.message);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
