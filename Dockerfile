# Single-image deploy: FastAPI serves /api/* AND the built Vite bundle from /.
# One origin means no CORS setup and no cross-service URL wiring.
#
#   docker build -t dj .
#   docker run -p 8000:8000 dj
#
# VITE_API_URL is baked in at build time. The default "/api" is a same-origin
# relative path, which is what makes the single-image layout work.

# ---- stage 1: build the frontend ----
FROM node:20-alpine AS frontend-build
WORKDIR /build
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
ARG VITE_API_URL=/api
ENV VITE_API_URL=${VITE_API_URL}
RUN npm run build

# ---- stage 2: python runtime serving API + static bundle ----
FROM python:3.11-slim
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PORT=8000 \
    DISASTER_DB_PATH=/data/disaster.db \
    SERVE_FRONTEND=1

WORKDIR /app

RUN useradd --create-home --uid 10001 appuser \
    && mkdir -p /data /app/frontend \
    && chown -R appuser:appuser /data /app

COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY --chown=appuser:appuser backend/ ./backend/
COPY --from=frontend-build --chown=appuser:appuser /build/dist ./frontend/dist

USER appuser

EXPOSE 8000

# app.main mounts /assets from /app/frontend/dist and falls back to index.html
# for every other non-/api path, so one process serves the whole application.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --app-dir /app/backend"]
