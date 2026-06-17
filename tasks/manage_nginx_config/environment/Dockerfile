FROM ubuntu:24.04

RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl ca-certificates git python3 python3-pip python3-venv python3-pytest bash ripgrep && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    rm -rf /var/lib/apt/lists/*
RUN npm i -g @e2b/cli

RUN curl -fsSL https://getpochi.com/install.sh | bash
ENV PATH="/root/.pochi/bin:$PATH"

RUN mkdir -p /home/user && chmod 0755 /home/user

WORKDIR /home/user

LABEL Author="e2b-task-builder"
LABEL Description="E2B task environment for managing nginx configuration."

# Environment is ready for the user to write their provisioning script.
CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]
