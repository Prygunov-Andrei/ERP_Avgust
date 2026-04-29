FROM python:3.12-slim

# TD-17: libxcb1, libxext6, libsm6, libgl1, libglib2.0-0 — нужны для cv2
# (используется внутри Docling TableFormer pipeline через docling-ibm-models).
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl libxcb1 libxext6 libsm6 libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . /app

EXPOSE 8003

HEALTHCHECK --interval=10s --timeout=5s --retries=3 \
    CMD curl -fsS http://localhost:8003/v1/healthz || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8003"]
