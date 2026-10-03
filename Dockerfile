# Single-image deploy: serves FastAPI + built Vite frontend
# Build: docker build -t dj .
# Run:   docker run -p 8000:8000 -e PORT=8000 dj
# Env:   VITE_API_URL is baked at build time for the frontend; for runtime
#        flexibility the image also serves the API so same-origin works.

# ---- frontend build ----
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
# Allow overriding API URL at build time (defaults to same-origin /api via proxy)
ARG VITE_API_URL=/api
ENV VITE_API_URL=${VITE_API_URL}
RUN npm run build

# ---- backend ----
FROM python:3.11-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*
COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt
COPY backend/ ./backend/
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

# Serve frontend static via FastAPI (fallback) + API
# We add a tiny static mount at runtime; app.main already serves /api/*
# For production, uvicorn serves both: API under /api, frontend under /
ENV PYTHONUNBUFFERED=1
ENV PORT=8000
EXPOSE 8000
CMD ["sh", "-c", "uvicorn backend.app.main:app --host 0.0.0.0 --port ${PORT:-8000} --app-dir /app"]
