# syntax=docker/dockerfile:1
FROM node:22-alpine AS web
WORKDIR /app/web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

FROM python:3.11-slim AS server
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    CUE_WEB_DIST=/app/web/dist \
    CUE_PACK=/app/server/cue/data/show.json \
    CUE_DB=/data/cue.sqlite3
WORKDIR /app
COPY server/ /app/server/
RUN pip install --no-cache-dir "./server"
COPY --from=web /app/web/dist /app/web/dist
RUN mkdir -p /data
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/health', timeout=3)"
CMD ["uvicorn", "cue.api.app:app", "--host", "0.0.0.0", "--port", "8000", "--app-dir", "/app/server"]
