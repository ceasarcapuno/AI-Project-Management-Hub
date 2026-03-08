// ─── Notifications Router ─────────────────────────────────────────────────────
// Provides CRUD operations for user notifications.
// Supabase Realtime is enabled on the notifications table (see schema.sql),
// so the frontend can subscribe directly for live updates.
//
// Mounted at: /api/notifications
// ─────────────────────────────────────────────────────────────────────────────

const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { getSupabaseForUser } = require('../services/supabase');

const router = express.Router();

// Apply auth middleware to all routes in this file
router.use(requireAuth);

// ─── GET /api/notifications ───────────────────────────────────────────────────
// List all notifications for the authenticated user.
// Returns most recent first (descending created_at).
// Optional query: ?unread_only=true to filter to unread notifications only.
router.get('/', async (req, res) => {
  try {
    const supabase = getSupabaseForUser(req.token);
    const { unread_only } = req.query;

    let query = supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100); // Reasonable page size

    if (unread_only === 'true') {
      query = query.eq('is_read', false);
    }

    const { data, error } = await query;
    if (error) throw error;

    return res.json(data);
  } catch (err) {
    console.error('[GET /notifications]', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/notifications ──────────────────────────────────────────────────
// Create a new notification for the authenticated user.
// Body: { project_id?, category, level, title, message, actions?, metadata? }
router.post('/', async (req, res) => {
  try {
    const supabase = getSupabaseForUser(req.token);
    const {
      project_id,
      category = 'system',
      level = 'info',
      title,
      message,
      actions = [],
      metadata = {},
    } = req.body;

    if (!title || typeof title !== 'string' || title.trim() === '') {
      return res.status(400).json({ error: 'Notification title is required' });
    }
    if (!message || typeof message !== 'string' || message.trim() === '') {
      return res.status(400).json({ error: 'Notification message is required' });
    }

    const validCategories = ['milestone', 'agent', 'task', 'output', 'cost', 'deadline', 'system', 'collaboration'];
    const validLevels = ['info', 'warning', 'error', 'success'];

    if (!validCategories.includes(category)) {
      return res.status(400).json({ error: `category must be one of: ${validCategories.join(', ')}` });
    }
    if (!validLevels.includes(level)) {
      return res.status(400).json({ error: `level must be one of: ${validLevels.join(', ')}` });
    }

    const { data, error } = await supabase
      .from('notifications')
      .insert({
        user_id: req.user.id,
        project_id: project_id ?? null,
        category,
        level,
        title: title.trim(),
        message: message.trim(),
        is_read: false,
        actions: Array.isArray(actions) ? actions : [],
        metadata: typeof metadata === 'object' ? metadata : {},
      })
      .select()
      .single();

    if (error) throw error;

    return res.status(201).json(data);
  } catch (err) {
    console.error('[POST /notifications]', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ─── PATCH /api/notifications/mark-all-read ───────────────────────────────────
// Mark ALL unread notifications for the user as read.
// This route must be defined BEFORE /:id to avoid "mark-all-read" being
// interpreted as an ID parameter.
router.patch('/mark-all-read', async (req, res) => {
  try {
    const supabase = getSupabaseForUser(req.token);

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('is_read', false); // RLS ensures this only affects the user's own rows

    if (error) throw error;

    return res.json({ success: true, message: 'All notifications marked as read' });
  } catch (err) {
    console.error('[PATCH /notifications/mark-all-read]', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ─── PATCH /api/notifications/:id ────────────────────────────────────────────
// Update a single notification (typically to mark as read).
// Body: { is_read?: boolean, title?: string, message?: string }
router.patch('/:id', async (req, res) => {
  try {
    const supabase = getSupabaseForUser(req.token);
    const { id } = req.params;
    const { is_read, title, message } = req.body;

    const updates = {};
    if (is_read !== undefined) updates.is_read = Boolean(is_read);
    if (title !== undefined) updates.title = title.trim();
    if (message !== undefined) updates.message = message.trim();

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No fields provided for update' });
    }

    const { data, error } = await supabase
      .from('notifications')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Notification not found or access denied' });

    return res.json(data);
  } catch (err) {
    console.error('[PATCH /notifications/:id]', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ─── DELETE /api/notifications/:id ───────────────────────────────────────────
// Delete a single notification.
router.delete('/:id', async (req, res) => {
  try {
    const supabase = getSupabaseForUser(req.token);
    const { id } = req.params;

    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return res.json({ success: true, message: 'Notification deleted' });
  } catch (err) {
    console.error('[DELETE /notifications/:id]', err.message);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
