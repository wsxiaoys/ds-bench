FROM ubuntu:22.04

ARG POCHI_VERSION

ENV DEBIAN_FRONTEND=noninteractive

# Install dependencies
RUN apt-get update && apt-get install -y \
    python3 ripgrep \
    python3-pip \
    curl \
    jq \
    && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL https://getpochi.com/install.sh | bash -s ${POCHI_VERSION} && ln -s /root/.pochi/bin/pochi /usr/local/bin/pochi


# Install e2b SDK and pytest
RUN pip3 install e2b pytest

# Setup user directory
RUN mkdir -p /home/user
WORKDIR /home/user
