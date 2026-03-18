# CLAUDE.md — AI Project Management Hub

Self-hosted AI project management platform that orchestrates specialist Claude sub-agents across projects, milestones, and tasks. The backend is Express + PostgreSQL + Redis; the frontend is React + Vite + Tailwind CSS; everything runs under Docker Compose.

---

## Repository Layout

```
AI-Project-Management-Hub/
├── backend/
│   ├── index.js                  # Express entry point, startup, cleanup cron
│   ├── db.js                     # pg connection pool (max 20)
│   ├── migrations/
│   │   ├── run.js                # Idempotent migration runner (called on every boot)
│   │   ├── 001_init.sql          # Core schema
│   │   ├── 002_token_budget.sql  # agent_runs audit table
│   │   └── 003_storage_quota.sql # Per-user storage quota + outputs.user_id
│   ├── middleware/
│   │   ├── auth.js               # requireAuth — JWT Bearer → req.user
│   │   └── tokenBudget.js        # createTokenBudgetGuard factory
│   ├── routes/
│   │   ├── auth.js               # /api/auth  (register, login, me)
│   │   ├── workspaces.js         # /api/workspaces
│   │   ├── projects.js           # /api/projects  (+ token-usage, budget-status)
│   │   ├── milestones.js         # /api/milestones
│   │   ├── tasks.js              # /api/tasks  (+ /:id/run)
│   │   ├── agents.js             # /api/agents (+ /:id/run)
│   │   ├── chat.js               # /api/chat   (AIPM orchestrator)
│   │   ├── notifications.js      # /api/notifications (SSE stream + CRUD)
│   │   └── outputs.js            # /api/outputs (download, delete, storage-usage)
│   └── services/
│       ├── anthropic.js          # sendAIPMMessage, runSubAgent, cost helpers
│       ├── agentPrompts.js       # System prompts for AIPM + all specialist agents
│       ├── tokenTracker.js       # addTokenUsage, getRemainingBudget
│       ├── redis.js              # ioredis client (pub/sub for SSE)
│       └── fileManager.js        # sanitizeFilename, validateUploadPath,
│                                 #   checkUserQuota, getUserStorageStats,
│                                 #   cleanupOrphanFiles
├── frontend/
│   ├── src/
│   │   ├── services/api.js       # Axios instance — JWT auto-attached
│   │   ├── context/AppContext.jsx # Global state + SSE connection
│   │   ├── pages/AuthPage.jsx
│   │   ├── views/HomeView.jsx
│   │   ├── components/
│   │   │   ├── layout/           # TopBar, Sidebar, ChatBar
│   │   │   ├── project/          # ProjectDetail, TaskRow, MilestoneBlock, OutputsTab
│   │   │   ├── notifications/    # NotificationPanel
│   │   │   └── ui/               # Avatar, TokenBar, StatusPill, FilePill, ModelBadge
│   │   └── utils/constants.js, helpers.js
│   └── package.json
├── docker-compose.yml
├── .env.example
└── CLAUDE.md
```

---

## Environment Variables

Copy `.env.example` to `.env` before running anything.

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | yes | `postgresql://aipm_user:<pw>@postgres:5432/aipm` |
| `POSTGRES_PASSWORD` | yes | Passed to the postgres container |
| `REDIS_URL` | yes | `redis://redis:6379` |
| `JWT_SECRET` | yes | ≥ 48 random chars — generate with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `ANTHROPIC_API_KEY` | yes | `sk-ant-…` |
| `VITE_API_URL` | no | Defaults to `/api`; set to `http://localhost:3000` for local dev without Docker |
| `PORT` | no | Backend port, default `3000` |
| `NODE_ENV` | no | `production` / `development` |
| `FRONTEND_URL` | no | Explicit CORS allow-list for your public domain |
| `UPLOADS_PATH` | no | File storage root, default `/app/uploads` |
| `STORAGE_QUOTA_KB` | no | Default per-user quota in KB, default `524288` (512 MB) |
| `CLEANUP_INTERVAL_MS` | no | Orphan-cleanup interval in ms, default `21600000` (6 h) |

---

## Running the Project

### Docker Compose (recommended)
```bash
cp .env.example .env          # fill in secrets
docker compose up --build -d  # starts postgres, redis, backend, frontend
# Frontend: http://localhost:80
# Backend:  http://localhost:3000
# Health:   http://localhost:3000/api/health
```

### Local development (without Docker)
```bash
# Start postgres and redis however you like, then:
cd backend && npm install && node index.js   # port 3000
cd frontend && npm install && npm run dev    # port 5173 (Vite)
```

Migrations run automatically on every `node index.js` start — they are idempotent and use `IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS`.

---

## Database Schema

All foreign keys use `ON DELETE CASCADE`.

