FROM ubuntu:24.04

RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep ssh golang-go && \
    pip3 install --break-system-packages pytest-json-ctrf requests && \
    curl -L https://encore.dev/install.sh | bash && \
    ln -s /root/.encore/bin/encore /usr/local/bin/encore && \
    ln -s /root/.encore/bin/git-remote-encore /usr/local/bin/git-remote-encore && \
    ln -s /root/.encore/bin/tsbundler-encore /usr/local/bin/tsbundler-encore && \
    ln -s /root/.encore/bin/tsparser-encore /usr/local/bin/tsparser-encore && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN mkdir -p /home/user && chmod 0755 /home/user
RUN mkdir -p /home/user/myproject

LABEL Author="generate-harbor-tasks"
LABEL Description="Encore Go multi-service API task environment."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - additional apt packages: ssh golang-go
#   - additional pip3 packages: requests
#   - Encore CLI installed via script
#   - /home/user/myproject: directory for the project
