FROM ubuntu:24.04

# Install base packages, jq, and the Daytona CLI binary from the official GitHub release.
RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep jq && \
    pip3 install --break-system-packages pytest-json-ctrf && \
    ARCH="$(dpkg --print-architecture)" && \
    case "$ARCH" in \
        amd64) DAYTONA_ARCH=amd64 ;; \
        arm64) DAYTONA_ARCH=arm64 ;; \
        *) echo "Unsupported architecture: $ARCH" && exit 1 ;; \
    esac && \
    curl -fsSL -o /usr/local/bin/daytona \
        "https://github.com/daytonaio/daytona/releases/download/v0.180.0/daytona-linux-${DAYTONA_ARCH}" && \
    chmod +x /usr/local/bin/daytona && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN mkdir -p /home/user && chmod 0755 /home/user
RUN mkdir -p /home/user/myproject

LABEL Author="generate-harbor-tasks"
LABEL Description="Ubuntu 24.04 environment with the Daytona CLI v0.180.0 and jq installed for listing Daytona sandboxes via the CLI."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - jq for JSON parsing in the task shell script
#   - Daytona CLI v0.180.0 binary installed at /usr/local/bin/daytona
#   - /home/user/myproject: working directory for the task outputs (sandboxes.json, output.log)
