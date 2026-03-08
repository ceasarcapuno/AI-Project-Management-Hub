// ═══════════════════════════════════════════════════════════════════════════
// AIPM Helper Utilities
// ═══════════════════════════════════════════════════════════════════════════

import { FILE_TYPE } from "./constants";

// ─── File Type ───────────────────────────────────────────────────────────────
/** Given a filename, return its FILE_TYPE entry (or a sensible fallback). */
export function fileTypeOf(name = "") {
  const ext = name.split(".").pop().toLowerCase();
  return FILE_TYPE[ext] || { icon: "📎", label: ext.toUpperCase(), color: "#9a9590", bg: "#f9f8f6" };
}

// ─── Size Formatting ─────────────────────────────────────────────────────────
/** Format bytes into a human-readable string. */
export function fmtBytes(bytes = 0) {
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  if (bytes >= 1_024)     return `${(bytes / 1_024).toFixed(1)} KB`;
  return `${bytes} B`;
}

/** Format kilobytes into a human-readable string (legacy helper for mockup data). */
export function fmtSize(kb = 0) {
  return kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`;
}

// ─── Date / Time Formatting ──────────────────────────────────────────────────
/** Return a relative or absolute label for a date string. */
export function fmtDate(dateStr) {
  if (!dateStr) return "";
  const d    = new Date(dateStr);
  const now  = new Date();
  const diff = Math.floor((now - d) / 1000); // seconds ago

  if (diff < 60)            return "Just now";
  if (diff < 3600)          return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86_400)        return `${Math.floor(diff / 3600)} hr ago`;
  if (diff < 2 * 86_400)   return "Yesterday";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Return a short due-date label (e.g. "Dec 15", "Fri", "Jun 14"). */
export function fmtDueDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ─── Progress ────────────────────────────────────────────────────────────────
/** Compute percentage (0–100) safely (returns 0 if total is 0). */
export function pct(done, total) {
  if (!total) return 0;
  return Math.round((done / total) * 100);
}

// ─── File Download (client-side blob) ────────────────────────────────────────
/**
 * Trigger a browser download with the given content.
 * In production the content comes from a Supabase Storage signed URL;
 * this fallback is used for in-memory / text files.
 */
export function downloadBlob(filename, content = "") {
  const blob = new Blob([content], { type: "text/plain" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Fetch a signed download URL from the API, then redirect the browser to it.
 * Falls back to downloadBlob if the API call fails.
 */
export async function downloadOutput(outputId, filename) {
  try {
    const res  = await fetch(`/api/outputs/${outputId}/download`);
    const data = await res.json();
    if (data.url) {
      const a = document.createElement("a");
      a.href = data.url;
      a.download = filename;
      a.target = "_blank";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return;
    }
  } catch (e) {
    console.warn("Could not fetch signed URL, falling back to blob download", e);
  }
  downloadBlob(filename, `Content of ${filename}`);
}

// ─── Token Colour ─────────────────────────────────────────────────────────────
import { T } from "./constants";

/** Return the appropriate colour for a token usage percentage. */
export function tokenColor(pctUsed) {
  if (pctUsed > 90) return T.red;
  if (pctUsed > 75) return T.amber;
  return T.green;
}

/** Return the soft background colour for a token usage percentage. */
export function tokenBg(pctUsed) {
  if (pctUsed > 90) return T.redSoft;
  if (pctUsed > 75) return T.amberSoft;
  return T.greenSoft;
}

/** Return the border colour for a token usage percentage. */
export function tokenBorder(pctUsed) {
  if (pctUsed > 90) return T.redBorder;
  if (pctUsed > 75) return T.amberBorder;
  return T.greenBorder;
}

// ─── String Helpers ──────────────────────────────────────────────────────────
/** Capitalise first letter. */
export function cap(str = "") {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/** Truncate a string to maxLen characters with an ellipsis. */
export function truncate(str = "", maxLen = 60) {
  return str.length > maxLen ? `${str.slice(0, maxLen)}…` : str;
}
