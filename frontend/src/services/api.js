// ═══════════════════════════════════════════════════════════════════════════
// AIPM API Service — Axios instance with Supabase auth interceptor
// ═══════════════════════════════════════════════════════════════════════════

import axios from 'axios'
import { supabase } from './supabase'

// ─── Axios Instance ──────────────────────────────────────────────────────────
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  headers: { 'Content-Type': 'application/json' },
})

// ─── Request Interceptor — attach Supabase Bearer token ──────────────────────
api.interceptors.request.use(async (config) => {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.access_token) {
      config.headers.Authorization = `Bearer ${session.access_token}`
    }
  } catch (err) {
    console.warn('[api] Could not retrieve Supabase session:', err)
  }
  return config
}, (error) => Promise.reject(error))

// ─── Response Interceptor — log errors ───────────────────────────────────────
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status  = error.response?.status
    const message = error.response?.data?.message || error.message
    console.error(`[api] ${status || 'Network'} error: ${message}`, error.config?.url)
    return Promise.reject(error)
  }
)

// ═══════════════════════════════════════════════════════════════════════════
// ─── Workspaces ─────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════
export const workspaces = {
  list:   ()         => api.get('/workspaces').then(r => r.data),
  create: (data)     => api.post('/workspaces', data).then(r => r.data),
  update: (id, data) => api.put(`/workspaces/${id}`, data).then(r => r.data),
  remove: (id)       => api.delete(`/workspaces/${id}`).then(r => r.data),
}

// ═══════════════════════════════════════════════════════════════════════════
// ─── Projects ───────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════
export const projects = {
  list:   (workspaceId) => {
    const params = workspaceId ? { workspace_id: workspaceId } : {}
    return api.get('/projects', { params }).then(r => r.data)
  },
  get:    (id)       => api.get(`/projects/${id}`).then(r => r.data),
  create: (data)     => api.post('/projects', data).then(r => r.data),
  update: (id, data) => api.put(`/projects/${id}`, data).then(r => r.data),
  remove: (id)       => api.delete(`/projects/${id}`).then(r => r.data),
}

// ═══════════════════════════════════════════════════════════════════════════
// ─── Milestones ─────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════
export const milestones = {
  list:   (projectId)    => api.get(`/projects/${projectId}/milestones`).then(r => r.data),
  create: (data)         => api.post('/milestones', data).then(r => r.data),
  update: (id, data)     => api.put(`/milestones/${id}`, data).then(r => r.data),
  remove: (id)           => api.delete(`/milestones/${id}`).then(r => r.data),
}

// ═══════════════════════════════════════════════════════════════════════════
// ─── Tasks ──────────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════
export const tasks = {
  list:   (projectId, milestoneId) => {
    const params = { project_id: projectId }
    if (milestoneId) params.milestone_id = milestoneId
    return api.get('/tasks', { params }).then(r => r.data)
  },
  create: (data)     => api.post('/tasks', data).then(r => r.data),
  update: (id, data) => api.put(`/tasks/${id}`, data).then(r => r.data),
  remove: (id)       => api.delete(`/tasks/${id}`).then(r => r.data),
  run:    (taskId)   => api.post(`/tasks/${taskId}/run`).then(r => r.data),
}

// ═══════════════════════════════════════════════════════════════════════════
// ─── Agents ─────────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════
export const agents = {
  list:   (projectId) => {
    const params = projectId ? { project_id: projectId } : {}
    return api.get('/agents', { params }).then(r => r.data)
  },
  create: (data)          => api.post('/agents', data).then(r => r.data),
  update: (id, data)      => api.put(`/agents/${id}`, data).then(r => r.data),
  remove: (id)            => api.delete(`/agents/${id}`).then(r => r.data),
  run:    (agentId, body) => api.post(`/agents/${agentId}/run`, body).then(r => r.data),
}

// ═══════════════════════════════════════════════════════════════════════════
// ─── Notifications ──────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════
export const notifications = {
  list:       ()   => api.get('/notifications').then(r => r.data),
  create:     (data) => api.post('/notifications', data).then(r => r.data),
  markRead:   (id) => api.put(`/notifications/${id}/read`).then(r => r.data),
  markAllRead: ()  => api.put('/notifications/read-all').then(r => r.data),
  remove:     (id) => api.delete(`/notifications/${id}`).then(r => r.data),
}

// ═══════════════════════════════════════════════════════════════════════════
// ─── Outputs ────────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════
export const outputs = {
  list:           (filters = {}) => api.get('/outputs', { params: filters }).then(r => r.data),
  getDownloadUrl: (id)           => api.get(`/outputs/${id}/download`).then(r => r.data),
  remove:         (id)           => api.delete(`/outputs/${id}`).then(r => r.data),
}

// ═══════════════════════════════════════════════════════════════════════════
// ─── Chat ───────────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════
export const chat = {
  /** Global chat — sends messages array with optional context object */
  send: (messages, context = {}) =>
    api.post('/chat', { messages, context }).then(r => r.data),

  /** Project-scoped chat — sends to a specific project thread */
  sendToProject: (projectId, message, history = []) =>
    api.post(`/projects/${projectId}/chat`, { message, history }).then(r => r.data),

  /** Fetch the thread messages for a project */
  getThread: (projectId) =>
    api.get(`/projects/${projectId}/thread`).then(r => r.data),
}

export default api
