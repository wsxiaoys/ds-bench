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
LABEL Description="Node.js project with tRPC v11 dependencies installed for testing AsyncGenerator subscriptions."

RUN mkdir -p /home/user/project && \
    cd /home/user/project && \
    npm init -y && \
    npm install @trpc/server@next @trpc/client@next zod tsx typescript @types/node

# Container contents:
#   - Node.js v24 installed.
#   - /home/user/project: Node.js project initialized with tRPC v11, zod, and typescript installed.

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]
