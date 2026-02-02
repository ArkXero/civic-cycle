# pipeline/Dockerfile
# Python environment for BoardDocs fetching pipeline

FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first (for Docker layer caching)
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy pipeline code
COPY . .

# Run the pipeline
CMD ["python", "-m", "pipeline.main"]
