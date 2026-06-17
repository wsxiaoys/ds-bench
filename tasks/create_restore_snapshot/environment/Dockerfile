FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y \
    curl \
    python3 \
    python3-pip \
    nodejs \
    npm \
    git \
    && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL https://getpochi.com/install.sh | bash
ENV PATH="/root/.pochi/bin:$PATH"

RUN pip3 install e2b==2.14.1 pytest
RUN npm install -g e2b@2.14.1

WORKDIR /root
