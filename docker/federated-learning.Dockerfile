FROM python:3.10-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY federated-learning/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY federated-learning/ .

# Setup non-root execution permissions
RUN groupadd -g 10001 appgroup && \
    useradd -u 10001 -g appgroup -m -s /bin/bash appuser && \
    chown -R appuser:appgroup /app

USER appuser

EXPOSE 8004

# Run central coordinator by default
CMD ["uvicorn", "coordinator:app", "--host", "0.0.0.0", "--port", "8004"]
