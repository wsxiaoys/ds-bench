FROM ubuntu:22.04

ARG POCHI_VERSION

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y \
    curl ripgrep \
    python3 \
    python3-pip \
    nodejs \
    npm \
    git \
    && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL https://getpochi.com/install.sh | bash -s ${POCHI_VERSION} && ln -s /root/.pochi/bin/pochi /usr/local/bin/pochi
ENV PATH="/root/.pochi/bin:$PATH"


RUN pip3 install e2b==2.14.1 pytest
RUN npm install -g e2b@2.14.1

WORKDIR /root
