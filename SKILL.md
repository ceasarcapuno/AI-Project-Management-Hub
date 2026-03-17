# AIPM — OpenClaw Skill

**Skill ID**: `aipm`
**Version**: 1.0.0
**Author**: ceasarcapuno
**Description**: Interact with the AI Project Management Hub (AIPM) — a self-hosted app that orchestrates specialist AI sub-agents across workspaces, projects, milestones, and tasks. Use this skill to manage projects, trigger agent runs, read thread history, and monitor notifications on behalf of the user.

---

## Base URL

```
http://<AIPM_HOST>/api
```

Set `AIPM_HOST` to the VPS address and port where AIPM is running (e.g. `187.77.77.46:80`).

## Authentication

All endpoints (except `/auth/register`, `/auth/login`, `/health`) require a JWT Bearer token.

```
Authorization: Bearer <AIPM_JWT_TOKEN>
```

Store the token as `AIPM_JWT_TOKEN` in your secrets. Token expiry is 7 days. To refresh, call `POST /auth/login`.

---

## Capabilities

| Capability | Endpoint |
|---|---|
| Login / get token | `POST /auth/login` |
| Health check | `GET /health` |
| List workspaces | `GET /workspaces` |
| Create workspace | `POST /workspaces` |
| List projects | `GET /projects?workspace_id=<id>` |
| Create project | `POST /projects` |
| Get full project detail | `GET /projects/:id` |
| Update project | `PUT /projects/:id` |
| List milestones | `GET /milestones?project_id=<id>` |
| Create milestone | `POST /milestones` |
| Update milestone status | `PUT /milestones/:id` |
| List tasks | `GET /tasks?project_id=<id>` |
| Create task | `POST /tasks` |
| Update task | `PUT /tasks/:id` |
| Run a task (triggers AI agent) | `POST /tasks/:id/run` |
| List agents | `GET /agents?project_id=<id>` |
| Create agent | `POST /agents` |
| Run agent ad-hoc | `POST /agents/:id/run` |
| Download output file | `GET /outputs/:id/download` |
| Send chat message to project | `POST /chat/project/:projectId` |
| Read project thread history | `GET /chat/project/:projectId/thread` |
| List notifications | `GET /notifications` |
| Mark notification read | `PATCH /notifications/:id` |

---

## Endpoint Reference

### Health Check

```
GET /health
Auth: No
```

Response:
```json
{ "status": "ok", "service": "aipm-backend", "version": "2.0.0" }
```

Use this to confirm AIPM is reachable before other calls.

---

### Auth

#### Login
```
POST /auth/login
Auth: No
Body: { "email": "...", "password": "..." }
```
Response: `{ "token": "eyJ...", "user": { "id", "email", "name" } }`

#### Get current user
```
GET /auth/me
Auth: Bearer
```
Response: `{ "id", "email", "name", "created_at" }`

---

### Workspaces

#### List all workspaces
```
GET /workspaces
Auth: Bearer
```
Response: Array of `{ id, label, type, created_at }`

Workspace `type` values: `private` | `business` | `work`

#### Create workspace
```
POST /workspaces
Auth: Bearer
Body: { "label": "My Workspace", "type": "work" }
```
`type` is optional (default: `private`).

#### Update workspace
```
PUT /workspaces/:id
Auth: Bearer
Body: { "label": "...", "type": "..." }
```

#### Delete workspace
```
DELETE /workspaces/:id
Auth: Bearer
```

---

### Projects

#### List projects
```
GET /projects?workspace_id=<uuid>
Auth: Bearer
```
`workspace_id` is optional but recommended. Returns all user projects if omitted.

Key response fields per project:
- `id`, `name`, `goal`, `emoji`, `due_label`
- `token_used` — cumulative tokens consumed
- `token_limit` — soft cap (default 200,000)
- `cost` — cumulative USD cost

#### Create project
```
POST /projects
Auth: Bearer
Body:
{
  "workspace_id": "<uuid>",   ← required
  "name": "Project Name",     ← required
  "goal": "What to achieve",
  "emoji": "📱",
  "due_label": "Apr 30",
  "employer_note": "Notes for the agent team"
}
```

