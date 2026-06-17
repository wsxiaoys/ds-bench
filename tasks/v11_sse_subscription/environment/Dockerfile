FROM ubuntu:24.04

RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl ca-certificates git python3 python3-pip python3-pytest bash && \
    curl -fsSL https://deb.nodesource.com/setup_24.x | bash - && \
    apt-get install -y --no-install-recommends nodejs && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN mkdir -p /home/user && chmod 0755 /home/user

LABEL Author="any-task-builder"
LABEL Description="tRPC v11 project with SSE subscription dependencies."

RUN mkdir -p /home/user/project && \
    cd /home/user/project && \
    npm init -y && \
    npm install @trpc/server@next @trpc/client@next express zod cors eventsource tsx typescript @types/express @types/cors @types/eventsource @types/node

# Container contents:
#   - Node.js v24 installed
#   - /home/user/project: tRPC v11 project with express, zod, cors, and eventsource installed.

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]
