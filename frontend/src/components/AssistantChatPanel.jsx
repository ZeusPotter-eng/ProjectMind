import { useEffect, useRef } from 'react'
import './assistant-chat.css'

const SUGGESTIONS = [
  { title: 'Analizar riesgos', prompt: 'Ayúdame a identificar riesgos habituales de mi proyecto y cómo priorizarlos.' },
  { title: 'Planificar tareas', prompt: 'Ayúdame a descomponer un objetivo de proyecto en tareas priorizadas.' },
  { title: 'Revisar avances', prompt: '¿Cómo puedo evaluar el avance de un proyecto con tareas, fechas y dependencias?' },
]

/** Componente de presentación. Su estado vive en App para no perder mensajes al navegar. */
export default function AssistantChatPanel({
  mode = 'page', messages = [], draft = '', onDraftChange, sending = false,
  onSend, onClear, onClose, onOpenFullPage,
  projects = [], projectId = '', onProjectChange, loadingProjects = false,
  projectsError = '', provider = '', providerConfigured = false,
}) {
  const lastMessageRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => { lastMessageRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' }) }, [messages, sending])
  useEffect(() => { if (mode === 'floating') inputRef.current?.focus() }, [mode])

  function submit(event) {
    event.preventDefault()
    onSend?.()
  }

  return (
    <section className={`pm-ai-chat pm-ai-chat--${mode}`} aria-label="Conversación con ProjectMind AI">
      <header className="pm-ai-chat__header">
        <div className="pm-ai-chat__brand" aria-hidden="true">✦</div>
        <div className="pm-ai-chat__title">
          <strong>ProjectMind AI</strong>
          <small>Asistente para la gestión de proyectos</small>
        </div>
        <div className="pm-ai-chat__header-actions">
          {mode === 'floating' && <button type="button" onClick={onOpenFullPage} title="Abrir chat completo">Ampliar ↗</button>}
          {messages.length > 0 && <button type="button" onClick={onClear} disabled={sending} title="Borrar esta conversación de la pantalla">Limpiar</button>}
          {onClose && <button type="button" className="pm-ai-chat__close" onClick={onClose} aria-label="Cerrar chat">×</button>}
        </div>
      </header>

      <div className="pm-ai-chat__context">
        <label htmlFor={`pm-ai-project-${mode}`}>Proyecto de referencia</label>
        <select
          id={`pm-ai-project-${mode}`}
          value={projectId}
          onChange={e => onProjectChange?.(e.target.value)}
          disabled={loadingProjects || sending}
        >
          <option value="">Sin proyecto seleccionado</option>
          {projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}
        </select>
        <span className="pm-ai-chat__provider" title="El proveedor se configura en el backend">
          <span className={`pm-ai-chat__status-dot ${providerConfigured ? 'is-configured' : ''}`} />
          {providerConfigured ? `Proveedor: ${provider || 'configurado'}` : `IA ${provider ? `(${provider})` : ''}: configuración pendiente`}
        </span>
      </div>
      {projectsError && <p className="pm-ai-chat__notice" role="status">{projectsError}</p>}

      <div className="pm-ai-chat__history" role="log" aria-live="polite" aria-relevant="additions">
        {messages.length === 0 ? (
          <div className="pm-ai-chat__welcome">
            <span className="pm-ai-chat__spark" aria-hidden="true">✧</span>
            <h2>¿En qué trabajamos hoy?</h2>
            <p>Explora ideas, organiza tareas y solicita orientación. Las respuestas provienen del proveedor de IA configurado en FastAPI.</p>
            <div className="pm-ai-chat__suggestions">
              {SUGGESTIONS.map(suggestion => (
                <button type="button" key={suggestion.title} disabled={sending} onClick={() => onSend?.(suggestion.prompt)}>
                  {suggestion.title}<span aria-hidden="true">↗</span>
                </button>
              ))}
            </div>
          </div>
        ) : messages.map((item, i) => (
          <article key={i} className={`pm-ai-chat__bubble pm-ai-chat__bubble--${item.role}`}>
            <small>{item.role === 'user' ? 'Tú' : item.role === 'error' ? 'Error de conexión' : 'ProjectMind AI'}</small>
            <p>{item.content}</p>
          </article>
        ))}
        {sending && <p className="pm-ai-chat__thinking" role="status">Consultando al asistente…</p>}
        <div ref={lastMessageRef} aria-hidden="true" />
      </div>

      <form className="pm-ai-chat__form" onSubmit={submit}>
        <label htmlFor={`pm-ai-message-${mode}`} className="pm-ai-chat__label">Escribe tu mensaje</label>
        <textarea
          ref={inputRef}
          id={`pm-ai-message-${mode}`}
          rows={2}
          maxLength={5000}
          placeholder="Escribe tu pregunta sobre ProjectMind…"
          value={draft}
          onChange={e => onDraftChange?.(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent?.isComposing) { e.preventDefault(); if (draft.trim() && !sending) onSend?.() } }}
        />
        <div className="pm-ai-chat__footer">
          <small>Enter para enviar · Shift+Enter para nueva línea. La IA no modifica datos sin autorización.</small>
          <button type="submit" disabled={!draft.trim() || sending} aria-label="Enviar mensaje a ProjectMind AI">{sending ? 'Enviando…' : 'Enviar ↗'}</button>
        </div>
      </form>
    </section>
  )
}