#### Get full project detail
```
GET /projects/:id
Auth: Bearer
```
Returns project + all nested `milestones`, `tasks`, `agents`, `outputs`, and `thread_messages` in one call. Use this for full context before running agents.

#### Update project
```
PUT /projects/:id
Auth: Bearer
Body: any subset of { name, goal, emoji, due_label, employer_note, needs_you, token_limit }
```

#### Delete project
```
DELETE /projects/:id
Auth: Bearer
```

---

### Milestones

#### List milestones
```
GET /milestones?project_id=<uuid>
Auth: Bearer
```
Response fields: `id`, `project_id`, `name`, `status`, `position`

Status values: `todo` | `in_progress` | `done`

#### Create milestone
```
POST /milestones
Auth: Bearer
Body:
{
  "project_id": "<uuid>",   ← required
  "name": "Phase 1: Research",
  "status": "todo",         ← optional, default: "todo"
  "position": 0             ← optional, for ordering
}
```

#### Update milestone
```
PUT /milestones/:id
Auth: Bearer
Body: any subset of { name, status, position }
```

#### Delete milestone
```
DELETE /milestones/:id
Auth: Bearer
```

---

### Tasks

#### List tasks
```
GET /tasks?project_id=<uuid>&milestone_id=<uuid>
Auth: Bearer
```
`milestone_id` is optional. Both params accepted.

Response fields: `id`, `milestone_id`, `name`, `status`, `agent`, `model`, `position`

Status values: `todo` | `in_progress` | `done`

#### Create task
```
POST /tasks
Auth: Bearer
Body:
{
  "milestone_id": "<uuid>",   ← required
  "name": "Research competitors",
  "status": "todo",
  "agent": "Research Agent",  ← name of the agent that will execute this
  "model": "claude-sonnet-4-6",
  "position": 0
}
```

#### Update task
```
PUT /tasks/:id
Auth: Bearer
Body: any subset of { name, status, agent, model, position }
```

#### Run task (triggers assigned AI agent)
```
POST /tasks/:id/run
Auth: Bearer
Body: none
```

The task must have an `agent` field set. AIPM will:
1. Load the task and full project context
2. Call the assigned specialist sub-agent via Anthropic Claude
3. Write output to a file
4. Save the output and thread message to the database
5. Update project token/cost totals
6. Emit a notification

Response:
```json
{
  "threadMessage": {
    "id": "uuid",
    "from_type": "agent",
    "name": "Research Agent",
    "type": "report",
    "text": "First 1000 chars of output...",
    "deliverables": [{ "label": "filename.md", "status": "completed", "output_id": "uuid" }]
  },
  "output": {
    "id": "uuid",
    "filename": "research-agent-...-timestamp.md",
    "size_kb": 45
  },
  "tokensUsed": 2450,
  "cost": 0.045
}
```

#### Delete task
```
DELETE /tasks/:id
Auth: Bearer
```

---

### Agents

Agents are AI specialists scoped to a project. Available specialist types: Research, Code, Design, Strategy, Marketing, Analysis, Writing, QA, DevOps, Security, Data, Product.

#### List agents
```
GET /agents?project_id=<uuid>
Auth: Bearer
```
Response fields: `id`, `project_id`, `name`, `emoji`, `model`, `status`, `tasks_done`, `cost`

Status values: `waiting` | `idle` | `active` | `done`

#### Create agent
```
POST /agents
Auth: Bearer
Body:
{
  "project_id": "<uuid>",      ← required
  "name": "Research Agent",    ← required
  "emoji": "🔍",
  "model": "claude-sonnet-4-6",
  "status": "waiting"
}
```

#### Update agent
```
PUT /agents/:id
Auth: Bearer
Body: any subset of { name, emoji, model, status }
```

#### Run agent ad-hoc (no task required)
```
POST /agents/:id/run
Auth: Bearer
Body:
{
  "task_description": "Analyze the top 5 competitors and summarize their pricing",   ← required
  "output_filename": "competitor-analysis.md"   ← optional
}
```
Response: same shape as `POST /tasks/:id/run`.

#### Delete agent
```
DELETE /agents/:id
Auth: Bearer
```

---

### Outputs

#### List outputs for a task
```
GET /outputs?task_id=<uuid>
Auth: Bearer
```

