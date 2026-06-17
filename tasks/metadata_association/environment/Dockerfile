FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive
ENV PATH="/root/.pochi/bin:$PATH"

# Install dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    curl \
    jq \
    && rm -rf /var/lib/apt/lists/*

# Install Pochi CLI
RUN curl -fsSL https://getpochi.com/install.sh | bash

# Install e2b SDK and pytest
RUN pip3 install e2b pytest

# Setup user directory
RUN mkdir -p /home/user
WORKDIR /home/user
