<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1YpaFYLUaAQ0kfZpP2FtoTMU6l9JXFnOA

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `OPENAI_API_KEY` and Vision credentials in [.env.local](.env.local)
   - `OPENAI_API_KEY`: OpenAI API key (analysis rationale)
   - `GOOGLE_APPLICATION_CREDENTIALS`: Google Cloud Vision service account JSON path (OCR)
   - Optional: `GOOGLE_VISION_API_KEY` to use the Vision REST API instead of a service account
   - Optional: `OCR_LANGUAGE_HINTS` (comma-separated, default `ko`) to improve OCR accuracy (e.g. `ko,en`)
   - Optional: `SIGNED_URL_SECRET` for local signed image URLs
3. Run the app (client + server):
   `npm run dev`

## Deploy (separate backend + Vercel frontend)

This project runs an Express API in `server/` and a Vite frontend. For production, deploy the backend
as a long-running service (Render/Railway/Fly) and point the Vercel frontend to it.

1. Deploy the backend (`server/`) to Render/Railway/Fly.
   - Set server env vars: `OPENAI_API_KEY`, `GOOGLE_VISION_API_KEY` or `GOOGLE_APPLICATION_CREDENTIALS`,
     `SIGNED_URL_SECRET` (recommended), `OCR_LANGUAGE_HINTS` (optional).
   - If you store data locally, attach a persistent disk/volume for `server/data.sqlite` and `server/uploads/`.
2. If the backend is on a different domain, set CORS:
   - `CORS_ALLOW_ORIGINS=https://your-frontend.example.com` (comma-separated list).
   - If `CORS_ALLOW_ORIGINS` is empty, the server allows all origins.
3. In Vercel, set `VITE_API_BASE` to your backend base URL (e.g. `https://your-backend.example.com`).
4. (Optional) Use Vercel rewrites instead of `VITE_API_BASE`:

   ```json
   {
     "rewrites": [
       { "source": "/api/:path*", "destination": "https://your-backend.example.com/api/:path*" }
     ]
   }
   ```
