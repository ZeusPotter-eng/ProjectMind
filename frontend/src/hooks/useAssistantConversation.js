import { useCallback, useEffect, useRef, useState } from 'react'
import { listProjects, sendAssistantMessage } from '../api/client'
import { extractAssistantAnswer } from '../utils/assistantResponses'

/**
 * Único estado de chat para la vista principal y el panel flotante.
 * Las solicitudes siempre pasan por el backend autenticado de ProjectMind.
 * No almacenamos conversaciones ni tokens en localStorage.
 */
export default function useAssistantConversation(getAccessToken) {
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [projects, setProjects] = useState([])
  const [projectId, setProjectId] = useState('')
  const [loadingProjects, setLoadingProjects] = useState(true)
  const [projectsError, setProjectsError] = useState('')
  const busy = useRef(false)

  useEffect(() => {
    let active = true
    setLoadingProjects(true)
    listProjects(getAccessToken, { limit: 100 })
      .then((data) => {
        if (!active) return
        const items = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : []
        const available = items.filter(item => item?.id && item.status !== 'archived')
        setProjects(available)
        setProjectId(previous => available.some(item => item.id === previous) ? previous : available[0]?.id || '')
        setProjectsError('')
      })
      .catch(() => {
        if (!active) return
        setProjectsError('No se pudo consultar tus proyectos. Puedes probar el chat sin seleccionar uno.')
      })
      .finally(() => { if (active) setLoadingProjects(false) })
    return () => { active = false }
  }, [getAccessToken])

  const send = useCallback(async (raw = draft) => {
    const text = typeof raw === 'string' ? raw.trim() : ''
    if (!text || busy.current) return
    busy.current = true
    setSending(true)
    setMessages(items => [...items, { role: 'user', content: text }])
    setDraft('')
    try {
      const result = await sendAssistantMessage(getAccessToken, text, projectId || null)
      const answer = extractAssistantAnswer(result)
      setMessages(items => [...items, {
        role: answer ? 'assistant' : 'error',
        content: answer || 'El backend no devolvió una respuesta de texto válida. Verifica el contrato del endpoint /assistant/chat.',
      }])
    } catch (error) {
      setMessages(items => [...items, {
        role: 'error',
        content: `No fue posible consultar el asistente: ${error?.message || 'Error de conexión con el backend.'}`,
      }])
    } finally {
      busy.current = false
      setSending(false)
    }
  }, [draft, getAccessToken, projectId])

  const clear = useCallback(() => {
    if (busy.current) return
    setMessages([])
    setDraft('')
  }, [])

  return {
    messages, draft, setDraft, sending, send, clear,
    projects, projectId, setProjectId, loadingProjects, projectsError,
  }
}
