# syntax=docker/dockerfile:1.7
# ISMeta backend — multi-stage Dockerfile.
# Targets:
#   base         — system-level deps, общий слой
#   deps         — Python-deps из requirements.txt
#   development  — dev-окружение для docker-compose (runserver, hot reload через bind mount)
#   production   — (заглушка) gunicorn, будет наполнена в E1.x / релизных эпиках

ARG PYTHON_VERSION=3.12

# ---------- base ----------
FROM python:${PYTHON_VERSION}-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        build-essential \
        curl \
        libpq-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ---------- deps ----------
FROM base AS deps

COPY requirements.txt ./
RUN pip install --upgrade pip \
    && pip install -r requirements.txt

# ---------- development ----------
FROM deps AS development

ENV DJANGO_SETTINGS_MODULE=ismeta.settings

# Код монтируется через volume в docker-compose (bind mount),
# но копируем исходник чтобы образ был самодостаточным при прямом запуске.
COPY . /app

EXPOSE 8000

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -fsS http://localhost:8000/health || exit 1

CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]

# ---------- production ----------
FROM deps AS production

ENV DJANGO_SETTINGS_MODULE=ismeta.settings

COPY . /app

RUN pip install gunicorn

EXPOSE 8000

CMD ["gunicorn", "ismeta.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "3"]
