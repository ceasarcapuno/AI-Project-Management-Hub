// ═══════════════════════════════════════════════════════════════════════════
// AIPM Design System — shared constants (exact match to aipm-v7.jsx mockup)
// Import these into every component that needs theme, workspace, model, or
// status definitions. Do NOT hardcode colours anywhere else.
// ═══════════════════════════════════════════════════════════════════════════

// ─── Core Colour Palette ────────────────────────────────────────────────────
export const T = {
  bg:          "#f9f8f6",
  surface:     "#ffffff",
  border:      "#e8e5e0",
  borderLight: "#f0ede8",
  text:        "#1a1915",
  textMid:     "#5c5753",
  textSoft:    "#9a9590",
  accent:      "#d4692a",
  accentSoft:  "#fdf3ec",
  accentBorder:"#f5c9a8",
  green:       "#2a7d4f",
  greenSoft:   "#edf7f1",
  greenBorder: "#a8d9bc",
  amber:       "#b45309",
  amberSoft:   "#fffbeb",
  amberBorder: "#fcd34d",
  red:         "#c0392b",
  redSoft:     "#fff5f5",
  redBorder:   "#fca5a5",
  blue:        "#2563eb",
  blueSoft:    "#eff6ff",
};

// ─── Workspace Identities ───────────────────────────────────────────────────
export const WS = {
  private:  { label: "Private",  icon: "🏠", color: "#d97706", soft: "#fffbeb", tag: "Personal" },
  business: { label: "Business", icon: "💼", color: "#2563eb", soft: "#eff6ff", tag: "Company"  },
  work:     { label: "Work",     icon: "🏢", color: "#7c3aed", soft: "#f5f3ff", tag: "Employer" },
};

// ─── Claude Model Definitions ───────────────────────────────────────────────
export const MODEL = {
  "claude-haiku-4-5":  { label: "Claude Haiku 4",  color: "#2a7d4f", bg: "#edf7f1" },
  "claude-sonnet-4-5": { label: "Claude Sonnet 4", color: "#2563eb", bg: "#eff6ff" },
  "claude-sonnet-4-6": { label: "Claude Sonnet 4", color: "#2563eb", bg: "#eff6ff" },
  "claude-opus-4-5":   { label: "Claude Opus 4",   color: "#d4692a", bg: "#fdf3ec" },
  // Legacy keys from mockup (kept for backwards compat)
  "claude-haiku-4":    { label: "Claude Haiku 4",  color: "#2a7d4f", bg: "#edf7f1" },
  "claude-sonnet-4":   { label: "Claude Sonnet 4", color: "#2563eb", bg: "#eff6ff" },
  "claude-opus-4":     { label: "Claude Opus 4",   color: "#d4692a", bg: "#fdf3ec" },
};

// ─── Task / Milestone Statuses ──────────────────────────────────────────────
export const TASK_STATUS = {
  done:        { label: "Done",        color: T.green,   bg: T.greenSoft,  border: T.greenBorder,  icon: "✓" },
  completed:   { label: "Done",        color: T.green,   bg: T.greenSoft,  border: T.greenBorder,  icon: "✓" },
  ongoing:     { label: "In progress", color: T.accent,  bg: T.accentSoft, border: T.accentBorder, icon: "●" },
  in_progress: { label: "In progress", color: T.accent,  bg: T.accentSoft, border: T.accentBorder, icon: "●" },
  blocked:     { label: "Blocked",     color: T.amber,   bg: T.amberSoft,  border: T.amberBorder,  icon: "⊘" },
  waiting:     { label: "Waiting",     color: T.textSoft, bg: "#f5f4f2",   border: T.border,       icon: "○" },
  pending:     { label: "To do",       color: T.textSoft, bg: "#f5f4f2",   border: T.border,       icon: "○" },
  todo:        { label: "To do",       color: T.textSoft, bg: "#f5f4f2",   border: T.border,       icon: "○" },
  failed:      { label: "Failed",      color: T.red,     bg: T.redSoft,    border: T.redBorder,    icon: "✕" },
};

