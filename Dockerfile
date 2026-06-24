# ── Stage 1: Build React frontend ────────────────────────────────────────────
FROM node:20-alpine AS frontend
WORKDIR /app/ui
COPY ui/package*.json ./
RUN npm ci
COPY ui/ .
RUN npm run build

# ── Stage 2: Python runtime ────────────────────────────────────────────────────
FROM python:3.13-slim AS runtime
WORKDIR /app

COPY api/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY api/ .

# Copy the compiled React app into api/static/ so FastAPI serves it
COPY --from=frontend /app/ui/dist ./static

ENV PORT=8080
ENV DATA_DIR=/data

EXPOSE 8080

CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT}"]
