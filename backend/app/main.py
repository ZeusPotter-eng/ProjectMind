from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import (
    assistant,
    audit,
    auth,
    blockers,
    crud,
    dependencies,
    documents,
    health,
    meetings,
    members,
    projects,
    reports,
    requirements,
    suggestions,
    tasks,
)
from app.core.config import get_settings

settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    version="0.5.0",
    description="API base del MVP de ProjectMind con consola CRUD de desarrollo.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

for router in [
    health.router,
    auth.router,
    projects.router,
    members.router,
    tasks.router,
    requirements.router,
    dependencies.router,
    blockers.router,
    documents.router,
    assistant.router,
    meetings.router,
    suggestions.router,
    reports.router,
    audit.router,
    crud.router,
]:
    app.include_router(router, prefix=settings.api_v1_prefix)


@app.get("/", tags=["Root"])
async def root():
    return {
        "name": settings.app_name,
        "environment": settings.app_env,
        "version": "0.5.0",
        "docs": "/docs",
    }
