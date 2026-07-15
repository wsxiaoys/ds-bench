FROM ubuntu:24.04

ARG POCHI_VERSION

RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep && \
    ln -s /usr/bin/python3 /usr/bin/python && \
    curl -fsSL https://getpochi.com/install.sh | bash -s ${POCHI_VERSION} && \
    ln -s /root/.pochi/bin/pochi /usr/local/bin/pochi && \
    pip3 install --break-system-packages pytest-json-ctrf "altair>=5.5" pandas && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN mkdir -p /home/user && chmod 0755 /home/user
RUN mkdir -p /home/user/project

LABEL Author="generate-harbor-tasks"
LABEL Description="Vega-Altair Python environment for building a self-contained radial stacked-arc HTML dashboard from local data."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - Vega-Altair (altair>=5.5) and pandas installed via pip3 for the visualization task
#   - /home/user/project: working directory where the executor writes the solution and radial.html
#   - No browser/network verification: tests parse the embedded Vega-Lite spec statically from the generated HTML

# Setup entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
