# ProjectMind Frontend
Base React + Vite alineada al MVP. La pantalla inicial comprueba FastAPI y presenta los módulos e integraciones previstas sin exponer secretos.

```bash
npm install
npm run dev
```
Copia `.env.example` a `.env` si necesitas cambiar la URL del backend. El frontend solo necesita `VITE_API_URL`; las claves de OpenAI/Supabase service-role pertenecen al backend.
