FROM ubuntu:24.04

ARG POCHI_VERSION

RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep && \
    ln -s /usr/bin/python3 /usr/bin/python && \
    curl -fsSL https://getpochi.com/install.sh | bash -s ${POCHI_VERSION} && \
    ln -s /root/.pochi/bin/pochi /usr/local/bin/pochi && \
    pip3 install --break-system-packages \
        pytest-json-ctrf \
        "altair==5.5.0" \
        "pandas>=2.0" \
        "vl-convert-python>=1.7.0" && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN mkdir -p /home/user && chmod 0755 /home/user

# Project directory and the local input dataset (fully offline; no remote data URLs).
RUN mkdir -p /home/user/project/data && \
    cat >/home/user/project/data/regional_revenue.csv <<'EOF'
region,revenue_2023,revenue_2024
North,120,145
South,98,90
East,150,168
West,110,104
Central,75,88
Mountain,132,120
EOF

LABEL Author="generate-harbor-tasks"
LABEL Description="Vega-Altair task environment (altair, pandas, vl-convert-python) with a local regional revenue CSV for building an offline slope-graph HTML chart."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - target library: altair==5.5.0 (Vega-Altair) plus pandas
#   - verification dependency: vl-convert-python (renders the produced Vega-Lite spec to SVG offline, browser-equivalent)
#   - /home/user/project: task project directory
#   - /home/user/project/data/regional_revenue.csv: local input dataset (region, revenue_2023, revenue_2024; six regions)

# Setup initial tests and entrypoint script
COPY test_initial_state.py /bootstrap/test_initial_state.py

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
