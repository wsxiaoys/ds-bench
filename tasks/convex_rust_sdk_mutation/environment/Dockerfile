FROM ubuntu:24.04

RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep build-essential && \
    curl -fsSL https://deb.nodesource.com/setup_24.x | bash - && \
    apt-get install -y --no-install-recommends nodejs && \
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y && \
    ln -s /root/.cargo/bin/cargo /usr/local/bin/cargo && \
    ln -s /root/.cargo/bin/rustc /usr/local/bin/rustc && \
    pip3 install --break-system-packages pytest-json-ctrf && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN mkdir -p /home/user && chmod 0755 /home/user
RUN mkdir -p /home/user/myproject

LABEL Author="generate-harbor-tasks"
LABEL Description="Convex Rust SDK task environment with Node.js v24 and Rust installed."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - build-essential for compiling Rust dependencies
#   - always required pip3 packages: pytest-json-ctrf
#   - Node.js v24 for Convex CLI
#   - Rust and Cargo for Rust SDK
#   - /home/user/myproject: directory for the project
