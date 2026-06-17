FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    ca-certificates \
    git \
    python3 \
    python3-pip \
    python3-pytest \
    bash \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js v20 via NodeSource
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Create project directory and initialize Node project
RUN mkdir -p /home/user/myproject

WORKDIR /home/user/myproject

# Initialize npm project and install Prisma
RUN npm init -y \
    && npm install prisma@^6 --save-dev \
    && npm install @prisma/client@^6

# Initialize Prisma with SQLite as the datasource provider
RUN npx prisma init --datasource-provider sqlite
RUN sed -i 's|provider *= *"prisma-client"|provider = "prisma-client-js"|' prisma/schema.prisma && \
    sed -i '/output[[:space:]]*=[[:space:]]*"\.\.\/generated\/prisma"/d' prisma/schema.prisma

# Ensure DATABASE_URL points to the SQLite file
RUN echo 'DATABASE_URL="file:./dev.db"' > .env
