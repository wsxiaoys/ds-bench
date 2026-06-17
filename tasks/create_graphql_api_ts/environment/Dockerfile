FROM ubuntu:24.04

RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep ssh && \
    curl -fsSL https://deb.nodesource.com/setup_24.x | bash - && \
    apt-get install -y --no-install-recommends nodejs && \
    pip3 install --break-system-packages pytest-json-ctrf requests && \
    curl -L https://encore.dev/install.sh | bash && \
    ln -s ~/.encore/bin/encore /usr/local/bin/encore && \
    ln -s ~/.encore/bin/git-remote-encore /usr/local/bin/git-remote-encore && \
    ln -s ~/.encore/bin/tsbundler-encore /usr/local/bin/tsbundler-encore && \
    ln -s ~/.encore/bin/tsparser-encore /usr/local/bin/tsparser-encore && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN mkdir -p /home/user && chmod 0755 /home/user

LABEL Author="generate-harbor-tasks"
LABEL Description="Encore.ts task environment with Node.js v24 and Encore CLI installed."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - additional apt packages: ssh (for git-remote-encore)
#   - always required pip3 packages: pytest-json-ctrf
#   - additional pip3 packages: requests (for test_final_state.py)
#   - Node.js v24
#   - Encore CLI installed via install.sh script and linked to /usr/local/bin
