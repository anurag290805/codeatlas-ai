# syntax=docker/dockerfile:1.7

# Build stage: install Python dependencies into an isolated virtual
# environment so the runtime image does not need compilers or pip caches.
FROM python:3.11.11-slim-bookworm AS builder

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    VIRTUAL_ENV=/opt/venv \
    PATH="/opt/venv/bin:$PATH"

WORKDIR /build

# Build tools are present only while installing packages that may require
# native compilation. The dependency file is copied first for layer caching.
RUN apt-get update \
    && apt-get install --no-install-recommends -y build-essential \
    && python -m venv "$VIRTUAL_ENV" \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./requirements.txt

RUN python -m pip install --upgrade pip \
    && python -m pip install --no-cache-dir -r requirements.txt \
    && rm -rf /root/.cache/pip


# Runtime stage: contains only the application, its virtual environment, and
# libraries needed at runtime. Ollama is intentionally external to this image.
FROM python:3.11.11-slim-bookworm AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    VIRTUAL_ENV=/opt/venv \
    PATH="/opt/venv/bin:$PATH"

WORKDIR /app

# GitPython requires the git executable. libgomp1 is required by common
# CPU-backed PyTorch/Sentence Transformers installations.
RUN apt-get update \
    && apt-get install --no-install-recommends -y ca-certificates git libgomp1 \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system --gid 10001 appuser \
    && useradd --system --uid 10001 --gid appuser --create-home --home-dir /home/appuser appuser \
    && mkdir -p /app/data /app/logs \
    && chown -R appuser:appuser /app /home/appuser

COPY --from=builder /opt/venv /opt/venv

# Copy application source after dependency installation to preserve cache
# reuse when only backend code changes.
COPY app ./app

RUN chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