// ─── File Type Definitions ───────────────────────────────────────────────────
export const FILE_TYPE = {
  pdf:  { icon: "📄", label: "PDF",      color: "#c0392b", bg: "#fff5f5"   },
  docx: { icon: "📝", label: "Word",     color: "#2563eb", bg: "#eff6ff"   },
  xlsx: { icon: "📊", label: "Excel",    color: "#2a7d4f", bg: "#edf7f1"   },
  json: { icon: "🔧", label: "JSON",     color: "#7c3aed", bg: "#f5f3ff"   },
  csv:  { icon: "🗂",  label: "CSV",      color: "#b45309", bg: "#fffbeb"   },
  md:   { icon: "📃", label: "Markdown", color: "#5c5753", bg: "#f5f4f2"   },
  zip:  { icon: "📦", label: "ZIP",      color: "#9a9590", bg: "#f5f4f2"   },
  png:  { icon: "🖼",  label: "Image",    color: "#2563eb", bg: "#eff6ff"   },
  jpg:  { icon: "🖼",  label: "Image",    color: "#2563eb", bg: "#eff6ff"   },
  js:   { icon: "⚙️",  label: "JS",       color: "#d97706", bg: "#fffbeb"   },
  ts:   { icon: "⚙️",  label: "TS",       color: "#2563eb", bg: "#eff6ff"   },
  txt:  { icon: "📄", label: "Text",     color: "#5c5753", bg: "#f5f4f2"   },
};

// ─── Notification Type Icons & Colours ──────────────────────────────────────
export const NOTIF_ICONS = {
  "token-warning": { icon: "🔋", color: T.red,    bg: T.redSoft,    border: T.redBorder,    label: "Token Limit"   },
  "approval":      { icon: "✋", color: "#7c3aed", bg: "#f5f3ff",   border: "#ddd6fe",      label: "Approval"      },
  "decision":      { icon: "❓", color: T.amber,   bg: T.amberSoft,  border: T.amberBorder,  label: "Your Decision" },
  "cost-alert":    { icon: "💰", color: T.accent,  bg: T.accentSoft, border: T.accentBorder, label: "Cost Alert"    },
  "milestone":     { icon: "🏁", color: T.green,   bg: T.greenSoft,  border: T.greenBorder,  label: "Milestone"     },
  "blocker":       { icon: "⛔", color: T.amber,   bg: T.amberSoft,  border: T.amberBorder,  label: "Blocker"       },
  "review":        { icon: "👁",  color: T.blue,    bg: T.blueSoft,   border: "#bfdbfe",      label: "Ready Review"  },
  "system":        { icon: "⚙️",  color: T.textMid, bg: T.bg,         border: T.border,       label: "System"        },
  "collaboration": { icon: "🤝", color: T.blue,    bg: T.blueSoft,   border: "#bfdbfe",      label: "Collaboration" },
  "output":        { icon: "📦", color: T.green,   bg: T.greenSoft,  border: T.greenBorder,  label: "Output Ready"  },
  "deadline":      { icon: "⏰", color: T.red,     bg: T.redSoft,    border: T.redBorder,    label: "Deadline"      },
  "agent":         { icon: "🤖", color: T.accent,  bg: T.accentSoft, border: T.accentBorder, label: "Agent Update"  },
  "task":          { icon: "✅", color: T.green,   bg: T.greenSoft,  border: T.greenBorder,  label: "Task Done"     },
  "cost":          { icon: "💰", color: T.accent,  bg: T.accentSoft, border: T.accentBorder, label: "Cost Alert"    },
};

// ─── Agent Types with display info ──────────────────────────────────────────
export const AGENT_TYPE_INFO = {
  Research:    { emoji: "🔍", description: "Searches and synthesises information"      },
  Code:        { emoji: "⚙️",  description: "Writes and reviews code"                  },
  Design:      { emoji: "🎨", description: "Creates layouts, systems and assets"       },
  Strategy:    { emoji: "🎯", description: "Analyses options and plans approaches"     },
  Marketing:   { emoji: "📣", description: "Crafts copy and campaigns"                 },
  Analysis:    { emoji: "📊", description: "Interprets data and produces insights"     },
  Writing:     { emoji: "✍️",  description: "Drafts documents, emails and reports"     },
  QA:          { emoji: "✅", description: "Tests and validates work"                  },
  DevOps:      { emoji: "🚀", description: "Manages deployments and infrastructure"   },
  Security:    { emoji: "🔒", description: "Reviews code and configs for risks"        },
  Data:        { emoji: "🗄",  description: "Processes and transforms datasets"        },
  Product:     { emoji: "📋", description: "Shapes product decisions and priorities"   },
};

// ─── Default Claude model for AIPM ──────────────────────────────────────────
export const AIPM_MODEL = "claude-sonnet-4-6";
