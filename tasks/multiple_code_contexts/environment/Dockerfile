FROM python:3.11-slim

ARG POCHI_VERSION

# Install system dependencies
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL https://getpochi.com/install.sh | bash -s ${POCHI_VERSION} && ln -s /root/.pochi/bin/pochi /usr/local/bin/pochi
ENV PATH="/root/.pochi/bin:$PATH"


# Install Python dependencies
RUN pip install e2b-code-interpreter pytest

# Set working directory
WORKDIR /workspace
