from openai import OpenAI
from app.core.config import get_settings

class AIProvider:
    """Adaptador inicial para cambiar entre OpenAI y LM Studio sin tocar las rutas."""
    def __init__(self):
        self.settings = get_settings()

    def client_and_model(self):
        if self.settings.ai_provider.lower() == "lmstudio":
            if not self.settings.lm_studio_model:
                raise RuntimeError("Configura LM_STUDIO_MODEL para usar LM Studio.")
            return OpenAI(base_url=self.settings.lm_studio_base_url, api_key="lm-studio"), self.settings.lm_studio_model
        if not self.settings.openai_api_key:
            raise RuntimeError("Configura OPENAI_API_KEY en backend/.env")
        return OpenAI(api_key=self.settings.openai_api_key), self.settings.openai_model
