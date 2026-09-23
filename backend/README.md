# ProjectMind Backend

API inicial construida con FastAPI.

## Requisitos

- Python 3.10 o superior.

## Instalación

```bash
python -m venv .venv
```

Activar el entorno virtual e instalar:

```bash
pip install -r requirements.txt
```

Copiar:

```text
.env.example -> .env
```

Ejecutar:

```bash
uvicorn app.main:app --reload --port 8000
```

Documentación automática:

`http://localhost:8000/docs`

Health check:

`http://localhost:8000/api/v1/health`
