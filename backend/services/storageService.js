// ─── Storage Service ──────────────────────────────────────────────────────────
// Wraps Supabase Storage operations for agent-generated output files.
// All files are stored in the "agent-outputs" bucket under:
//   {userId}/{projectId}/{filename}
//
// IMPORTANT: Uses supabaseAdmin (service role) to bypass Storage RLS.
// Access control is enforced at the API layer via requireAuth middleware.
// ─────────────────────────────────────────────────────────────────────────────

const { supabaseAdmin } = require('./supabase');

const BUCKET = 'agent-outputs';

// Signed URL expiry in seconds (1 hour)
const SIGNED_URL_EXPIRY = 3600;

/**
 * Uploads agent-generated content to Supabase Storage.
 *
 * @param {string} userId     — The authenticated user's UUID
 * @param {string} projectId  — The project UUID
 * @param {string} filename   — Target filename (e.g. "research-report.md")
 * @param {string} content    — The file content as a string
 * @returns {Promise<{ path: string, size: number }>}
 */
async function uploadAgentOutput(userId, projectId, filename, content) {
  const buffer = Buffer.from(content, 'utf-8');
  const storagePath = `${userId}/${projectId}/${filename}`;

  // Determine content type from file extension
  const ext = filename.split('.').pop()?.toLowerCase() ?? 'txt';
  const contentTypeMap = {
    md: 'text/markdown',
    txt: 'text/plain',
    json: 'application/json',
    csv: 'text/csv',
    html: 'text/html',
    pdf: 'application/pdf',
  };
  const contentType = contentTypeMap[ext] ?? 'text/plain';

  const { data, error } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(storagePath, buffer, {
      contentType,
      upsert: true, // Overwrite if same filename exists (e.g. re-run of task)
    });

  if (error) {
    throw new Error(`Storage upload failed: ${error.message}`);
  }

  return {
    path: data.path ?? storagePath,
    size: buffer.byteLength,
  };
}

/**
 * Generates a signed (temporary) download URL for a stored file.
 * The URL is valid for SIGNED_URL_EXPIRY seconds (default: 1 hour).
 *
 * @param {string} storagePath — The full storage path returned by uploadAgentOutput
 * @returns {Promise<string>} The signed URL
 */
async function getSignedUrl(storagePath) {
  const { data, error } = await supabaseAdmin.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_EXPIRY);

  if (error) {
    throw new Error(`Failed to generate signed URL: ${error.message}`);
  }

  return data.signedUrl;
}

/**
 * Deletes a file from Supabase Storage.
 *
 * @param {string} storagePath — The full storage path of the file to delete
 * @returns {Promise<void>}
 */
async function deleteOutput(storagePath) {
  const { error } = await supabaseAdmin.storage
    .from(BUCKET)
    .remove([storagePath]);

  if (error) {
    throw new Error(`Storage delete failed: ${error.message}`);
  }
}

module.exports = { uploadAgentOutput, getSignedUrl, deleteOutput };
