FROM python:3.10-slim

# Set environment options
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DEBIAN_FRONTEND=noninteractive \
    WEIGHTS_DIR=/app/weights

WORKDIR /app

# Install system utilities & OpenCV dependencies (libgl1 for cv2, libgomp1 for openmp)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libgl1 \
    libglib2.0-0 \
    libgomp1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY ai-services/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY ai-services/ .

# Copy weights directory into container if present (default to /app/weights)
# We can also mount this path in Docker Compose and Kubernetes
COPY model/saved_models/ /app/weights/

# Setup non-root execution permissions
RUN groupadd -g 10001 appgroup && \
    useradd -u 10001 -g appgroup -m -s /bin/bash appuser && \
    chown -R appuser:appgroup /app

USER appuser

# Expose microservice port
EXPOSE 8001

# Health check
HEALTHCHECK --interval=30s --timeout=15s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:8001/health || exit 1

# Start the inference server
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8001"]
