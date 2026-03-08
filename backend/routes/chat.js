// ─── Chat Router ──────────────────────────────────────────────────────────────
// Provides three endpoints for AIPM (AI Project Manager) conversations:
//
//   POST /api/chat
//     Global chat — no project context required. For general AI PM questions.
//
//   POST /api/chat/project/:projectId
//     Project-specific chat — loads project data and injects it as context.
//     Saves user and AI PM messages to the thread_messages table.
//
//   GET /api/chat/project/:projectId/thread
//     Returns all thread messages for a project in chronological order.
//
// Mounted at: /api/chat
// ─────────────────────────────────────────────────────────────────────────────

const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { getSupabaseForUser, supabaseAdmin } = require('../services/supabase');
const { sendAIPMMessage } = require('../services/anthropic');

const router = express.Router();

// Apply auth middleware to all routes in this file
router.use(requireAuth);

// ─── POST /api/chat ───────────────────────────────────────────────────────────
// Global AIPM chat without a specific project context.
// Body: { messages: [{role: 'user'|'assistant', content: string}], context?: {} }
// Returns: { reply: string, tokens: { input, output } }
router.post('/', async (req, res) => {
  try {
    const { messages, context = {} } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages array is required and must not be empty' });
    }

    // Validate message format
    for (const msg of messages) {
      if (!msg.role || !msg.content) {
        return res.status(400).json({ error: 'Each message must have role and content fields' });
      }
      if (!['user', 'assistant'].includes(msg.role)) {
        return res.status(400).json({ error: 'Message role must be "user" or "assistant"' });
      }
    }

    const result = await sendAIPMMessage(messages, context);

    return res.json({
      reply: result.content,
      tokens: {
        input: result.inputTokens,
        output: result.outputTokens,
      },
      cost: result.cost,
    });
  } catch (err) {
    console.error('[POST /chat]', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/chat/project/:projectId ────────────────────────────────────────
// Project-specific AIPM chat. Loads the project, saves the conversation to
// the thread_messages table, and returns the persisted AI PM reply.
//
// Body: { message: string, history?: [{role, content}] }
router.post('/project/:projectId', async (req, res) => {
  try {
    const supabase = getSupabaseForUser(req.token);
    const userId = req.user.id;
    const { projectId } = req.params;
    const { message, history = [] } = req.body;

    if (!message || typeof message !== 'string' || message.trim() === '') {
      return res.status(400).json({ error: 'message is required' });
    }

    // Step 1: Load project data with full context
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      return res.status(404).json({ error: 'Project not found or access denied' });
    }

    // Load related data in parallel for rich context
    const [milestonesResult, tasksResult, agentsResult] = await Promise.all([
      supabase
        .from('milestones')
        .select('name, status, due_date, order_idx')
        .eq('project_id', projectId)
        .order('order_idx', { ascending: true }),

      supabase
        .from('tasks')
        .select('name, status, assigned_agent_type, priority, cost')
        .eq('project_id', projectId)
        .order('order_idx', { ascending: true }),

      supabase
        .from('agents')
        .select('name, type, status, tasks_done, cost, tokens_used')
        .eq('project_id', projectId),
    ]);

    // Step 2: Build the project context object for the AI
    const projectContext = {
      projectId,
      projectName: project.name,
      projectGoal: project.goal,
      projectStatus: project.status,
      projectProgress: project.progress,
      projectDueDate: project.due_date,
      totalCost: Number(project.total_cost ?? 0),
      tokensUsed: project.tokens_used ?? 0,
      tags: project.tags ?? [],
      milestones: milestonesResult.data ?? [],
      tasks: tasksResult.data ?? [],
      activeAgents: agentsResult.data ?? [],
    };

    // Step 3: Save the user's message to thread_messages
    const userDisplayName = req.user.user_metadata?.full_name
      || req.user.user_metadata?.name
      || req.user.email?.split('@')[0]
      || 'User';

    const { data: userMessage, error: userMsgError } = await supabaseAdmin
      .from('thread_messages')
      .insert({
        project_id: projectId,
        user_id: userId,
        from_name: userDisplayName,
        from_type: 'user',
        agent_id: null,
        type: 'user',
        content: message.trim(),
        deliverables: [],
        metadata: {},
        tokens_used: 0,
        cost: 0,
      })
      .select()
      .single();

    if (userMsgError) throw userMsgError;

    // Step 4: Build the full conversation history for the AI
    // Include prior history + the new user message
    const conversationMessages = [
      ...history.map((h) => ({
        role: h.role === 'assistant' ? 'assistant' : 'user',
        content: String(h.content),
      })),
      { role: 'user', content: message.trim() },
    ];

    // Step 5: Call the AIPM with project context
    const aiResult = await sendAIPMMessage(conversationMessages, projectContext);

    // Step 6: Determine the message type from the AI's response
    const aiMessageType = determineAIPMMessageType(aiResult.content);

    // Step 7: Save the AI PM's reply to thread_messages
    const { data: aiMessage, error: aiMsgError } = await supabaseAdmin
      .from('thread_messages')
      .insert({
        project_id: projectId,
        user_id: userId,
        from_name: 'AIPM',
        from_type: 'aipm',
        agent_id: null,
        type: aiMessageType,
        content: aiResult.content,
        deliverables: [],
        metadata: {
          inputTokens: aiResult.inputTokens,
          outputTokens: aiResult.outputTokens,
          model: 'claude-sonnet-4-6',
        },
        tokens_used: aiResult.inputTokens + aiResult.outputTokens,
        cost: aiResult.cost,
      })
      .select()
      .single();

    if (aiMsgError) throw aiMsgError;

    // Step 8: Update project token and cost totals
    const totalTokens = aiResult.inputTokens + aiResult.outputTokens;
    await supabaseAdmin
      .from('projects')
      .update({
        tokens_used: (project.tokens_used ?? 0) + totalTokens,
        total_cost: Number(project.total_cost ?? 0) + aiResult.cost,
      })
      .eq('id', projectId);

    // Step 9: Return the persisted AI PM message
    return res.json({
      message: aiMessage,
      userMessage,
      tokens: {
        input: aiResult.inputTokens,
        output: aiResult.outputTokens,
        total: totalTokens,
      },
      cost: aiResult.cost,
    });
  } catch (err) {
    console.error('[POST /chat/project/:projectId]', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/chat/project/:projectId/thread ──────────────────────────────────
// Retrieve the full message thread for a project.
// Returns messages in chronological order (oldest first).
// This enables the frontend to render the full conversation history.
router.get('/project/:projectId/thread', async (req, res) => {
  try {
    const supabase = getSupabaseForUser(req.token);
    const { projectId } = req.params;
    const { limit = 100, offset = 0 } = req.query;

    // Verify the user has access to this project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, name')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      return res.status(404).json({ error: 'Project not found or access denied' });
    }

    // Fetch thread messages in chronological order (ASC)
    const { data: messages, error: messagesError } = await supabase
      .from('thread_messages')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    if (messagesError) throw messagesError;

    return res.json({
      projectId,
      projectName: project.name,
      messages: messages ?? [],
      count: messages?.length ?? 0,
    });
  } catch (err) {
    console.error('[GET /chat/project/:projectId/thread]', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ─── Helper: Determine AIPM message type ─────────────────────────────────────

/**
 * Infers the message_type enum value from the AIPM's response content.
 * Looks for prefix keywords to classify the message.
 *
 * @param {string} content
 * @returns {'briefing'|'alert'|'prose'|'report'}
 */
function determineAIPMMessageType(content) {
  const firstLine = content.split('\n')[0].toUpperCase();

  if (firstLine.includes('BRIEFING:') || firstLine.includes('## BRIEFING')) {
    return 'briefing';
  }
  if (firstLine.includes('ALERT:') || firstLine.includes('## ALERT')) {
    return 'alert';
  }
  if (firstLine.includes('REPORT:') || firstLine.includes('## REPORT')) {
    return 'report';
  }

  return 'prose';
}

module.exports = router;
