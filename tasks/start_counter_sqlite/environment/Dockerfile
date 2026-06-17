FROM ubuntu:24.04

RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep \
        build-essential python3-dev pkg-config && \
    ln -s /usr/bin/python3 /usr/bin/python && \
    curl -fsSL https://deb.nodesource.com/setup_24.x | bash - && \
    apt-get install -y --no-install-recommends nodejs && \
    pip3 install --break-system-packages pytest-json-ctrf requests && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN mkdir -p /home/user && chmod 0755 /home/user
RUN mkdir -p /home/user/myproject && chmod 0755 /home/user/myproject

LABEL Author="generate-harbor-tasks"
LABEL Description="TanStack Start full-stack environment (Node.js v24, build tools for native SQLite modules) with an empty /home/user/myproject scaffold target."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - build toolchain (build-essential, python3-dev, pkg-config) so native modules like better-sqlite3 can compile from source if no prebuilt is available
#   - Node.js v24 for TanStack Start scaffolding, build, and run
#   - always required pip3 packages: pytest-json-ctrf
#   - additional pip3 packages: requests (used by tests/test_final_state.py)
#   - /home/user/myproject: empty project directory where the agent scaffolds the TanStack Start app
