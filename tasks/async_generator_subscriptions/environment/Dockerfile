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
LABEL Description="tRPC v11 environment with Node.js v24 installed for AsyncGenerator subscriptions."

RUN mkdir -p /home/user/project

# Container contents:
#   - always required libs: curl ca-certificates git python3 python3-pip python3-pytest bash
#   - Node.js v24 for the tRPC task environment
#   - /home/user/project: base directory for the project

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]
