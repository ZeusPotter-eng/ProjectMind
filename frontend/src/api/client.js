const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1'
async function request(path, options={}) {
  const response = await fetch(`${API_URL}${path}`, { headers:{'Content-Type':'application/json', ...(options.headers||{})}, ...options })
  const data = await response.json().catch(()=>({}))
  if (!response.ok) throw new Error(data.detail ?? `Error ${response.status}`)
  return data
}
export const getHealth=()=>request('/health')
export const getModuleStatus=(module)=>request(`/${module}/status`)
export const getAssistantStatus=()=>request('/assistant/status')
export const sendAssistantMessage=(message, projectId=null)=>request('/assistant/chat',{method:'POST',body:JSON.stringify({message,project_id:projectId})})
