// ─── Chat Router ──────────────────────────────────────────────────────────────
// Mounted at: /api/chat
// POST /            — global AIPM chat (stateless)
// POST /project/:id — project-scoped chat, persists to thread_messages
// GET  /project/:id/thread — fetch thread
// ─────────────────────────────────────────────────────────────────────────────

const express = require('express');
const pool    = require('../db');
const { requireAuth }    = require('../middleware/auth');
const { sendAIPMMessage } = require('../services/anthropic');

const router = express.Router();
router.use(requireAuth);

// ─── POST /api/chat ───────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { messages, context = {} } = req.body;
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages array is required' });
    }

    const result = await sendAIPMMessage(messages, context);
    return res.json({ reply: result.content, tokens: { input: result.inputTokens, output: result.outputTokens }, cost: result.cost });
  } catch (err) {
    console.error('[POST /chat]', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/chat/project/:projectId ────────────────────────────────────────
router.post('/project/:projectId', async (req, res) => {
  try {
    const userId = req.user.id;
    const { projectId } = req.params;
    const { message, history = [] } = req.body;

    if (!message || message.trim() === '') return res.status(400).json({ error: 'message is required' });

    // Verify project access
    const { rows: pRows } = await pool.query(
      `SELECT p.* FROM projects p JOIN workspaces w ON w.id = p.workspace_id
       WHERE p.id = $1 AND w.user_id = $2`,
      [projectId, userId]
    );
    if (!pRows[0]) return res.status(404).json({ error: 'Project not found or access denied' });
    const project = pRows[0];

    const [mRows, tRows, aRows] = await Promise.all([
      pool.query('SELECT name, status FROM milestones WHERE project_id = $1 ORDER BY position', [projectId]),
      pool.query('SELECT name, status, agent FROM tasks WHERE milestone_id IN (SELECT id FROM milestones WHERE project_id = $1) ORDER BY position', [projectId]),
      pool.query('SELECT name, status, tasks_done FROM agents WHERE project_id = $1', [projectId]),
    ]);

    const projectContext = {
      projectId,
      projectName: project.name,
      projectGoal: project.goal,
      milestones:  mRows.rows,
      tasks:       tRows.rows,
      activeAgents: aRows.rows,
    };

    // Save user message
    const { rows: userMsgRows } = await pool.query(
      `INSERT INTO thread_messages (project_id, from_type, name, type, text)
       VALUES ($1, 'user', $2, 'user', $3) RETURNING *`,
      [projectId, req.user.name || req.user.email, message.trim()]
    );

    // Build conversation and call AIPM
    const conversationMessages = [
      ...history.map(h => ({ role: h.role === 'assistant' ? 'assistant' : 'user', content: String(h.content) })),
      { role: 'user', content: message.trim() },
    ];
    const aiResult    = await sendAIPMMessage(conversationMessages, projectContext);
    const totalTokens = aiResult.inputTokens + aiResult.outputTokens;

    // Save AI response
    const { rows: aiMsgRows } = await pool.query(
      `INSERT INTO thread_messages (project_id, from_type, name, type, text)
       VALUES ($1, 'aipm', 'AIPM', $2, $3) RETURNING *`,
      [projectId, determineType(aiResult.content), aiResult.content]
    );

    // Update project token/cost totals
    await pool.query(
      'UPDATE projects SET token_used = token_used + $1, cost = cost + $2 WHERE id = $3',
      [totalTokens, aiResult.cost, projectId]
    );

    return res.json({
      message: aiMsgRows[0],
      userMessage: userMsgRows[0],
      tokens: { input: aiResult.inputTokens, output: aiResult.outputTokens, total: totalTokens },
      cost: aiResult.cost,
    });
  } catch (err) {
    console.error('[POST /chat/project/:projectId]', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/chat/project/:projectId/thread ──────────────────────────────────
router.get('/project/:projectId/thread', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { limit = 100, offset = 0 } = req.query;

    const { rows: pRows } = await pool.query(
      `SELECT p.id, p.name FROM projects p JOIN workspaces w ON w.id = p.workspace_id
       WHERE p.id = $1 AND w.user_id = $2`,
      [projectId, req.user.id]
    );
    if (!pRows[0]) return res.status(404).json({ error: 'Project not found or access denied' });

    const { rows: messages } = await pool.query(
      `SELECT * FROM thread_messages WHERE project_id = $1
       ORDER BY created_at ASC LIMIT $2 OFFSET $3`,
      [projectId, Number(limit), Number(offset)]
    );

    return res.json({ projectId, projectName: pRows[0].name, messages, count: messages.length });
  } catch (err) {
    console.error('[GET /chat/project/:projectId/thread]', err.message);
    return res.status(500).json({ error: err.message });
  }
});

function determineType(content) {
  const first = content.split('\n')[0].toUpperCase();
  if (first.includes('BRIEFING:') || first.includes('## BRIEFING')) return 'briefing';
  if (first.includes('ALERT:')    || first.includes('## ALERT'))    return 'alert';
  if (first.includes('REPORT:')   || first.includes('## REPORT'))   return 'report';
  return 'prose';
}

module.exports = router;
