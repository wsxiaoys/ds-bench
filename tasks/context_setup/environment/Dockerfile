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
LABEL Description="Next.js App Router environment for tRPC v11 context setup task."

RUN cd /home/user && \
    npx --yes create-next-app@14 myproject --typescript --eslint --tailwind --src-dir --app --import-alias "@/*" --use-npm

# Container contents:
#   - always required libs: curl ca-certificates git python3 python3-pip python3-pytest bash
#   - Node.js v24 for the Next.js task environment
#   - /home/user/myproject: base Next.js application with src directory

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]