# ProjectMind

Base inicial del repositorio de **ProjectMind**, separada en:

- `backend/`: API REST con FastAPI.
- `frontend/`: interfaz con React + Vite.

El primer objetivo del repositorio es comprobar la comunicación completa:

`React -> FastAPI -> respuesta JSON`

## Estructura

```text
ProjectMind/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   └── routes/
│   │   │       └── health.py
│   │   ├── core/
│   │   │   └── config.py
│   │   └── main.py
│   ├── .env.example
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   │   └── client.js
│   │   ├── App.jsx
│   │   ├── index.css
│   │   └── main.jsx
│   ├── .env.example
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
└── .gitignore
```

## 1. Backend

```bash
cd backend
python -m venv .venv
```

### Windows PowerShell

```powershell
.venv\Scripts\Activate.ps1
```

### Windows CMD

```cmd
.venv\Scripts\activate.bat
```

Instalar dependencias:

```bash
pip install -r requirements.txt
```

Crear el archivo `.env` a partir de `.env.example`.

Ejecutar:

```bash
uvicorn app.main:app --reload --port 8000
```

API:

- `http://localhost:8000/`
- `http://localhost:8000/api/v1/health`
- `http://localhost:8000/docs`

## 2. Frontend

En otra terminal:

```bash
cd frontend
npm install
```

Crear `.env` a partir de `.env.example`.

Ejecutar:

```bash
npm run dev
```

Abrir:

`http://localhost:5173`

La pantalla deberá mostrar que el backend se encuentra conectado.

## Primer commit recomendado

```bash
git init
git add .
git commit -m "chore: initialize ProjectMind frontend and backend"
git branch -M main
git remote add origin TU_URL_DEL_REPOSITORIO
git push -u origin main
```

## Siguientes módulos

Se recomienda implementarlos mediante commits separados:

1. Supabase y configuración de base de datos.
2. Autenticación.
3. CRUD de proyectos.
4. CRUD de tareas.
5. Dependencias entre tareas.
6. Asistente de IA.
7. RAG.
8. Speech-to-Text.
9. Human-in-the-Loop y auditoría.
