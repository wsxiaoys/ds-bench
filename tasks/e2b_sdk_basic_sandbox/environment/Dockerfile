FROM ubuntu:24.04

ARG POCHI_VERSION

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y \
    curl ripgrep \
    wget \
    git \
    python3 \
    python3-pip python3-pytest \
    nodejs \
    npm \
    && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL https://getpochi.com/install.sh | bash -s ${POCHI_VERSION} && ln -s /root/.pochi/bin/pochi /usr/local/bin/pochi

RUN npm install -g @e2b/cli


RUN useradd -m -s /bin/bash user
WORKDIR /home/user
