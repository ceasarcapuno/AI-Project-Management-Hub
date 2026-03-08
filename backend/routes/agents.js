// ─── Agents Router ────────────────────────────────────────────────────────────
// Provides full CRUD for AI sub-agents plus a /run endpoint for ad-hoc tasks.
//
// POST /api/agents/:id/run flow (general agent run, not task-specific):
//   1. Load the agent and its project
//   2. Call runSubAgent() with the provided task description
//   3. Upload the file output to Supabase Storage
//   4. Create an output record in the DB
//   5. Create a thread_message of type 'report'
//   6. Update agent metrics (tasks_done, cost, tokens_used)
//   7. Update project totals
//   8. Create a notification for the user
//   9. Return the thread message and output
//
// Mounted at: /api/agents
// ─────────────────────────────────────────────────────────────────────────────

const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { getSupabaseForUser, supabaseAdmin } = require('../services/supabase');
const { runSubAgent } = require('../services/anthropic');
const { uploadAgentOutput } = require('../services/storageService');

const router = express.Router();

// Apply auth middleware to all routes in this file
router.use(requireAuth);

// ─── GET /api/agents ──────────────────────────────────────────────────────────
// List agents for a project.
// Required query param: ?project_id=<uuid>
// Returns agents ordered by creation date.
router.get('/', async (req, res) => {
  try {
    const supabase = getSupabaseForUser(req.token);
    const { project_id } = req.query;

    if (!project_id) {
      return res.status(400).json({ error: 'project_id query parameter is required' });
    }

    const { data, error } = await supabase
      .from('agents')
      .select('*')
      .eq('project_id', project_id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return res.json(data);
  } catch (err) {
    console.error('[GET /agents]', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/agents ─────────────────────────────────────────────────────────
// Create a new agent within a project.
// Body: { project_id, name, type, model? }
router.post('/', async (req, res) => {
  try {
    const supabase = getSupabaseForUser(req.token);
    const { project_id, name, type, model = 'claude-sonnet-4-6' } = req.body;

    if (!project_id) {
      return res.status(400).json({ error: 'project_id is required' });
    }
    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({ error: 'Agent name is required' });
    }
    if (!type) {
      return res.status(400).json({ error: 'Agent type is required' });
    }

    const validTypes = [
      'Research', 'Code', 'Design', 'Strategy', 'Marketing',
      'Analysis', 'Writing', 'QA', 'DevOps', 'Security', 'Data', 'Product',
    ];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: `type must be one of: ${validTypes.join(', ')}` });
    }

    const { data, error } = await supabase
      .from('agents')
      .insert({
        project_id,
        user_id: req.user.id,
        name: name.trim(),
        type,
        model,
        status: 'idle',
        cost: 0,
        tasks_done: 0,
        tokens_used: 0,
      })
      .select()
      .single();

    if (error) throw error;

    return res.status(201).json(data);
  } catch (err) {
    console.error('[POST /agents]', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ─── PUT /api/agents/:id ──────────────────────────────────────────────────────
// Update an agent. RLS ensures only the owner can update.
// Body: any subset of { name, type, model, status }
router.put('/:id', async (req, res) => {
  try {
    const supabase = getSupabaseForUser(req.token);
    const { id } = req.params;
    const { name, type, model, status } = req.body;

    const updates = {};
    if (name !== undefined) updates.name = name.trim();
    if (type !== undefined) updates.type = type;
    if (model !== undefined) updates.model = model;
    if (status !== undefined) updates.status = status;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No fields provided for update' });
    }

    const { data, error } = await supabase
      .from('agents')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Agent not found or access denied' });

    return res.json(data);
  } catch (err) {
    console.error('[PUT /agents/:id]', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ─── DELETE /api/agents/:id ───────────────────────────────────────────────────
// Delete an agent. Associated outputs/messages will have agent_id set to NULL.
router.delete('/:id', async (req, res) => {
  try {
    const supabase = getSupabaseForUser(req.token);
    const { id } = req.params;

    const { error } = await supabase
      .from('agents')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return res.json({ success: true, message: 'Agent deleted' });
  } catch (err) {
    console.error('[DELETE /agents/:id]', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/agents/:id/run ─────────────────────────────────────────────────
// Run a general (non-task-specific) agent task.
// Body: { task_description, output_filename? }
router.post('/:id/run', async (req, res) => {
  const supabase = getSupabaseForUser(req.token);
  const userId = req.user.id;
  const { id: agentId } = req.params;

  try {
    const { task_description, output_filename } = req.body;

    if (!task_description || typeof task_description !== 'string' || task_description.trim() === '') {
      return res.status(400).json({ error: 'task_description is required' });
    }

    // Step 1: Load the agent
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('*')
      .eq('id', agentId)
      .single();

    if (agentError || !agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    // Load the project for context
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', agent.project_id)
      .single();

    if (projectError || !project) {
      throw new Error('Project not found for this agent');
    }

    // Load milestones for context
    const { data: milestones } = await supabase
      .from('milestones')
      .select('name, status, due_date')
      .eq('project_id', agent.project_id)
      .order('order_idx', { ascending: true });

    // Step 2: Mark agent as active
    await supabase
      .from('agents')
      .update({ status: 'active', last_active: new Date().toISOString() })
      .eq('id', agentId);

    // Step 3: Build project context and run the agent
    const projectContext = {
      projectName: project.name,
      projectGoal: project.goal,
      projectStatus: project.status,
      milestones: milestones ?? [],
      agentName: agent.name,
      agentType: agent.type,
    };

    const filename = output_filename
      || `${agent.type.toLowerCase()}-${Date.now()}.md`;

    const agentResult = await runSubAgent(
      agent.type,
      task_description.trim(),
      projectContext,
      filename
    );

    // Step 4: Upload file to Supabase Storage
    const { path: storagePath, size: fileSize } = await uploadAgentOutput(
      userId,
      agent.project_id,
      filename,
      agentResult.fileContent
    );

    // Step 5: Create output record
    const { data: outputRecord, error: outputError } = await supabaseAdmin
      .from('outputs')
      .insert({
        project_id: agent.project_id,
        task_id: null,
        agent_id: agentId,
        user_id: userId,
        filename,
        file_type: 'md',
        file_size: fileSize,
        storage_path: storagePath,
        description: `${agent.type} Agent output: ${task_description.trim().slice(0, 100)}`,
        is_public: false,
      })
      .select()
      .single();

    if (outputError) throw outputError;

    // Step 6: Create a thread message
    const fieldLines = agentResult.fields
      .map(([k, v]) => `- **${k}**: ${v}`)
      .join('\n');

    const messageContent = `## ${agentResult.label}

**Agent**: ${agent.name} (${agent.type})
**Task**: ${task_description.trim().slice(0, 200)}

${fieldLines ? `### Summary\n${fieldLines}\n` : ''}
### Output Preview
${agentResult.content.slice(0, 1000)}${agentResult.content.length > 1000 ? '\n\n_[Full output available for download]_' : ''}`;

    const { data: threadMessage, error: msgError } = await supabaseAdmin
      .from('thread_messages')
      .insert({
        project_id: agent.project_id,
        user_id: userId,
        from_name: agent.name,
        from_type: 'agent',
        agent_id: agentId,
        type: 'report',
        content: messageContent,
        deliverables: [
          { label: filename, status: 'completed', output_id: outputRecord.id },
        ],
        metadata: {
          label: agentResult.label,
          fields: agentResult.fields,
          agentType: agent.type,
        },
        tokens_used: agentResult.inputTokens + agentResult.outputTokens,
        cost: agentResult.cost,
      })
      .select()
      .single();

    if (msgError) throw msgError;

    // Step 7: Update agent metrics
    const totalTokens = agentResult.inputTokens + agentResult.outputTokens;
    await supabaseAdmin
      .from('agents')
      .update({
        status: 'idle',
        tasks_done: (agent.tasks_done ?? 0) + 1,
        tokens_used: (agent.tokens_used ?? 0) + totalTokens,
        cost: Number(agent.cost ?? 0) + agentResult.cost,
        last_active: new Date().toISOString(),
      })
      .eq('id', agentId);

    // Step 8: Update project totals
    await supabaseAdmin
      .from('projects')
      .update({
        tokens_used: (project.tokens_used ?? 0) + totalTokens,
        total_cost: Number(project.total_cost ?? 0) + agentResult.cost,
      })
      .eq('id', agent.project_id);

    // Step 9: Create notification
    await supabaseAdmin
      .from('notifications')
      .insert({
        user_id: userId,
        project_id: agent.project_id,
        category: 'agent',
        level: 'success',
        title: `${agent.name} Completed Task`,
        message: `${agent.type} Agent finished the task and generated ${filename}.`,
        is_read: false,
        actions: [
          { label: 'View Project', href: `/projects/${agent.project_id}`, style: 'primary' },
        ],
        metadata: {
          agentId,
          agentType: agent.type,
          outputId: outputRecord.id,
          tokensUsed: totalTokens,
          cost: agentResult.cost,
        },
      });

    // Step 10: Return results
    return res.json({
      threadMessage,
      output: outputRecord,
      tokensUsed: totalTokens,
      cost: agentResult.cost,
    });
  } catch (err) {
    console.error('[POST /agents/:id/run]', err.message);

    // Reset agent status to idle on error
    await supabaseAdmin
      .from('agents')
      .update({ status: 'error' })
      .eq('id', agentId)
      .catch(() => {});

    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
