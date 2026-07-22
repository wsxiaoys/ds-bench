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
        altair==5.5.0 \
        pandas==2.2.3 \
        vl-convert-python==1.7.0 && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN mkdir -p /home/user && chmod 0755 /home/user

# Create the project directory and bundle a deterministic local dataset.
# Three regions with distinct linear relationships and noise levels so that
# each region's regression R^2 differs. No network / remote datasets are used.
RUN mkdir -p /home/user/altair_chart/data && \
    python3 - <<'PY'
import csv
import random

random.seed(20240115)

# (region, slope, intercept, noise_sd)
regions = [
    ("North", 2.00, 5.0, 6.0),
    ("South", 1.20, 20.0, 18.0),
    ("West", 3.10, -2.0, 30.0),
]

rows = []
for name, slope, intercept, noise in regions:
    for _ in range(60):
        spend = round(random.uniform(5.0, 100.0), 2)
        sales = round(intercept + slope * spend + random.gauss(0.0, noise), 2)
        rows.append((spend, sales, name))

with open("/home/user/altair_chart/data/marketing.csv", "w", newline="") as f:
    writer = csv.writer(f)
    writer.writerow(["spend", "sales", "region"])
    writer.writerows(rows)
PY

LABEL Author="generate-harbor-tasks"
LABEL Description="Vega-Altair task environment with a bundled local marketing dataset for a layered LOESS + regression overlay chart, verified offline via vl-convert."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - target library: altair==5.5.0 (Vega-Lite v5.20.1)
#   - verification/support pip3 packages: pandas==2.2.3, vl-convert-python==1.7.0 (offline SVG rendering)
#   - /home/user/altair_chart: task project directory
#   - /home/user/altair_chart/data/marketing.csv: bundled local dataset (spend, sales, region)

# Setup initial tests and entrypoint script
COPY test_initial_state.py /bootstrap/test_initial_state.py

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
