FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive
ENV PATH="/root/.pochi/bin:$PATH"

RUN apt-get update && apt-get install -y \
    curl \
    wget \
    git \
    python3 \
    python3-pip python3-pytest \
    nodejs \
    npm \
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g @e2b/cli

RUN curl -fsSL https://getpochi.com/install.sh | bash

RUN useradd -m -s /bin/bash user
WORKDIR /home/user
