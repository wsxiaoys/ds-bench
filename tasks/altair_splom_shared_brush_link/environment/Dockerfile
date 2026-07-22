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
    pip3 install --break-system-packages pytest-json-ctrf pochi-verifier pytest-xprocess requests altair pandas vl-convert-python && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN mkdir -p /home/user && chmod 0755 /home/user

# Provision the local, offline sensor dataset used for the SPLOM task.
# Three machine classes (A, B, C) with distinct centers so a brushed region is
# meaningful. Generated deterministically so the environment is reproducible.
RUN mkdir -p /home/user/altair_splom/data && \
    python3 - <<'PY'
import csv
import random

random.seed(20240715)

# (center_temperature, center_pressure, center_humidity, center_vibration)
CLASS_CENTERS = {
    "A": (62.0, 101.0, 40.0, 0.30),
    "B": (75.0, 108.0, 55.0, 0.55),
    "C": (88.0, 115.0, 70.0, 0.80),
}
SPREADS = (6.0, 3.5, 8.0, 0.12)
ROWS_PER_CLASS = 80

rows = []
for cls, centers in CLASS_CENTERS.items():
    for _ in range(ROWS_PER_CLASS):
        temperature = round(random.gauss(centers[0], SPREADS[0]), 3)
        pressure = round(random.gauss(centers[1], SPREADS[1]), 3)
        humidity = round(random.gauss(centers[2], SPREADS[2]), 3)
        vibration = round(random.gauss(centers[3], SPREADS[3]), 4)
        rows.append([temperature, pressure, humidity, vibration, cls])

random.shuffle(rows)

with open("/home/user/altair_splom/data/measurements.csv", "w", newline="") as f:
    writer = csv.writer(f)
    writer.writerow(["temperature", "pressure", "humidity", "vibration", "machine_class"])
    writer.writerows(rows)
PY

LABEL Author="generate-harbor-tasks"
LABEL Description="Vega-Altair task environment for building an interactive scatterplot matrix (SPLOM) with a shared brush; includes the browser verification environment."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - target library: altair + pandas + vl-convert-python (for self-contained/offline HTML export)
#   - browser verification dependencies: pochi-verifier, agent-browser, pytest-xprocess, requests, ffmpeg, and more
#   - /home/user/altair_splom: project directory
#   - /home/user/altair_splom/data/measurements.csv: local offline dataset (4 quantitative features + machine_class A/B/C)

# Setup initial tests and entrypoint script
COPY test_initial_state.py /bootstrap/test_initial_state.py

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
