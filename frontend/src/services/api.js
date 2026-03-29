// ═══════════════════════════════════════════════════════════════════════════
// AIPM API Service — Axios instance with local JWT auth
// Token is stored in localStorage as 'aipm_token' after login/register.
// ═══════════════════════════════════════════════════════════════════════════

import axios from 'axios'

// ─── Axios Instance ──────────────────────────────────────────────────────────
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: { 'Content-Type': 'application/json' },
})

// ─── Request Interceptor — attach JWT Bearer token ───────────────────────────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('aipm_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
}, (error) => Promise.reject(error))

// ─── Response Interceptor — log errors ───────────────────────────────────────
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status  = error.response?.status
    const message = error.response?.data?.error || error.message
    console.error(`[api] ${status || 'Network'} error: ${message}`, error.config?.url)
    // Auto-clear invalid tokens
    if (status === 401) {
      localStorage.removeItem('aipm_token')
      localStorage.removeItem('aipm_user')
    }
    return Promise.reject(error)
  }
)

// ─── Auth ────────────────────────────────────────────────────────────────────
export const auth = {
  register:    (data) => api.post('/auth/register', data).then(r => r.data),
  login:       (data) => api.post('/auth/login',    data).then(r => r.data),
  me:          ()     => api.get('/auth/me').then(r => r.data),
  generateToken: ()   => api.post('/auth/token').then(r => r.data),
}

// ─── Workspaces ──────────────────────────────────────────────────────────────
export const workspaces = {
  list:   ()         => api.get('/workspaces').then(r => r.data),
  create: (data)     => api.post('/workspaces', data).then(r => r.data),
  update: (id, data) => api.put(`/workspaces/${id}`, data).then(r => r.data),
  remove: (id)       => api.delete(`/workspaces/${id}`).then(r => r.data),
}

// ─── Projects ────────────────────────────────────────────────────────────────
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

// ─── Milestones ──────────────────────────────────────────────────────────────
export const milestones = {
  list:   (projectId) => api.get('/milestones', { params: { project_id: projectId } }).then(r => r.data),
  create: (data)      => api.post('/milestones', data).then(r => r.data),
  update: (id, data)  => api.put(`/milestones/${id}`, data).then(r => r.data),
  remove: (id)        => api.delete(`/milestones/${id}`).then(r => r.data),
}

// ─── Tasks ───────────────────────────────────────────────────────────────────
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

// ─── Agents ──────────────────────────────────────────────────────────────────
export const agents = {
  list:   (projectId) => api.get('/agents', { params: { project_id: projectId } }).then(r => r.data),
  create: (data)           => api.post('/agents', data).then(r => r.data),
  update: (id, data)       => api.put(`/agents/${id}`, data).then(r => r.data),
  remove: (id)             => api.delete(`/agents/${id}`).then(r => r.data),
  run:    (agentId, body)  => api.post(`/agents/${agentId}/run`, body).then(r => r.data),
}

// ─── Notifications ───────────────────────────────────────────────────────────
export const notifications = {
  list:        (params = {}) => api.get('/notifications', { params }).then(r => r.data),
  create:      (data)        => api.post('/notifications', data).then(r => r.data),
  markRead:    (id)          => api.patch(`/notifications/${id}`, { read: true }).then(r => r.data),
  markAllRead: ()            => api.patch('/notifications/mark-all-read').then(r => r.data),
  remove:      (id)          => api.delete(`/notifications/${id}`).then(r => r.data),
}

// ─── Outputs ─────────────────────────────────────────────────────────────────
export const outputs = {
  list:     (filters = {}) => api.get('/outputs', { params: filters }).then(r => r.data),
  download: (id)           => `${api.defaults.baseURL}/outputs/${id}/download`,
  remove:   (id)           => api.delete(`/outputs/${id}`).then(r => r.data),
}

// ─── Chat ─────────────────────────────────────────────────────────────────────
export const chat = {
  send:          (messages, context = {}) => api.post('/chat', { messages, context }).then(r => r.data),
  sendToProject: (projectId, message, history = []) =>
    api.post(`/chat/project/${projectId}`, { message, history }).then(r => r.data),
  getThread:     (projectId) => api.get(`/chat/project/${projectId}/thread`).then(r => r.data),
}

export default api
