# SAIL AI Assistant — central service (Python/FastAPI port).
# Migrations run at container start (alembic upgrade head), then uvicorn.
FROM python:3.13-slim AS base
COPY --from=ghcr.io/astral-sh/uv:0.9.5 /uv /usr/local/bin/uv
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy UV_PROJECT_ENVIRONMENT=/opt/venv PYTHONUNBUFFERED=1
WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project
COPY app ./app
COPY alembic.ini ./
COPY alembic ./alembic
RUN useradd -r -u 10001 assistant && chown -R assistant /app
USER assistant
ENV PATH="/opt/venv/bin:$PATH" PORT=8000
EXPOSE 8000
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"]
