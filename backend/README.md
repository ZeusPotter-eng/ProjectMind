# ProjectMind Backend
Base integrable del MVP con FastAPI. Incluye configuración, CORS, health check, adaptador Supabase, adaptador OpenAI/LM Studio y routers base de los módulos delimitados.

## 1. Crear entorno
```bash
python -m venv .venv
# Windows PowerShell
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```
## 2. Variables
Copia `.env.example` como `.env`. Coloca ahí las claves reales. **No subas `.env` a Git.**
## 3. Ejecutar
```bash
uvicorn app.main:app --reload
```
Prueba: http://localhost:8000/api/v1/health y documentación: http://localhost:8000/docs

## IA
`AI_PROVIDER=openai` usa `OPENAI_API_KEY`. Para LM Studio usa `AI_PROVIDER=lmstudio`, inicia su servidor local compatible con OpenAI y configura `LM_STUDIO_MODEL`.

Los routers distintos de health/assistant son contratos base (`/status`) para integrar después su lógica real con Supabase sin mezclar responsabilidades.
