FROM ubuntu:24.04

ARG POCHI_VERSION
ARG AGENT_BROWSER_VERSION=0.27.3-pochi

RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep \
        ffmpeg libxcb-shm0 libx11-xcb1 libx11-6 libxcb1 libxext6 libxrandr2 libxcomposite1 libxcursor1 libxdamage1 libxfixes3 libxi6 libgtk-3-0t64 libpangocairo-1.0-0 libpango-1.0-0 libatk1.0-0t64 libcairo-gobject2 libcairo2 libgdk-pixbuf-2.0-0 libxrender1 libasound2t64 libfreetype6 libfontconfig1 libdbus-1-3 libnss3 libnspr4 libatk-bridge2.0-0t64 libdrm2 libxkbcommon0 libatspi2.0-0t64 libcups2t64 libxshmfence1 libgbm1 && \
    ln -s /usr/bin/python3 /usr/bin/python && \
    curl -fsSL https://getpochi.com/install.sh | bash -s ${POCHI_VERSION} && \
    ln -s /root/.pochi/bin/pochi /usr/local/bin/pochi && \
    curl -fsSL https://github.com/TabbyML/agent-browser/releases/download/v${AGENT_BROWSER_VERSION}/install.sh | bash && \
    ln -s /root/.pochi/bin/agent-browser /usr/local/bin/agent-browser && \
    agent-browser install && \
    pip3 install --break-system-packages pytest-json-ctrf pytest-xprocess pochi-verifier altair pandas && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN mkdir -p /home/user && chmod 0755 /home/user

# Generate the local long-form metrics dataset (no network/remote data source).
RUN mkdir -p /home/user/project && \
    python3 - <<'PY'
import csv, math
from datetime import date, timedelta

start = date(2024, 1, 1)
n_days = 45

# Four metrics on deliberately very different numeric ranges so that a shared
# y-axis would be unreadable and independent y scales are required.
def throughput(i):   # requests/min, thousands
    return round(5200 + 900 * math.sin(i / 5.0) + 40 * i, 1)
def latency(i):      # milliseconds, tens
    return round(42 + 8 * math.sin(i / 3.0 + 1) + 0.15 * i, 2)
def error_rate(i):   # fraction, 0..~0.05
    return round(0.012 + 0.010 * (1 + math.sin(i / 4.0 + 2)) / 2, 4)
def cpu_load(i):     # percent, 0..100
    return round(55 + 20 * math.sin(i / 6.0 + 0.5), 1)

series = {
    "Throughput": throughput,
    "Latency": latency,
    "ErrorRate": error_rate,
    "CpuLoad": cpu_load,
}

rows = []
for i in range(n_days):
    d = (start + timedelta(days=i)).isoformat()
    for name, fn in series.items():
        rows.append({"date": d, "series": name, "value": fn(i)})

with open("/home/user/project/metrics.csv", "w", newline="") as f:
    writer = csv.DictWriter(f, fieldnames=["date", "series", "value"])
    writer.writeheader()
    writer.writerows(rows)
PY

LABEL Author="generate-harbor-tasks"
LABEL Description="Vega-Altair task environment with a local long-form metrics CSV and browser verification stack for building faceted independent-scale line charts."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - target library: altair (Vega-Altair) + pandas, installed via pip3
#   - browser verification dependencies: pochi-verifier, agent-browser, ffmpeg, and X/GTK libs
#   - test dependencies: pytest-xprocess (serves the generated HTML for the browser check)
#   - /home/user/project: task project directory
#   - /home/user/project/metrics.csv: local long-form dataset (date, series, value) with 4 series

# Setup initial tests and entrypoint script
COPY test_initial_state.py /bootstrap/test_initial_state.py

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
