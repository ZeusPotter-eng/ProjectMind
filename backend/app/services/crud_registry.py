from dataclasses import asdict, dataclass


@dataclass(frozen=True)
class CrudResource:
    name: str
    label: str
    category: str
    primary_key: tuple[str, ...]
    columns: tuple[str, ...]
    required_fields: tuple[str, ...] = ()
    immutable_fields: tuple[str, ...] = ()
    notes: str = ""

    def public_dict(self) -> dict:
        data = asdict(self)
        data["primary_key"] = list(self.primary_key)
        data["columns"] = list(self.columns)
        data["required_fields"] = list(self.required_fields)
        data["immutable_fields"] = list(self.immutable_fields)
        return data


SYSTEM_FIELDS = ("created_at",)


def resource(
    name: str,
    label: str,
    category: str,
    primary_key: tuple[str, ...],
    columns: tuple[str, ...],
    required_fields: tuple[str, ...] = (),
    immutable_fields: tuple[str, ...] = (),
    notes: str = "",
) -> CrudResource:
    return CrudResource(
        name=name,
        label=label,
        category=category,
        primary_key=primary_key,
        columns=columns,
        required_fields=required_fields,
        immutable_fields=tuple(dict.fromkeys((*primary_key, *SYSTEM_FIELDS, *immutable_fields))),
        notes=notes,
    )


