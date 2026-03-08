// ─── Tasks Router ─────────────────────────────────────────────────────────────
// Provides full CRUD for tasks plus a /run endpoint that triggers an AI agent.
//
// POST /api/tasks/:id/run flow:
//   1. Load task + agent + project data
//   2. Call runSubAgent() with the task description
//   3. Upload the file output to Supabase Storage
//   4. Create an output record in the DB
//   5. Create a thread_message of type 'report'
//   6. Update task status and token/cost metrics
//   7. Update agent metrics
//   8. Create a notification for the user
//   9. Return the thread message
//
// Mounted at: /api/tasks
// ─────────────────────────────────────────────────────────────────────────────

const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { getSupabaseForUser, supabaseAdmin } = require('../services/supabase');
const { runSubAgent } = require('../services/anthropic');
const { uploadAgentOutput } = require('../services/storageService');

const router = express.Router();

// Apply auth middleware to all routes in this file
router.use(requireAuth);

// ─── GET /api/tasks ───────────────────────────────────────────────────────────
// List tasks with optional filtering.
// Query params: ?project_id=<uuid>&milestone_id=<uuid>
// Returns tasks ordered by order_idx ascending.
router.get('/', async (req, res) => {
  try {
    const supabase = getSupabaseForUser(req.token);
    const { project_id, milestone_id } = req.query;

    if (!project_id) {
      return res.status(400).json({ error: 'project_id query parameter is required' });
    }

    let query = supabase
      .from('tasks')
      .select('*')
      .eq('project_id', project_id)
      .order('order_idx', { ascending: true });

    if (milestone_id) {
      query = query.eq('milestone_id', milestone_id);
    }

    const { data, error } = await query;
    if (error) throw error;

    return res.json(data);
  } catch (err) {
    console.error('[GET /tasks]', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/tasks ──────────────────────────────────────────────────────────
// Create a new task.
// Body: { project_id, milestone_id?, name, description?, assigned_agent_type?, model?, priority?, order_idx? }
router.post('/', async (req, res) => {
  try {
    const supabase = getSupabaseForUser(req.token);
    const {
      project_id,
      milestone_id,
      name,
      description,
      assigned_agent_type,
      model = 'claude-sonnet-4-6',
      priority = 'medium',
      order_idx = 0,
    } = req.body;

    if (!project_id) {
      return res.status(400).json({ error: 'project_id is required' });
    }
    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({ error: 'Task name is required' });
    }

    const validPriorities = ['low', 'medium', 'high', 'critical'];
    if (!validPriorities.includes(priority)) {
      return res.status(400).json({ error: `priority must be one of: ${validPriorities.join(', ')}` });
    }

    const { data, error } = await supabase
      .from('tasks')
      .insert({
        project_id,
        milestone_id: milestone_id ?? null,
        user_id: req.user.id,
        name: name.trim(),
        description: description ?? null,
        status: 'pending',
        assigned_agent_type: assigned_agent_type ?? null,
        model,
        priority,
        order_idx: Number(order_idx),
        estimated_tokens: 0,
        actual_tokens: 0,
        cost: 0,
      })
      .select()
      .single();

    if (error) throw error;

    return res.status(201).json(data);
  } catch (err) {
    console.error('[POST /tasks]', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ─── PUT /api/tasks/:id ───────────────────────────────────────────────────────
// Update a task. RLS ensures only the owner can update.
router.put('/:id', async (req, res) => {
  try {
    const supabase = getSupabaseForUser(req.token);
    const { id } = req.params;
    const {
      name, description, status, assigned_agent_type,
      model, priority, order_idx, milestone_id,
      estimated_tokens, actual_tokens, cost,
    } = req.body;

    const updates = {};
    if (name !== undefined) updates.name = name.trim();
    if (description !== undefined) updates.description = description;
    if (status !== undefined) updates.status = status;
    if (assigned_agent_type !== undefined) updates.assigned_agent_type = assigned_agent_type;
    if (model !== undefined) updates.model = model;
    if (priority !== undefined) updates.priority = priority;
    if (order_idx !== undefined) updates.order_idx = Number(order_idx);
    if (milestone_id !== undefined) updates.milestone_id = milestone_id;
    if (estimated_tokens !== undefined) updates.estimated_tokens = Number(estimated_tokens);
    if (actual_tokens !== undefined) updates.actual_tokens = Number(actual_tokens);
    if (cost !== undefined) updates.cost = Number(cost);

    // Auto-set completed_at when status changes to completed
    if (status === 'completed') {
      updates.completed_at = new Date().toISOString();
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No fields provided for update' });
    }

    const { data, error } = await supabase
      .from('tasks')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Task not found or access denied' });

    return res.json(data);
  } catch (err) {
    console.error('[PUT /tasks/:id]', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ─── DELETE /api/tasks/:id ────────────────────────────────────────────────────
// Delete a task. Associated outputs will have task_id set to NULL.
router.delete('/:id', async (req, res) => {
  try {
    const supabase = getSupabaseForUser(req.token);
    const { id } = req.params;

    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return res.json({ success: true, message: 'Task deleted' });
  } catch (err) {
    console.error('[DELETE /tasks/:id]', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/tasks/:id/run ──────────────────────────────────────────────────
// Trigger an AI agent to execute this task.
// This is the core AI execution endpoint for task-level agent runs.
router.post('/:id/run', async (req, res) => {
  const supabase = getSupabaseForUser(req.token);
  const userId = req.user.id;
  const { id: taskId } = req.params;

  try {
    // Step 1: Load the task and its project
    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', taskId)
      .single();

    if (taskError || !task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    if (!task.assigned_agent_type) {
      return res.status(400).json({ error: 'Task has no assigned agent type. Please assign an agent before running.' });
    }

    // Mark task as in-progress immediately
    await supabase
      .from('tasks')
      .update({ status: 'in_progress' })
      .eq('id', taskId);

    // Load the project for context
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', task.project_id)
      .single();

    if (projectError || !project) {
      throw new Error('Project not found for this task');
    }

    // Load milestones summary for project context
    const { data: milestones } = await supabase
      .from('milestones')
      .select('name, status, due_date')
      .eq('project_id', task.project_id)
      .order('order_idx', { ascending: true });

    // Find the agent assigned to this task type in the project (if one exists)
    const { data: agents } = await supabase
      .from('agents')
      .select('*')
      .eq('project_id', task.project_id)
      .eq('type', task.assigned_agent_type)
      .limit(1);

    const assignedAgent = agents?.[0] ?? null;

    // Step 2: Build project context and run the agent
    const projectContext = {
      projectName: project.name,
      projectGoal: project.goal,
      projectStatus: project.status,
      milestones: milestones ?? [],
      activeAgents: agents?.map((a) => ({ name: a.name, type: a.type, status: a.status })) ?? [],
      taskName: task.name,
      taskPriority: task.priority,
    };

    const outputFilename = `${task.assigned_agent_type.toLowerCase()}-${task.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}-${Date.now()}.md`;
    const taskDescription = task.description || task.name;

    // Mark the agent as active if found
    if (assignedAgent) {
      await supabase
        .from('agents')
        .update({ status: 'active', last_active: new Date().toISOString() })
        .eq('id', assignedAgent.id);
    }

    const agentResult = await runSubAgent(
      task.assigned_agent_type,
      taskDescription,
      projectContext,
      outputFilename
    );

    // Step 3: Upload file to Supabase Storage
    const { path: storagePath, size: fileSize } = await uploadAgentOutput(
      userId,
      task.project_id,
      outputFilename,
      agentResult.fileContent
    );

    // Step 4: Create output record in DB using admin client for reliability
    const { data: outputRecord, error: outputError } = await supabaseAdmin
      .from('outputs')
      .insert({
        project_id: task.project_id,
        task_id: taskId,
        agent_id: assignedAgent?.id ?? null,
        user_id: userId,
        filename: outputFilename,
        file_type: 'md',
        file_size: fileSize,
        storage_path: storagePath,
        description: `${task.assigned_agent_type} agent output for task: ${task.name}`,
        is_public: false,
      })
      .select()
      .single();

    if (outputError) throw outputError;

    // Step 5: Create a thread message with the agent's structured report
    const messageContent = buildReportContent(task, agentResult);
    const messageType = determineMessageType(agentResult.label);

    const { data: threadMessage, error: msgError } = await supabaseAdmin
      .from('thread_messages')
      .insert({
        project_id: task.project_id,
        user_id: userId,
        from_name: assignedAgent?.name ?? `${task.assigned_agent_type} Agent`,
        from_type: 'agent',
        agent_id: assignedAgent?.id ?? null,
        type: messageType,
        content: messageContent,
        deliverables: [
          {
            label: outputFilename,
            status: 'completed',
            output_id: outputRecord.id,
          },
        ],
        metadata: {
          label: agentResult.label,
          fields: agentResult.fields,
          agentType: task.assigned_agent_type,
          taskId,
        },
        tokens_used: agentResult.inputTokens + agentResult.outputTokens,
        cost: agentResult.cost,
      })
      .select()
      .single();

    if (msgError) throw msgError;

    // Step 6: Update task to completed with token/cost metrics
    const totalTokens = agentResult.inputTokens + agentResult.outputTokens;
    await supabaseAdmin
      .from('tasks')
      .update({
        status: 'completed',
        actual_tokens: totalTokens,
        cost: agentResult.cost,
        completed_at: new Date().toISOString(),
      })
      .eq('id', taskId);

    // Step 7: Update agent metrics
    if (assignedAgent) {
      await supabaseAdmin
        .from('agents')
        .update({
          status: 'idle',
          tasks_done: (assignedAgent.tasks_done ?? 0) + 1,
          tokens_used: (assignedAgent.tokens_used ?? 0) + totalTokens,
          cost: Number(assignedAgent.cost ?? 0) + agentResult.cost,
          last_active: new Date().toISOString(),
        })
        .eq('id', assignedAgent.id);
    }

    // Step 8: Update project totals
    await supabaseAdmin
      .from('projects')
      .update({
        tokens_used: (project.tokens_used ?? 0) + totalTokens,
        total_cost: Number(project.total_cost ?? 0) + agentResult.cost,
      })
      .eq('id', task.project_id);

    // Step 9: Create a notification for the user
    await supabaseAdmin
      .from('notifications')
      .insert({
        user_id: userId,
        project_id: task.project_id,
        category: 'task',
        level: 'success',
        title: `Task Completed: ${task.name}`,
        message: `${task.assigned_agent_type} Agent completed "${task.name}" and generated ${outputFilename}.`,
        is_read: false,
        actions: [
          { label: 'View Output', href: `/projects/${task.project_id}`, style: 'primary' },
        ],
        metadata: {
          taskId,
          agentType: task.assigned_agent_type,
          outputId: outputRecord.id,
          tokensUsed: totalTokens,
          cost: agentResult.cost,
        },
      });

    // Step 10: Return the thread message and output record
    return res.json({
      threadMessage,
      output: outputRecord,
      tokensUsed: totalTokens,
      cost: agentResult.cost,
    });
  } catch (err) {
    console.error('[POST /tasks/:id/run]', err.message);

    // Mark task as failed on error
    await supabaseAdmin
      .from('tasks')
      .update({ status: 'failed' })
      .eq('id', taskId)
      .catch(() => {}); // Don't throw if this update also fails

    return res.status(500).json({ error: err.message });
  }
});

// ─── Helper: Build report message content ────────────────────────────────────

/**
 * Builds the markdown content for the thread message report card.
 */
function buildReportContent(task, agentResult) {
  const fieldLines = agentResult.fields
    .map(([k, v]) => `- **${k}**: ${v}`)
    .join('\n');

  return `## ${agentResult.label}

**Task**: ${task.name}
**Agent**: ${task.assigned_agent_type} Agent

${fieldLines ? `### Summary\n${fieldLines}\n` : ''}
### Output Preview
${agentResult.content.slice(0, 1000)}${agentResult.content.length > 1000 ? '\n\n_[Full output available for download]_' : ''}`;
}

/**
 * Determines the message_type enum value from the agent's label.
 * Maps agent output labels to the thread_messages type enum.
 */
function determineMessageType(label) {
  const l = label.toLowerCase();
  if (l.includes('report') || l.includes('findings') || l.includes('analysis') || l.includes('assessment')) {
    return 'report';
  }
  if (l.includes('alert') || l.includes('warning') || l.includes('critical')) {
    return 'alert';
  }
  if (l.includes('briefing')) {
    return 'briefing';
  }
  return 'report';
}

module.exports = router;
