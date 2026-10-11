const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1'
const CRUD_TOKEN = import.meta.env.VITE_CRUD_CONSOLE_TOKEN ?? ''

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(data.detail ?? `Error ${response.status}`)
  }

  return data
}

function crudRequest(path, options = {}) {
  return request(path, {
    ...options,
    headers: {
      'X-CRUD-Token': CRUD_TOKEN,
      ...(options.headers || {}),
    },
  })
}

export const getHealth = () => request('/health')
export const getSupabaseHealth = () => request('/health/supabase')
export const getModuleStatus = (module) => request(`/${module}/status`)
export const getAssistantStatus = () => request('/assistant/status')
export const sendAssistantMessage = (message, projectId = null) =>
  request('/assistant/chat', {
    method: 'POST',
    body: JSON.stringify({ message, project_id: projectId }),
  })

export const getCrudStatus = () => request('/crud/status')
export const getCrudResources = () => crudRequest('/crud/resources')
export const listCrudRows = (resource, limit = 100, offset = 0) =>
  crudRequest(`/crud/${resource}?limit=${limit}&offset=${offset}`)

export const lookupCrudRow = (resource, key) =>
  crudRequest(`/crud/${resource}/lookup`, {
    method: 'POST',
    body: JSON.stringify({ key }),
  })

export const createCrudRow = (resource, data) =>
  crudRequest(`/crud/${resource}`, {
    method: 'POST',
    body: JSON.stringify({ data }),
  })

export const updateCrudRow = (resource, key, data) =>
  crudRequest(`/crud/${resource}`, {
    method: 'PATCH',
    body: JSON.stringify({ key, data }),
  })

export const deleteCrudRow = (resource, key) =>
  crudRequest(`/crud/${resource}`, {
    method: 'DELETE',
    body: JSON.stringify({ key }),
  })

// PM-12: Las credenciales se envían al backend, nunca a una llave administrativa.
export const getAuthStatus = () => request('/auth/status')
export const registerUser = (email, password) => request('/auth/register', { method: 'POST', body: JSON.stringify({ email, password }) })
export const loginUser = (email, password) => request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) })
export const refreshSession = (refresh_token) => request('/auth/refresh', { method: 'POST', body: JSON.stringify({ refresh_token }) })
export const getCurrentUser = (token) => request('/auth/me', { headers: { Authorization: `Bearer ${token}` } })
export const logoutUser = (token) => request('/auth/logout', { method: 'POST', headers: { Authorization: `Bearer ${token}` } })

// PM-13: proyectos con Supabase Auth + RLS. Nunca se expone service_role.
async function projectsRequest(path, getAccessToken, options = {}) {
  const token = await getAccessToken()
  return request(path, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, ...(options.headers || {}) },
  })
}

export const listProjects = (getAccessToken, { includeArchived = false, limit = 100, offset = 0 } = {}) =>
  projectsRequest(`/projects?include_archived=${includeArchived}&limit=${limit}&offset=${offset}`, getAccessToken)
export const createProject = (getAccessToken, data) =>
  projectsRequest('/projects', getAccessToken, { method: 'POST', body: JSON.stringify(data) })
export const updateProject = (getAccessToken, id, data) =>
  projectsRequest(`/projects/${encodeURIComponent(id)}`, getAccessToken, { method: 'PATCH', body: JSON.stringify(data) })
export const archiveProject = (getAccessToken, id) =>
  projectsRequest(`/projects/${encodeURIComponent(id)}/archive`, getAccessToken, { method: 'PATCH' })

// PM-15: integrantes; usa exactamente la sesión de PM-12 y los permisos RLS.
export const listProjectMembers = (getAccessToken, projectId) =>
  projectsRequest(`/projects/${encodeURIComponent(projectId)}/members`, getAccessToken)
export const addProjectMember = (getAccessToken, projectId, data) =>
  projectsRequest(`/projects/${encodeURIComponent(projectId)}/members`, getAccessToken,
    { method: 'POST', body: JSON.stringify(data) })
export const updateProjectMember = (getAccessToken, projectId, userId, data) =>
  projectsRequest(`/projects/${encodeURIComponent(projectId)}/members/${encodeURIComponent(userId)}`,
    getAccessToken, { method: 'PATCH', body: JSON.stringify(data) })