_RESOURCES = [
    resource(
        "profiles", "Perfiles", "Usuarios", ("id",),
        ("id", "full_name", "avatar_path", "job_title", "bio", "is_active", "created_at", "updated_at"),
        ("id", "full_name"),
        notes="El id debe corresponder a un usuario existente de Supabase Auth.",
    ),
    resource(
        "projects", "Proyectos", "Proyectos", ("id",),
        ("id", "name", "description", "objective", "status", "start_date", "due_date", "owner_id", "created_at", "updated_at"),
        ("name", "objective", "owner_id"),
        notes="owner_id debe corresponder a un perfil/usuario válido.",
    ),
    resource(
        "project_members", "Integrantes de proyecto", "Proyectos", ("project_id", "user_id"),
        ("project_id", "user_id", "role", "status", "joined_at", "updated_at"),
        ("project_id", "user_id"),
    ),
    resource(
        "project_invitations", "Invitaciones", "Proyectos", ("id",),
        ("id", "project_id", "invited_email", "role", "status", "invited_by", "expires_at", "accepted_at", "created_at"),
        ("project_id", "invited_email", "invited_by"),
    ),
    resource(
        "tasks", "Tareas", "Planeación", ("id",),
        ("id", "project_id", "title", "description", "status", "priority", "start_date", "due_date", "progress", "source", "source_reference_id", "created_by", "updated_by", "completed_at", "created_at", "updated_at"),
        ("project_id", "title", "created_by"),
    ),
    resource(
        "task_assignees", "Responsables de tarea", "Planeación", ("task_id", "user_id"),
        ("task_id", "user_id", "assigned_by", "assigned_at"),
        ("task_id", "user_id"),
    ),
    resource(
        "task_dependencies", "Dependencias de tareas", "Planeación", ("id",),
        ("id", "project_id", "task_id", "depends_on_task_id", "dependency_type", "created_by", "created_at"),
        ("project_id", "task_id", "depends_on_task_id", "created_by"),
    ),
    resource(
        "task_updates", "Actualizaciones de tarea", "Planeación", ("id",),
        ("id", "project_id", "task_id", "user_id", "update_type", "message", "old_value", "new_value", "created_at"),
        ("project_id", "task_id", "user_id"),
    ),
    resource(
        "blockers", "Bloqueos", "Planeación", ("id",),
        ("id", "project_id", "task_id", "title", "description", "severity", "status", "created_by", "resolved_by", "resolved_at", "created_at", "updated_at"),
        ("project_id", "title", "created_by"),
    ),
    resource(
        "requirements", "Requisitos", "Requisitos", ("id",),
        ("id", "project_id", "source_document_id", "requirement_type", "title", "description", "priority", "status", "source", "created_by", "approved_by", "approved_at", "created_at", "updated_at"),
        ("project_id", "title", "description"),
    ),
    resource(
        "documents", "Documentos", "Documentos / RAG", ("id",),
        ("id", "project_id", "title", "document_type", "original_filename", "mime_type", "storage_path", "file_size_bytes", "checksum_sha256", "processing_status", "processing_error", "uploaded_by", "created_at", "updated_at"),
        ("project_id", "title", "original_filename", "mime_type", "storage_path", "uploaded_by"),
        notes="Este CRUD administra metadatos. La carga física del archivo pertenece a Supabase Storage.",
    ),
    resource(
        "task_requirements", "Tarea ↔ requisito", "Requisitos", ("task_id", "requirement_id"),
        ("task_id", "requirement_id", "created_at"),
        ("task_id", "requirement_id"),
    ),
    resource(
        "document_chunks", "Fragmentos RAG", "Documentos / RAG", ("id",),
        ("id", "project_id", "document_id", "chunk_index", "content", "page_number", "token_count", "embedding_model", "embedding", "metadata", "created_at"),
        ("project_id", "document_id", "chunk_index", "content"),
        notes="embedding es un campo pgvector; normalmente lo genera el pipeline RAG, no el usuario.",
    ),
    resource(
        "meetings", "Reuniones", "Reuniones", ("id",),
        ("id", "project_id", "title", "meeting_date", "status", "audio_storage_path", "audio_mime_type", "audio_duration_seconds", "summary", "minutes_markdown", "created_by", "created_at", "updated_at"),
        ("project_id", "title", "created_by"),
    ),
    resource(
        "meeting_participants", "Participantes", "Reuniones", ("meeting_id", "user_id"),
        ("meeting_id", "user_id", "attended"),
        ("meeting_id", "user_id"),
    ),
    resource(
        "meeting_transcripts", "Transcripciones", "Reuniones", ("id",),
        ("id", "project_id", "meeting_id", "provider", "model", "language_code", "transcript_text", "segments", "confidence", "processing_ms", "created_at"),
        ("project_id", "meeting_id", "transcript_text"),
    ),
    resource(
        "meeting_items", "Elementos de reunión", "Reuniones", ("id",),
        ("id", "project_id", "meeting_id", "item_type", "title", "description", "mentioned_assignee_id", "mentioned_due_date", "confidence", "review_status", "reviewed_by", "reviewed_at", "created_task_id", "created_blocker_id", "created_requirement_id", "raw_payload", "created_at", "updated_at"),
        ("project_id", "meeting_id", "item_type", "title"),
    ),
    resource(
        "ai_runs", "Ejecuciones de IA", "IA", ("id",),
        ("id", "project_id", "requested_by", "run_type", "status", "provider", "model", "prompt_version", "request_text", "input_tokens", "output_tokens", "total_tokens", "latency_ms", "estimated_cost_usd", "result_summary", "result_payload", "error_message", "started_at", "finished_at", "created_at"),
        ("project_id", "run_type"),
    ),
    resource(
        "rag_retrievals", "Recuperaciones RAG", "IA", ("id",),
        ("id", "project_id", "ai_run_id", "document_chunk_id", "rank", "similarity", "created_at"),
        ("project_id", "ai_run_id", "document_chunk_id", "rank"),
    ),
    resource(
        "ai_suggestions", "Propuestas de IA", "IA", ("id",),
        ("id", "project_id", "ai_run_id", "suggestion_type", "target_entity_type", "target_entity_id", "title", "explanation", "proposed_data", "confidence", "status", "reviewed_by", "reviewed_at", "review_notes", "applied_at", "created_at", "updated_at"),
        ("project_id", "suggestion_type", "title", "proposed_data"),
    ),
    resource(
        "conversations", "Conversaciones", "Asistente", ("id",),
        ("id", "project_id", "user_id", "title", "created_at", "updated_at"),
        ("project_id", "user_id"),
    ),
    resource(
        "messages", "Mensajes", "Asistente", ("id",),
        ("id", "project_id", "conversation_id", "role", "content", "ai_run_id", "created_at"),
        ("project_id", "conversation_id", "role", "content"),
    ),
    resource(
        "project_reports", "Reportes", "Reportes", ("id",),
        ("id", "project_id", "report_type", "title", "content_markdown", "ai_run_id", "generated_by", "created_at"),
        ("project_id", "report_type", "title", "content_markdown"),
    ),
    resource(
        "audit_logs", "Auditoría", "Auditoría", ("id",),
        ("id", "project_id", "actor_user_id", "actor_type", "action", "entity_type", "entity_id", "before_data", "after_data", "metadata", "created_at"),
        ("id", "action", "entity_type"),
        notes="Tabla sensible. En producción debería ser append-only; la edición aquí existe únicamente para verificación local del CRUD.",
    ),
]

CRUD_RESOURCES: dict[str, CrudResource] = {item.name: item for item in _RESOURCES}


def get_resource(name: str) -> CrudResource | None:
    return CRUD_RESOURCES.get(name)


def list_resources() -> list[CrudResource]:
    return list(_RESOURCES)
