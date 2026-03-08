// ─── Milestones Router ─────────────────────────────────────────────────────────
// Provides full CRUD for project milestones.
// Milestones are high-level phases within a project.
//
// Mounted at: /api/milestones
// ─────────────────────────────────────────────────────────────────────────────

const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { getSupabaseForUser } = require('../services/supabase');

const router = express.Router();

// Apply auth middleware to all routes in this file
router.use(requireAuth);

// ─── GET /api/milestones ──────────────────────────────────────────────────────
// List milestones for the authenticated user.
// Required query param: ?project_id=<uuid>
// Returns milestones ordered by order_idx ascending.
router.get('/', async (req, res) => {
  try {
    const supabase = getSupabaseForUser(req.token);
    const { project_id } = req.query;

    if (!project_id) {
      return res.status(400).json({ error: 'project_id query parameter is required' });
    }

    const { data, error } = await supabase
      .from('milestones')
      .select('*')
      .eq('project_id', project_id)
      .order('order_idx', { ascending: true });

    if (error) throw error;

    return res.json(data);
  } catch (err) {
    console.error('[GET /milestones]', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/milestones ─────────────────────────────────────────────────────
// Create a new milestone within a project.
// Body: { project_id, name, description?, status?, due_date?, order_idx? }
router.post('/', async (req, res) => {
  try {
    const supabase = getSupabaseForUser(req.token);
    const {
      project_id,
      name,
      description,
      status = 'pending',
      due_date,
      order_idx = 0,
    } = req.body;

    if (!project_id) {
      return res.status(400).json({ error: 'project_id is required' });
    }
    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({ error: 'Milestone name is required' });
    }

    const validStatuses = ['completed', 'in_progress', 'pending', 'blocked'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${validStatuses.join(', ')}` });
    }

    const { data, error } = await supabase
      .from('milestones')
      .insert({
        project_id,
        user_id: req.user.id,
        name: name.trim(),
        description: description ?? null,
        status,
        due_date: due_date ?? null,
        order_idx: Number(order_idx),
      })
      .select()
      .single();

    if (error) throw error;

    return res.status(201).json(data);
  } catch (err) {
    console.error('[POST /milestones]', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ─── PUT /api/milestones/:id ──────────────────────────────────────────────────
// Update a milestone. RLS ensures only the owner can update.
// Body: any subset of { name, description, status, due_date, order_idx }
router.put('/:id', async (req, res) => {
  try {
    const supabase = getSupabaseForUser(req.token);
    const { id } = req.params;
    const { name, description, status, due_date, order_idx } = req.body;

    const updates = {};
    if (name !== undefined) updates.name = name.trim();
    if (description !== undefined) updates.description = description;
    if (status !== undefined) updates.status = status;
    if (due_date !== undefined) updates.due_date = due_date;
    if (order_idx !== undefined) updates.order_idx = Number(order_idx);

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No fields provided for update' });
    }

    const { data, error } = await supabase
      .from('milestones')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Milestone not found or access denied' });

    return res.json(data);
  } catch (err) {
    console.error('[PUT /milestones/:id]', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ─── DELETE /api/milestones/:id ───────────────────────────────────────────────
// Delete a milestone. Tasks associated with this milestone will have their
// milestone_id set to NULL (via ON DELETE SET NULL in the schema).
router.delete('/:id', async (req, res) => {
  try {
    const supabase = getSupabaseForUser(req.token);
    const { id } = req.params;

    const { error } = await supabase
      .from('milestones')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return res.json({ success: true, message: 'Milestone deleted' });
  } catch (err) {
    console.error('[DELETE /milestones/:id]', err.message);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
