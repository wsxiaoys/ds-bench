FROM ubuntu:24.04

RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep jq && \
    pip3 install --break-system-packages pytest-json-ctrf && \
    curl -fsSL -o /usr/local/bin/daytona \
        https://github.com/daytonaio/daytona/releases/download/v0.180.0/daytona-linux-amd64 && \
    chmod +x /usr/local/bin/daytona && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN mkdir -p /home/user && chmod 0755 /home/user
RUN mkdir -p /home/user/myproject

LABEL Author="generate-harbor-tasks"
LABEL Description="Ubuntu 24.04 environment with the Daytona CLI (v0.180.0) and jq pre-installed for snapshot management tasks."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - extra apt package: jq (for parsing daytona snapshot list --format json)
#   - always required pip3 packages: pytest-json-ctrf
#   - Daytona CLI v0.180.0 binary at /usr/local/bin/daytona for snapshot management
#   - /home/user/myproject: project directory for the snapshot task outputs
