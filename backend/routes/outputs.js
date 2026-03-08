// ─── Outputs Router ───────────────────────────────────────────────────────────
// Manages agent-generated file outputs stored in Supabase Storage.
// Provides listing, signed-URL download generation, and deletion.
//
// Mounted at: /api/outputs
// ─────────────────────────────────────────────────────────────────────────────

const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { getSupabaseForUser, supabaseAdmin } = require('../services/supabase');
const { getSignedUrl, deleteOutput } = require('../services/storageService');

const router = express.Router();

// Apply auth middleware to all routes in this file
router.use(requireAuth);

// ─── GET /api/outputs ─────────────────────────────────────────────────────────
// List outputs with optional filtering.
// Query params: ?project_id=<uuid>&task_id=<uuid>&agent_id=<uuid>
// At least one filter is required to prevent returning all outputs globally.
// Returns outputs ordered by creation date (newest first).
router.get('/', async (req, res) => {
  try {
    const supabase = getSupabaseForUser(req.token);
    const { project_id, task_id, agent_id } = req.query;

    if (!project_id && !task_id && !agent_id) {
      return res.status(400).json({
        error: 'At least one filter is required: project_id, task_id, or agent_id',
      });
    }

    let query = supabase
      .from('outputs')
      .select('*')
      .order('created_at', { ascending: false });

    if (project_id) query = query.eq('project_id', project_id);
    if (task_id) query = query.eq('task_id', task_id);
    if (agent_id) query = query.eq('agent_id', agent_id);

    const { data, error } = await query;
    if (error) throw error;

    return res.json(data);
  } catch (err) {
    console.error('[GET /outputs]', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/outputs/:id/download ───────────────────────────────────────────
// Generate a fresh signed URL for downloading the output file.
// Signed URLs are valid for 1 hour (3600 seconds).
// The URL is also cached in the output record's download_url field.
router.get('/:id/download', async (req, res) => {
  try {
    const supabase = getSupabaseForUser(req.token);
    const { id } = req.params;

    // Fetch the output record to get the storage path
    const { data: output, error: fetchError } = await supabase
      .from('outputs')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !output) {
      return res.status(404).json({ error: 'Output not found or access denied' });
    }

    // Generate a fresh signed URL (they expire, so always generate fresh)
    const signedUrl = await getSignedUrl(output.storage_path);

    // Cache the signed URL in the DB for reference (optional convenience field)
    await supabaseAdmin
      .from('outputs')
      .update({ download_url: signedUrl })
      .eq('id', id);

    return res.json({
      url: signedUrl,
      filename: output.filename,
      file_type: output.file_type,
      file_size: output.file_size,
      expires_in: 3600, // seconds
    });
  } catch (err) {
    console.error('[GET /outputs/:id/download]', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ─── DELETE /api/outputs/:id ──────────────────────────────────────────────────
// Delete an output record and its associated file in Supabase Storage.
// Silently tolerates storage deletion failures (the DB record is still removed).
router.delete('/:id', async (req, res) => {
  try {
    const supabase = getSupabaseForUser(req.token);
    const { id } = req.params;

    // Fetch the output to get the storage path before deleting
    const { data: output, error: fetchError } = await supabase
      .from('outputs')
      .select('id, storage_path, filename')
      .eq('id', id)
      .single();

    if (fetchError || !output) {
      return res.status(404).json({ error: 'Output not found or access denied' });
    }

    // Delete the file from Supabase Storage (best-effort)
    try {
      await deleteOutput(output.storage_path);
    } catch (storageErr) {
      // Log but don't fail — the file may already be gone
      console.warn('[DELETE /outputs/:id] Storage deletion failed (continuing):', storageErr.message);
    }

    // Delete the DB record
    const { error: dbError } = await supabase
      .from('outputs')
      .delete()
      .eq('id', id);

    if (dbError) throw dbError;

    return res.json({ success: true, message: `Output "${output.filename}" deleted` });
  } catch (err) {
    console.error('[DELETE /outputs/:id]', err.message);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
