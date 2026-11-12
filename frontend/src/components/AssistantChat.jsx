import { useEffect, useRef, useState } from 'react'
import { getAssistantStatus, listProjects, sendAssistantMessage } from '../api/client'
import './assistantChat.css'

const WELCOME = 'Hola, soy ProjectMind AI. Selecciona un proyecto y pregúntame por sus avances, tareas, responsables, fechas o bloqueos. Consultaré los datos a los que tienes acceso.'
const SUGGESTIONS = [
  'Resume el avance real de este proyecto y sus próximos pasos.',
  '¿Cuántas tareas hay completadas, pendientes, en curso y bloqueadas?',
  '¿Qué tareas están vencidas y quiénes son sus responsables?',
]

export default function AssistantChat({ getAccessToken, mode = 'widget' }) {
  const [open, setOpen] = useState(false)
  const [projects, setProjects] = useState([])
  const [projectId, setProjectId] = useState('')
  const [provider, setProvider] = useState('')
  const [configured, setConfigured] = useState(false)
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [contextStatus, setContextStatus] = useState(null)
  const [expanded, setExpanded] = useState(false)
  const endRef = useRef(null)
  const pendingRef = useRef(false)
  const visible = mode === 'page' || open

  useEffect(() => {
    let active = true
    Promise.allSettled([listProjects(getAccessToken, { limit: 100 }), getAssistantStatus()]).then(([result, status]) => {
      if (!active) return
      if (result.status === 'fulfilled') {
        const items = result.value.items || []
        setProjects(items)
        setProjectId(previous => (items.some(p => p.id === previous) ? previous : (items[0]?.id || '')))
      } else setError(`No fue posible consultar los proyectos: ${result.reason?.message || 'error de conexión'}`)
      if (status.status === 'fulfilled') {
        setProvider(status.value.provider || '')
        setConfigured(Boolean(status.value.configured))
      }
    })
    return () => { active = false }
  }, [getAccessToken])

  useEffect(() => { if (visible) endRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' }) }, [messages, visible, busy])

  async function send(text = draft) {
    const question = text.trim()
    if (!question || busy || pendingRef.current) return
    pendingRef.current = true
    const history = messages.slice(-8).map(item => ({ role: item.role, content: item.content.slice(0, 2000) }))
    setMessages(previous => [...previous, { role: 'user', content: question }])
    setDraft('')
    setBusy(true)
    setError('')
    setContextStatus(null)
    try {
      const result = await sendAssistantMessage(getAccessToken, question, projectId || null, history)
      setMessages(previous => [...previous, { role: 'assistant', content: result.answer || 'El proveedor no devolvió texto.' }])
      setContextStatus(result.context_loaded ? { project: result.project_name, counts: result.context_counts } : { project: null })
      if (result.provider) setProvider(result.provider)
    } catch (exc) {
      setError(exc.message || 'Error al consultar el asistente.')
    } finally {
      pendingRef.current = false
      setBusy(false)
    }
  }

  function changeProject(value) {
    if (busy) return
    setProjectId(value)
    setMessages([])
    setContextStatus(null)
    setError('')
  }

  function clearChat() { if (!busy) { setMessages([]); setError(''); setContextStatus(null); setDraft('') } }
  function handleKeys(event) {
    if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send() }
  }

  const selected = projects.find(p => p.id === projectId)
  return <>
    {mode === 'widget' && !open && <button type="button" className="pm-chat-launcher" onClick={() => setOpen(true)} aria-label="Abrir chat ProjectMind AI" title="Chat ProjectMind AI"><span aria-hidden="true">✦</span> IA</button>}
    {visible && <section className={`pm-chat ${mode === 'page' ? 'pm-chat-page' : 'pm-chat-widget'} ${expanded && mode === 'widget' ? 'pm-chat-expanded' : ''}`} aria-label="Conversación con ProjectMind AI">
      {mode === 'page' && <div className="pm-chat-page-heading"><span className="eyebrow">INTELIGENCIA ARTIFICIAL · ASISTENTE</span><h1>Habla con ProjectMind AI</h1><p>Consulta información real de tus proyectos con tu sesión. Para ejecutar cambios utiliza Propuestas IA y sus permisos.</p></div>}
      <div className="pm-chat-shell">
        <div className="pm-chat-header"><div className="pm-chat-symbol">✦</div><div className="pm-chat-header-text"><strong>ProjectMind AI</strong><small>Asistente contextual de gestión de proyectos</small></div><div className="pm-chat-header-actions">{mode === 'widget' && <button type="button" onClick={() => setExpanded(v => !v)}>{expanded ? 'Reducir' : 'Ampliar'} ↗</button>}<button type="button" onClick={clearChat} disabled={busy}>Limpiar</button>{mode === 'widget' && <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar chat">×</button>}</div></div>
        <div className="pm-chat-toolbar"><label htmlFor="pm-chat-project">Proyecto de referencia</label><select id="pm-chat-project" value={projectId} onChange={e => changeProject(e.target.value)} disabled={busy}><option value="">Sin proyecto (conversación general)</option>{projects.map(p => <option value={p.id} key={p.id}>{p.name}</option>)}</select><span className="pm-chat-provider"><span className={configured ? 'pm-chat-light' : 'pm-chat-light pm-chat-off'}/> Proveedor: {provider || 'sin configurar'}</span></div>
        <div className="pm-chat-messages" role="log" aria-live="polite">
          <div className="pm-chat-message assistant"><span className="pm-chat-role">ProjectMind AI</span>{WELCOME}</div>
          {messages.map((msg, index) => <div className={`pm-chat-message ${msg.role}`} key={`${index}-${msg.role}`}><span className="pm-chat-role">{msg.role === 'user' ? 'Tú' : 'ProjectMind AI'}</span>{msg.content}</div>)}
          {busy && <div className="pm-chat-message assistant"><span className="pm-chat-role">ProjectMind AI</span>Consultando {selected ? `los datos de ${selected.name}` : 'el modelo'}…</div>}
          <div ref={endRef}/>
        </div>
        <div className="pm-chat-compose">
          {contextStatus && <p className="pm-chat-evidence">{contextStatus.project ? `✓ Datos consultados con tus permisos: ${contextStatus.project} · ${contextStatus.counts?.tasks ?? 0} tareas` : 'Respuesta general, sin datos de proyecto.'}</p>}
          {error && <p className="pm-chat-error" role="alert">{error} <small>Verifica la API, el JWT y los registros del backend.</small></p>}
          {messages.length === 0 && projectId && <div className="pm-chat-suggestions">{SUGGESTIONS.map(s => <button type="button" onClick={() => send(s)} disabled={busy} key={s}>{s}</button>)}</div>}
          <label htmlFor="pm-chat-input">Escribe tu mensaje</label>
          <textarea id="pm-chat-input" rows={3} maxLength={8000} placeholder="Pregunta por avances, responsables, fechas, bloqueos…" value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={handleKeys} disabled={busy}/>
          <div className="pm-chat-sendline"><small>Enter para enviar · Shift+Enter para otra línea. La IA no modifica datos oficiales.</small><button type="button" disabled={busy || !draft.trim()} onClick={() => send()}>{busy ? 'Consultando…' : 'Enviar ↗'}</button></div>
        </div>
      </div>
    </section>}
  </>
}