```
users            id, email, password_hash, name, storage_quota_kb, created_at
workspaces       id, user_id, type(private|business|work), label, created_at
projects         id, workspace_id, name, emoji, goal, due_label, cost,
                 token_used, token_limit(default 200000), needs_you(JSONB),
                 employer_note, created_at
milestones       id, project_id, name, status, position, created_at
tasks            id, milestone_id, name, status, agent, model, position, created_at
agents           id, project_id, name, emoji, model, status, cost,
                 tasks_total, tasks_done, created_at
thread_messages  id, project_id, from_type, name, avatar, type, label, text,
                 bullets(JSONB), fields(JSONB), deliverables(JSONB), created_at
notifications    id, user_id, type, level, read, title, summary, detail,
                 project, agent, actions(JSONB), token_used, token_limit, created_at
outputs          id, task_id(nullable), agent, filename, filepath, size_kb,
                 user_id, created_at
agent_runs       id, project_id, agent_id, task_id, tokens_input, tokens_output,
                 tokens_total, cost, model, budget_enforced, created_at
```

### Adding a migration
1. Create `backend/migrations/00N_description.sql` — use `IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS` throughout.
2. The runner executes files in alphabetical order on the next boot; no manual step needed.

---

## Authentication

- **JWT** — 7-day expiry, payload `{ sub, email, name }`, signed with `JWT_SECRET`.
- **Middleware** — `requireAuth` (`middleware/auth.js`) populates `req.user = { id, email, name }`.
- **Frontend** — token stored in `localStorage` as `aipm_token`; Axios interceptor attaches it as `Authorization: Bearer <token>`.
- All data is scoped to `req.user.id` through workspace ownership — users cannot touch another user's data.

---

## API Routes

