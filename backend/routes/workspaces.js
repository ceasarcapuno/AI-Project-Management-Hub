// ─── Workspaces Router ────────────────────────────────────────────────────────
// Provides full CRUD for user workspaces.
// All routes are protected by requireAuth and use RLS-scoped Supabase clients
// so users can only access their own workspaces.
//
// Mounted at: /api/workspaces
// ─────────────────────────────────────────────────────────────────────────────

const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { getSupabaseForUser } = require('../services/supabase');

const router = express.Router();

// Apply auth middleware to all routes in this file
router.use(requireAuth);

// ─── GET /api/workspaces ──────────────────────────────────────────────────────
// List all workspaces belonging to the authenticated user.
// Returns workspaces ordered by creation date (newest first).
router.get('/', async (req, res) => {
  try {
    const supabase = getSupabaseForUser(req.token);

    const { data, error } = await supabase
      .from('workspaces')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return res.json(data);
  } catch (err) {
    console.error('[GET /workspaces]', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/workspaces ─────────────────────────────────────────────────────
// Create a new workspace for the authenticated user.
// Body: { name, type?, description?, color?, icon? }
router.post('/', async (req, res) => {
  try {
    const supabase = getSupabaseForUser(req.token);
    const { name, type = 'private', description, color, icon } = req.body;

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({ error: 'Workspace name is required' });
    }

    const validTypes = ['private', 'business', 'work'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: `type must be one of: ${validTypes.join(', ')}` });
    }

    const { data, error } = await supabase
      .from('workspaces')
      .insert({
        user_id: req.user.id,
        name: name.trim(),
        type,
        description: description ?? null,
        color: color ?? null,
        icon: icon ?? null,
      })
      .select()
      .single();

    if (error) throw error;

    return res.status(201).json(data);
  } catch (err) {
    console.error('[POST /workspaces]', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ─── PUT /api/workspaces/:id ──────────────────────────────────────────────────
// Update an existing workspace. RLS ensures only the owner can update.
// Body: any subset of { name, type, description, color, icon }
router.put('/:id', async (req, res) => {
  try {
    const supabase = getSupabaseForUser(req.token);
    const { id } = req.params;
    const { name, type, description, color, icon } = req.body;

    // Build update payload — only include fields that were provided
    const updates = {};
    if (name !== undefined) updates.name = name.trim();
    if (type !== undefined) updates.type = type;
    if (description !== undefined) updates.description = description;
    if (color !== undefined) updates.color = color;
    if (icon !== undefined) updates.icon = icon;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No fields provided for update' });
    }

    const { data, error } = await supabase
      .from('workspaces')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Workspace not found or access denied' });

    return res.json(data);
  } catch (err) {
    console.error('[PUT /workspaces/:id]', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ─── DELETE /api/workspaces/:id ───────────────────────────────────────────────
// Delete a workspace. Cascades to projects, milestones, tasks, etc. via FK rules.
// RLS ensures only the owner can delete.
router.delete('/:id', async (req, res) => {
  try {
    const supabase = getSupabaseForUser(req.token);
    const { id } = req.params;

    const { error } = await supabase
      .from('workspaces')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return res.json({ success: true, message: 'Workspace deleted' });
  } catch (err) {
    console.error('[DELETE /workspaces/:id]', err.message);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
