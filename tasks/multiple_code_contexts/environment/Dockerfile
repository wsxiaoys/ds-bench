FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

# Install Pochi CLI
RUN curl -fsSL https://getpochi.com/install.sh | bash
ENV PATH="/root/.pochi/bin:$PATH"

# Install Python dependencies
RUN pip install e2b-code-interpreter pytest

# Set working directory
WORKDIR /workspace
