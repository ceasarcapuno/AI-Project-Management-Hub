// ─── Redis client (publisher) ─────────────────────────────────────────────────
// Single shared publisher instance.  SSE route creates its own subscriber
// connection per client (required by Redis pub/sub protocol).
// ─────────────────────────────────────────────────────────────────────────────

const Redis = require('ioredis');

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

redis.on('error', (err) => {
  console.error('[redis] Connection error:', err.message);
});

module.exports = redis;