#### Download output file
```
GET /outputs/:id/download
Auth: Bearer
```
Returns the file as a binary download attachment.

#### Delete output
```
DELETE /outputs/:id
Auth: Bearer
```
Removes both the database record and the file from disk.

---

### Chat

#### Send a message to a project (persisted to thread)
```
POST /chat/project/:projectId
Auth: Bearer
Body:
{
  "message": "What should the Research Agent focus on first?",   ← required
  "history": [                                                    ← optional
    { "role": "user", "content": "Previous question" },
    { "role": "assistant", "content": "Previous answer" }
  ]
}
```
AIPM loads full project context (milestones, tasks, agents) before calling Claude. Both the user message and AI reply are persisted to the thread.

Response:
```json
{
  "message": { "id", "from_type": "aipm", "text": "..." },
  "userMessage": { "id", "from_type": "user", "text": "..." },
  "tokens": { "input": 350, "output": 420, "total": 770 },
  "cost": 0.012
}
```

#### Read project thread history
```
GET /chat/project/:projectId/thread?limit=100&offset=0
Auth: Bearer
```
Returns all messages (user, aipm, agent) in chronological order. `from_type` values: `user` | `aipm` | `agent`.

#### Stateless chat (no persistence)
```
POST /chat
Auth: Bearer
Body:
{
  "messages": [{ "role": "user", "content": "..." }],
  "context": { "projectName": "optional context object" }
}
```

---

### Notifications

#### List notifications
```
GET /notifications?unread_only=true
Auth: Bearer
```
Key fields: `id`, `type`, `level`, `title`, `summary`, `project`, `agent`, `token_used`, `read`, `actions`

`level` values: `info` | `success` | `warning` | `error`

#### Mark as read
```
PATCH /notifications/:id
Auth: Bearer
Body: { "read": true }
```

#### Mark all as read
```
PATCH /notifications/mark-all-read
Auth: Bearer
Body: none
```

#### Create notification (manual)
```
POST /notifications
Auth: Bearer
Body:
{
  "title": "Deployment ready",              ← required
  "type": "system",                          ← optional
  "level": "success",
  "summary": "Short summary",
  "detail": "Extended information",
  "project": "<project-uuid>",
  "agent": "DevOps Agent",
  "actions": [{ "label": "View", "url": "/projects/..." }],
  "token_used": 2450,
  "token_limit": 100000
}
```

#### Delete notification
```
DELETE /notifications/:id
Auth: Bearer
```

---

## Common Workflows

### Start a new project from scratch
1. `GET /workspaces` — find or note workspace ID
2. `POST /projects` — create project with name, goal, emoji
3. `POST /milestones` — create milestones (phases)
4. `POST /tasks` — create tasks under each milestone, set `agent` field
5. `POST /agents` — create the specialist agents used by tasks
6. `POST /tasks/:id/run` — execute tasks one at a time or in sequence

### Check project status
1. `GET /projects/:id` — returns full nested view including all milestones, tasks, agents, and thread messages in one call

### Run an agent for a one-off question
1. `GET /agents?project_id=<id>` — find agent ID
2. `POST /agents/:id/run` with `task_description`

### Catch up on what happened
1. `GET /notifications?unread_only=true` — see recent events
2. `GET /chat/project/:projectId/thread` — read full conversation history
3. `PATCH /notifications/mark-all-read` — clear the queue

---

## Error Handling

All errors return JSON:
```json
{ "error": "Human-readable message" }
```

| HTTP Status | Meaning |
|---|---|
| 400 | Bad request / missing required field |
| 401 | Invalid or expired JWT |
| 403 | Access denied (resource belongs to another user) |
| 404 | Resource not found |
| 409 | Conflict (e.g. duplicate email) |
| 429 | Rate limit exceeded (20 req/15min for chat, 100 req/15min for others) |
| 500 | Server error / agent execution failed |

---

## Secrets Required

| Secret Name | Value |
|---|---|
| `AIPM_HOST` | Host + port of AIPM (e.g. `187.77.77.46:80`) |
| `AIPM_JWT_TOKEN` | JWT from `POST /auth/login` (7-day expiry) |
| `AIPM_EMAIL` | Login email (to refresh token when expired) |
| `AIPM_PASSWORD` | Login password (to refresh token when expired) |
