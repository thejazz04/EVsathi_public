# EVsathi XGBoost Demand Inference Microservice Dockerfile
FROM python:3.11-slim

WORKDIR /app

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    API_HOST=0.0.0.0 \
    API_PORT=8000 \
    MODEL_PATH=/app/model/models/xgboost_demand_v1.json \
    FEATURE_CONFIG_PATH=/app/model/training/feature_config.json \
    TRAINING_CONFIG_PATH=/app/model/training/training_config.json

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY model/requirements.txt /app/model/requirements.txt
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r /app/model/requirements.txt

# Copy required model, code, and reference data
COPY model/api /app/model/api
COPY model/models /app/model/models
COPY model/training /app/model/training
COPY model/data/processed /app/model/data/processed
COPY model/data/metadata /app/model/data/metadata

EXPOSE 8000

# Health check using FastAPI /health endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Start Uvicorn ASGI server
CMD ["uvicorn", "model.api.main:app", "--host", "0.0.0.0", "--port", "8000"]
