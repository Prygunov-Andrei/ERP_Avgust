FROM python:3.12-slim

# Системные зависимости pipeline:
# - libxcb1/libxext6/libsm6/libgl1/libglib2.0-0 — cv2 (Docling TableFormer + Camelot)
# - ghostscript — Camelot lattice rendering
# - curl — healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl libxcb1 libxext6 libsm6 libgl1 libglib2.0-0 ghostscript \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# F8-01: pre-download Docling model weights (layout + tableformer + classifier
# + easyocr) на build phase. Без этого первый старт контейнера тянет ~1.2 GB
# с HuggingFace, чувствителен к сетевым сбоям и продлевает healthcheck.
# Default cache: /root/.cache/docling/models — Docling использует его при init.
ENV HF_HOME=/root/.cache/huggingface
RUN python -c "from docling.utils.model_downloader import download_models; download_models()"

COPY . /app

EXPOSE 8003

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -fsS http://localhost:8003/v1/healthz || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8003"]
