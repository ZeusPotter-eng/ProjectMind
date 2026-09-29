from fastapi import APIRouter, HTTPException
from app.core.config import get_settings
from app.schemas.assistant import AssistantRequest, AssistantResponse
from app.services.ai_provider import AIProvider
router = APIRouter(prefix="/assistant", tags=["Assistant"])

@router.get("/status")
async def status():
    s=get_settings()
    configured = bool(s.lm_studio_model) if s.ai_provider.lower()=="lmstudio" else bool(s.openai_api_key)
    return {"module":"assistant","provider":s.ai_provider,"configured":configured,"human_in_the_loop":True}

@router.post("/chat", response_model=AssistantResponse)
async def chat(payload: AssistantRequest) -> AssistantResponse:
    try:
        client, model = AIProvider().client_and_model()
        response = client.responses.create(model=model, input=[{"role":"system","content":"Eres el asistente especializado de ProjectMind. Explica y propone; nunca afirmes que modificaste datos oficiales. Las propuestas requieren revisión humana."},{"role":"user","content":payload.message}])
        return AssistantResponse(provider=get_settings().ai_provider, model=model, answer=response.output_text)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail="No fue posible consultar el proveedor de IA.") from exc
