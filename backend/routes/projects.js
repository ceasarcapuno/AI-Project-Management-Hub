// ─── Projects Router ──────────────────────────────────────────────────────────
// Provides full CRUD for projects plus a rich detail endpoint that joins
// milestones, tasks, agents, and outputs.
//
// Mounted at: /api/projects
// ─────────────────────────────────────────────────────────────────────────────

const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { getSupabaseForUser } = require('../services/supabase');

const router = express.Router();

// Apply auth middleware to all routes in this file
router.use(requireAuth);

// ─── GET /api/projects ────────────────────────────────────────────────────────
// List projects for the authenticated user.
// Optional query param: ?workspace_id=<uuid> to filter by workspace.
// Returns projects ordered by creation date (newest first).
router.get('/', async (req, res) => {
  try {
    const supabase = getSupabaseForUser(req.token);
    const { workspace_id } = req.query;

    let query = supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false });

    if (workspace_id) {
      query = query.eq('workspace_id', workspace_id);
    }

    const { data, error } = await query;
    if (error) throw error;

    return res.json(data);
  } catch (err) {
    console.error('[GET /projects]', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/projects ───────────────────────────────────────────────────────
// Create a new project within a workspace.
// Body: { workspace_id, name, goal?, status?, due_date?, tags? }
router.post('/', async (req, res) => {
  try {
    const supabase = getSupabaseForUser(req.token);
    const { workspace_id, name, goal, status = 'active', due_date, tags } = req.body;

    if (!workspace_id) {
      return res.status(400).json({ error: 'workspace_id is required' });
    }
    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({ error: 'Project name is required' });
    }

    const validStatuses = ['active', 'paused', 'completed', 'archived'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${validStatuses.join(', ')}` });
    }

    const { data, error } = await supabase
      .from('projects')
      .insert({
        workspace_id,
        user_id: req.user.id,
        name: name.trim(),
        goal: goal ?? null,
        status,
        due_date: due_date ?? null,
        tags: tags ?? [],
        total_cost: 0,
        tokens_used: 0,
        progress: 0,
      })
      .select()
      .single();

    if (error) throw error;

    return res.status(201).json(data);
  } catch (err) {
    console.error('[POST /projects]', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/projects/:id ────────────────────────────────────────────────────
// Get a single project with full context:
//   - milestones (ordered by order_idx)
//   - tasks (ordered by order_idx)
//   - agents
//   - outputs (most recent first)
//   - recent thread messages (last 50)
router.get('/:id', async (req, res) => {
  try {
    const supabase = getSupabaseForUser(req.token);
    const { id } = req.params;

    // Fetch the project itself
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', id)
      .single();

    if (projectError) throw projectError;
    if (!project) return res.status(404).json({ error: 'Project not found' });

    // Fetch related data in parallel for performance
    const [milestonesResult, tasksResult, agentsResult, outputsResult, messagesResult] = await Promise.all([
      supabase
        .from('milestones')
        .select('*')
        .eq('project_id', id)
        .order('order_idx', { ascending: true }),

      supabase
        .from('tasks')
        .select('*')
        .eq('project_id', id)
        .order('order_idx', { ascending: true }),

      supabase
        .from('agents')
        .select('*')
        .eq('project_id', id)
        .order('created_at', { ascending: false }),

      supabase
        .from('outputs')
        .select('*')
        .eq('project_id', id)
        .order('created_at', { ascending: false })
        .limit(20),

      supabase
        .from('thread_messages')
        .select('*')
        .eq('project_id', id)
        .order('created_at', { ascending: false })
        .limit(50),
    ]);

    // Throw on any error
    if (milestonesResult.error) throw milestonesResult.error;
    if (tasksResult.error) throw tasksResult.error;
    if (agentsResult.error) throw agentsResult.error;
    if (outputsResult.error) throw outputsResult.error;
    if (messagesResult.error) throw messagesResult.error;

    return res.json({
      ...project,
      milestones: milestonesResult.data ?? [],
      tasks: tasksResult.data ?? [],
      agents: agentsResult.data ?? [],
      outputs: outputsResult.data ?? [],
      thread_messages: (messagesResult.data ?? []).reverse(), // Return chronological order
    });
  } catch (err) {
    console.error('[GET /projects/:id]', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ─── PUT /api/projects/:id ────────────────────────────────────────────────────
// Update a project. RLS ensures only the owner can update.
// Body: any subset of { name, goal, status, due_date, tags, progress }
router.put('/:id', async (req, res) => {
  try {
    const supabase = getSupabaseForUser(req.token);
    const { id } = req.params;
    const { name, goal, status, due_date, tags, progress, workspace_id } = req.body;

    const updates = {};
    if (name !== undefined) updates.name = name.trim();
    if (goal !== undefined) updates.goal = goal;
    if (status !== undefined) updates.status = status;
    if (due_date !== undefined) updates.due_date = due_date;
    if (tags !== undefined) updates.tags = tags;
    if (progress !== undefined) updates.progress = Math.min(100, Math.max(0, Number(progress)));
    if (workspace_id !== undefined) updates.workspace_id = workspace_id;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No fields provided for update' });
    }

    const { data, error } = await supabase
      .from('projects')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Project not found or access denied' });

    return res.json(data);
  } catch (err) {
    console.error('[PUT /projects/:id]', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ─── DELETE /api/projects/:id ─────────────────────────────────────────────────
// Delete a project and all its child data (cascades via FK constraints).
router.delete('/:id', async (req, res) => {
  try {
    const supabase = getSupabaseForUser(req.token);
    const { id } = req.params;

    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return res.json({ success: true, message: 'Project deleted' });
  } catch (err) {
    console.error('[DELETE /projects/:id]', err.message);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
