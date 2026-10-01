import { useEffect, useMemo, useState } from 'react'
import {
  createCrudRow,
  deleteCrudRow,
  getCrudResources,
  getCrudStatus,
  listCrudRows,
  updateCrudRow,
} from '../api/client'

const CRUD_FRONTEND_ENABLED =
  import.meta.env.VITE_ENABLE_CRUD_CONSOLE === 'true'
const CRUD_TOKEN_CONFIGURED = Boolean(import.meta.env.VITE_CRUD_CONSOLE_TOKEN)

function buildKey(resource, row) {
  return resource.primary_key.reduce((key, column) => {
    key[column] = row[column]
    return key
  }, {})
}

function makeCreateTemplate(resource) {
  return Object.fromEntries(
    resource.required_fields.map((field) => [field, '']),
  )
}

function formatCell(value) {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'object') {
    const text = JSON.stringify(value)
    return text.length > 70 ? `${text.slice(0, 67)}…` : text
  }

  const text = String(value)
  return text.length > 70 ? `${text.slice(0, 67)}…` : text
}

function CrudConsole() {
  const [serverStatus, setServerStatus] = useState(null)
  const [resources, setResources] = useState([])
  const [selectedName, setSelectedName] = useState('')
  const [rows, setRows] = useState([])
  const [count, setCount] = useState(0)
  const [loadingResources, setLoadingResources] = useState(false)
  const [loadingRows, setLoadingRows] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [editorMode, setEditorMode] = useState(null)
  const [editingKey, setEditingKey] = useState(null)
  const [draft, setDraft] = useState('{}')
  const [saving, setSaving] = useState(false)

  const selectedResource = useMemo(
    () => resources.find((resource) => resource.name === selectedName),
    [resources, selectedName],
  )

  const columns = useMemo(() => {
    const set = new Set()
    rows.forEach((row) => Object.keys(row).forEach((column) => set.add(column)))
    return [...set]
  }, [rows])

  async function loadResources() {
    if (!CRUD_FRONTEND_ENABLED || !CRUD_TOKEN_CONFIGURED) return

    setLoadingResources(true)
    setError('')

    try {
      const [statusResult, resourceResult] = await Promise.all([
        getCrudStatus(),
        getCrudResources(),
      ])
      setServerStatus(statusResult)
      const available = resourceResult.resources ?? []
      setResources(available)

      if (!selectedName && available.length > 0) {
        const projects = available.find((item) => item.name === 'projects')
        setSelectedName(projects?.name ?? available[0].name)
      }
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoadingResources(false)
    }
  }

  async function loadRows(resourceName = selectedName) {
    if (!resourceName) return

    setLoadingRows(true)
    setError('')
    setNotice('')

    try {
      const result = await listCrudRows(resourceName)
      setRows(result.items ?? [])
      setCount(result.count ?? result.items?.length ?? 0)
    } catch (requestError) {
      setRows([])
      setCount(0)
      setError(requestError.message)
    } finally {
      setLoadingRows(false)
    }
  }

  useEffect(() => {
    loadResources()
  }, [])

  useEffect(() => {
    if (selectedName) {
      setEditorMode(null)
      setEditingKey(null)
      loadRows(selectedName)
    }
  }, [selectedName])

  function openCreate() {
    if (!selectedResource) return
    setError('')
    setNotice('')
    setEditingKey(null)
    setEditorMode('create')
    setDraft(JSON.stringify(makeCreateTemplate(selectedResource), null, 2))
  }

  function openEdit(row) {
    if (!selectedResource) return
    setError('')
    setNotice('')
    setEditingKey(buildKey(selectedResource, row))
    setEditorMode('edit')
    setDraft(JSON.stringify(row, null, 2))
  }

  function closeEditor() {
    setEditorMode(null)
    setEditingKey(null)
    setDraft('{}')
  }

  async function saveDraft() {
    if (!selectedResource) return

    let parsed
    try {
      parsed = JSON.parse(draft)
    } catch {
      setError('El contenido del editor no es JSON válido.')
      return
    }

    if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
      setError('Debes enviar un objeto JSON.')
      return
    }

    setSaving(true)
    setError('')
    setNotice('')

    try {
      if (editorMode === 'create') {
        await createCrudRow(selectedResource.name, parsed)
        setNotice('Registro creado correctamente.')
      } else {
        await updateCrudRow(selectedResource.name, editingKey, parsed)
        setNotice('Registro actualizado correctamente.')
      }

      closeEditor()
      await loadRows(selectedResource.name)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSaving(false)
    }
  }

  async function removeRow(row) {
    if (!selectedResource) return

    const key = buildKey(selectedResource, row)
    const confirmed = window.confirm(
      `¿Eliminar este registro de ${selectedResource.label}?\n\nClave: ${JSON.stringify(key)}`,
    )

    if (!confirmed) return

    setError('')
    setNotice('')

    try {
      await deleteCrudRow(selectedResource.name, key)
      setNotice('Registro eliminado correctamente.')
      await loadRows(selectedResource.name)
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  if (!CRUD_FRONTEND_ENABLED) {
    return (
      <div className="crud-disabled">
        <strong>Consola CRUD deshabilitada en el frontend.</strong>
        <p>
          Para pruebas locales agrega <code>VITE_ENABLE_CRUD_CONSOLE=true</code>{' '}
          en <code>frontend/.env</code>.
        </p>
      </div>
    )
  }

  if (!CRUD_TOKEN_CONFIGURED) {
    return (
      <div className="crud-disabled">
        <strong>Falta el token local de la consola.</strong>
        <p>
          Configura <code>VITE_CRUD_CONSOLE_TOKEN</code> con el mismo valor de{' '}
          <code>CRUD_CONSOLE_TOKEN</code> del backend.
        </p>
      </div>
    )
  }

  return (
    <div className="crud-console">
      {serverStatus && (
        <div className="crud-server-strip">
          <span>
            Backend CRUD: <strong>{serverStatus.enabled ? 'habilitado' : 'deshabilitado'}</strong>
          </span>
          <span>
            Admin key: <strong>{serverStatus.admin_key_configured ? 'configurada' : 'pendiente'}</strong>
          </span>
          <span>
            Recursos: <strong>{serverStatus.resource_count}</strong>
          </span>
        </div>
      )}

      <div className="crud-toolbar">
        <label className="crud-resource-picker">
          <span>Tabla / recurso</span>
          <select
            value={selectedName}
            onChange={(event) => setSelectedName(event.target.value)}
            disabled={loadingResources}
          >
            {resources.map((resource) => (
              <option value={resource.name} key={resource.name}>
                {resource.category} · {resource.label}
              </option>
            ))}
          </select>
        </label>

        <div className="crud-toolbar__actions">
          <button
            type="button"
            className="crud-button crud-button--secondary"
            onClick={() => loadRows()}
            disabled={!selectedResource || loadingRows}
          >
            {loadingRows ? 'Actualizando…' : 'Actualizar'}
          </button>

          <button
            type="button"
            className="crud-button crud-button--primary"
            onClick={openCreate}
            disabled={!selectedResource}
          >
            + Crear registro
          </button>
        </div>
      </div>

      {selectedResource && (
        <div className="crud-resource-info">
          <div>
            <span>RECURSO</span>
            <strong>{selectedResource.label}</strong>
            <small>{selectedResource.name}</small>
          </div>

          <div>
            <span>CLAVE PRIMARIA</span>
            <strong>{selectedResource.primary_key.join(' + ')}</strong>
          </div>

          <div>
            <span>REGISTROS</span>
            <strong>{count}</strong>
          </div>
        </div>
      )}

      {selectedResource?.notes && (
        <p className="crud-note">{selectedResource.notes}</p>
      )}

      {error && <div className="crud-alert crud-alert--error">{error}</div>}
      {notice && <div className="crud-alert crud-alert--success">{notice}</div>}

      {editorMode && selectedResource && (
        <div className="crud-editor">
          <div className="crud-editor__heading">
            <div>
              <span className="eyebrow">
                {editorMode === 'create' ? 'CREATE' : 'UPDATE'}
              </span>
              <h3>
                {editorMode === 'create'
                  ? `Nuevo registro · ${selectedResource.label}`
                  : `Editar registro · ${selectedResource.label}`}
              </h3>
            </div>

            <button
              type="button"
              className="crud-close"
              onClick={closeEditor}
              aria-label="Cerrar editor"
            >
              ×
            </button>
          </div>

          {editorMode === 'create' && (
            <p className="crud-helper">
              Campos obligatorios sugeridos:{' '}
              <strong>
                {selectedResource.required_fields.join(', ') || 'Ninguno'}
              </strong>
              . Las llaves foráneas deben apuntar a registros existentes.
            </p>
          )}

          {editorMode === 'edit' && (
            <p className="crud-helper">
              Clave usada para localizar el registro:{' '}
              <code>{JSON.stringify(editingKey)}</code>. Las claves primarias no
              se modifican.
            </p>
          )}

          <textarea
            className="crud-json-editor"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            spellCheck="false"
          />

          <div className="crud-editor__actions">
            <button
              type="button"
              className="crud-button crud-button--secondary"
              onClick={closeEditor}
              disabled={saving}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="crud-button crud-button--primary"
              onClick={saveDraft}
              disabled={saving}
            >
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </div>
      )}

      <div className="crud-table-wrap">
        {loadingRows ? (
          <div className="crud-empty">Consultando Supabase…</div>
        ) : rows.length === 0 ? (
          <div className="crud-empty">
            <strong>No hay registros en esta tabla.</strong>
            <p>
              Puedes crear el primero desde “Crear registro”. Si hay relaciones
              foráneas, crea primero los registros padre correspondientes.
            </p>
          </div>
        ) : (
          <table className="crud-table">
            <thead>
              <tr>
                {columns.map((column) => (
                  <th key={column}>{column}</th>
                ))}
                <th>acciones</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const rowKey = JSON.stringify(buildKey(selectedResource, row))

                return (
                  <tr key={rowKey}>
                    {columns.map((column) => (
                      <td title={String(row[column] ?? '')} key={column}>
                        {formatCell(row[column])}
                      </td>
                    ))}
                    <td className="crud-row-actions">
                      <button
                        type="button"
                        onClick={() => openEdit(row)}
                        className="crud-action-link"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => removeRow(row)}
                        className="crud-action-link crud-action-link--danger"
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <p className="crud-security-note">
        Consola administrativa para verificación local. El backend la bloquea
        automáticamente cuando <code>APP_ENV=production</code>.
      </p>
    </div>
  )
}

export default CrudConsole