Base: `http://localhost:3000/api`

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/auth/register` | — | Create account, returns JWT |
| POST | `/auth/login` | — | Verify credentials, returns JWT |
| GET | `/auth/me` | ✓ | Current user profile |
| GET/POST/PUT/DELETE | `/workspaces[/:id]` | ✓ | Workspace CRUD |
| GET/POST/PUT/DELETE | `/projects[/:id]` | ✓ | Project CRUD |
| GET | `/projects/:id/token-usage` | ✓ | Token metrics + per-run history |
| GET | `/projects/:id/budget-status` | ✓ | ok \| warning \| critical \| exceeded |
| GET/POST/PUT/DELETE | `/milestones[/:id]` | ✓ | Milestone CRUD |
| GET/POST/PUT/DELETE | `/tasks[/:id]` | ✓ | Task CRUD |
| POST | `/tasks/:id/run` | ✓ | Execute agent for task, saves `.md` output |
| GET/POST/PUT/DELETE | `/agents[/:id]` | ✓ | Agent CRUD |
| POST | `/agents/:id/run` | ✓ | Ad-hoc agent execution |
| POST | `/chat` | ✓ | Stateless AIPM chat |
| POST | `/chat/project/:projectId` | ✓ | Project-scoped chat (persists thread) |
| GET | `/chat/project/:projectId/thread` | ✓ | Thread history (limit/offset) |
| GET | `/notifications/stream` | token param | SSE stream (token as `?token=<jwt>`) |
| GET/POST/PATCH/DELETE | `/notifications[/:id]` | ✓ | Notification CRUD / mark-read |
| GET | `/outputs/storage-usage` | ✓ | `{ usedKb, quotaKb, availableKb, percentUsed }` |
| GET | `/outputs?task_id=` | ✓ | List outputs for a task |
| GET | `/outputs/:id/download` | ✓ | Stream file from disk |
| DELETE | `/outputs/:id` | ✓ | Delete record + file |
| GET | `/health` | — | Service health check |

---

## AI Agent Architecture

### AIPM Orchestrator
`sendAIPMMessage()` in `services/anthropic.js` — stateful multi-turn conversation. Accepts a full messages array plus a `projectContext` JSON blob injected into the system prompt. Used by `/chat`.

### Specialist Sub-agents
`runSubAgent(agentType, taskDescription, projectContext, outputFilename)` — one-shot call. Agent types and their system prompts live in `services/agentPrompts.js`:
`Research`, `Code`, `Design`, `Strategy`, `Marketing`, `Analysis`, `Writing`, `QA`, `DevOps`, `Security`, `Data`, `Product`.

**Response format convention** — every sub-agent must start its response with:
```
LINE 1:  LABEL IN ALL CAPS
Lines 2+: Key: Value pairs (until blank line or # header)
Rest:     Free-form prose / deliverable content
```
`parseAgentResponse()` extracts `label` and `fields`; `buildMarkdownFile()` wraps everything into the stored `.md` file.

### Model
All agents use `claude-sonnet-4-6`. Pricing baked into `services/anthropic.js`:
- Input: `$0.000003 / token`
- Output: `$0.000015 / token`

---

## Token Budget System

`middleware/tokenBudget.js` — wrap any agent-execution route with `createTokenBudgetGuard(resolveIdsFn)`.

**Thresholds:**
- ≥ 80% used → `warning` notification sent via SSE (non-blocking)
- ≥ 95% used → `critical` notification sent via SSE (non-blocking)
- = 100% used → HTTP 429, blocked run logged to `agent_runs` with `budget_enforced = true`

Each project has `token_limit` (default 200,000). `addTokenUsage()` in `services/tokenTracker.js` increments `projects.token_used` and appends an `agent_runs` audit row after every successful execution.

---

## File Output Management

Files are stored at `UPLOADS_PATH/<userId>/<projectId>/<filename>.md` and tracked in the `outputs` table.

### Key invariants — always follow these when writing code that touches files:

1. **Sanitize filenames** — call `sanitizeFilename(name)` from `services/fileManager.js` on any user-supplied or agent-generated filename before use. It strips path separators, control characters, and null bytes.

2. **Validate paths** — after constructing a full path with `path.join()`, call `validateUploadPath(filepath)` which throws HTTP 400 if the resolved path escapes `UPLOADS_PATH`.

3. **Enforce quota** — before writing a new file, call `checkUserQuota(userId, sizeKb)`. It throws HTTP 507 if `usedKb + sizeKb > storage_quota_kb`. The pattern used in `tasks.js` and `agents.js` is:
   ```js
   await checkUserQuota(userId, 0);            // early gate (fail fast)
   // ... run agent ...
   const sizeKb = Math.ceil(Buffer.byteLength(content, 'utf8') / 1024);
   await checkUserQuota(userId, sizeKb);        // definitive check
   ```

4. **Store user_id** — every `INSERT INTO outputs` must include `user_id` so the quota query works correctly.

5. **Orphan cleanup** — `cleanupOrphanFiles()` runs every 6 hours (configurable via `CLEANUP_INTERVAL_MS`). Pass A removes DB rows whose files are gone from disk; Pass B removes disk files with no DB row.

---

## Real-Time Notifications (SSE)

- Browser opens `GET /api/notifications/stream?token=<jwt>` (EventSource cannot send headers, so JWT travels as a query param).
- Backend subscribes to Redis channel `notifications:<userId>`.
- Any code that wants to push a notification does:
  ```js
  const { rows } = await pool.query(`INSERT INTO notifications … RETURNING *`, [...]);
  await redis.publish(`notifications:${userId}`, JSON.stringify(rows[0]));
  ```
- Redis publish is always wrapped in try/catch — it is best-effort and must never crash the main request flow.
- The server sends a heartbeat comment every 25 seconds to keep the connection alive through proxies.

---

## Frontend Conventions

- **API calls** — use `src/services/api.js` (Axios instance). JWT is attached automatically. Never construct raw `fetch` calls.
- **Global state** — `AppContext` holds `user`, `workspaces`, `activeProject`, and `notifications`. Update via the context setters, not local state.
- **SSE** — the `EventSource` is opened in `AppContext` on login and torn down on logout. Components subscribe to notifications through the context.
- **Styling** — Tailwind CSS utility classes only. No separate CSS files for new components.
- **Component names** — PascalCase files in `src/components/` (sub-directories by domain: `layout/`, `project/`, `notifications/`, `ui/`).

---

## Code Conventions

### Backend
- All route files follow the pattern: imports → `router.use(requireAuth)` → route handlers → `module.exports = router`.
- Database queries use parameterised `pool.query(sql, [values])` — never string interpolation.
- Access control is enforced inside every SQL query by joining through `workspaces` to `user_id` — do not rely solely on application-level checks.
- Errors are caught in each handler: `console.error('[ROUTE label]', err.message)` then `res.status(500).json({ error: err.message })`.
- Services (`services/`) contain pure business logic with no Express imports.

### Migrations
- Files must be idempotent: `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`.
- Name format: `NNN_short_description.sql` (zero-padded three digits).

### Git
- Development branch: `claude/build-aipm-app-rORqn`
- Commit messages: imperative present tense, `feat:` / `fix:` / `chore:` prefix.
- Never push directly to `main` or `master`.

---

## Adding a New Agent Type

1. Add the system prompt to `AGENT_SYSTEM_PROMPTS` in `backend/services/agentPrompts.js` — key is the agent type string (e.g. `"Legal"`).
2. The response format (ALL CAPS label → key: value fields → prose) must be followed for `parseAgentResponse()` to work correctly.
3. No other backend changes are required — `runSubAgent()` resolves the prompt by key.
4. Optionally add the type to any frontend dropdowns in the agent creation UI.

---

## Adding a New API Route

1. Create `backend/routes/myroute.js` — export an Express router.
2. Mount it in `backend/index.js`: `app.use('/api/myroute', require('./routes/myroute'))`.
3. Apply `requireAuth` at the top of the router unless the endpoint is intentionally public.
4. Scope all queries to `req.user.id` through workspace ownership.

---

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| `403` on any route | JWT missing, expired, or wrong secret |
| `429` on agent run | Project `token_used ≥ token_limit` — raise `token_limit` or create a new project |
| `507` on agent run | User storage quota exhausted — delete old outputs or raise `storage_quota_kb` |
| SSE stream immediately closes | Redis not reachable, or `REDIS_URL` wrong |
| Migration fails on boot | SQL syntax error in a new `.sql` file, or DB not yet ready (check health-check order in `docker-compose.yml`) |
| File download 404 | File deleted from disk but DB record remains — orphan cleanup will fix it on next run, or trigger manually via `cleanupOrphanFiles()` |
