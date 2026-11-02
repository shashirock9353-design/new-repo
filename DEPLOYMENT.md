# Publish a live website

The app is deployed as a Vercel frontend and a Render API. Both services need to be deployed from the same GitHub repository.

## 1. Deploy the API on Render

1. Push this project to a GitHub repository.
2. In Render, create a **Blueprint** and select that repository. Render will read `render.yaml` and create the API service.
3. Keep the attached disk configured by the blueprint. It stores analysis history between deploys.
4. Wait for the service health check to pass, then copy its public URL, such as `https://skill-gap-analyzer-api.onrender.com`.

The Render disk requires a paid Render instance. Without persistent storage, SQLite history would be lost when the service restarts or redeploys.

## 2. Deploy the website on Vercel

1. Import the same GitHub repository into Vercel.
2. Set **Root Directory** to `frontend`.
3. Add the environment variable `VITE_API_BASE` with the Render API URL from step 1 (no trailing slash).
4. Deploy and copy the Vercel website URL to share.

If you change `VITE_API_BASE` after deployment, redeploy the Vercel project so the frontend picks up the new value.
