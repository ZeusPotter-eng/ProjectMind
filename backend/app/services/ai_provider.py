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

    def generate_text(self, messages: list[dict[str, str]]) -> tuple[str, str]:
        """Endpoint OpenAI compatible para conversación, incluido LM Studio local.

        El resto de módulos puede seguir usando client_and_model y Responses API.
        """
        client, model = self.client_and_model()
        if self.settings.ai_provider.lower() == 'lmstudio':
            # LM Studio expone /v1/chat/completions; Responses API puede no existir.
            completion = client.chat.completions.create(model=model, messages=messages)
            answer = completion.choices[0].message.content if completion.choices else None
        else:
            # Mantener la API Responses que el backend ya utilizaba con OpenAI.
            response = client.responses.create(model=model, input=messages)
            answer = response.output_text
        if not isinstance(answer, str) or not answer.strip():
            raise RuntimeError('El modelo no devolvió una respuesta de texto.')
        return model, answer.strip()
