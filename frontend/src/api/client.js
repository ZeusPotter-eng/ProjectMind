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
