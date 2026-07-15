FROM ubuntu:24.04

ARG POCHI_VERSION

RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep && \
    ln -s /usr/bin/python3 /usr/bin/python && \
    curl -fsSL https://getpochi.com/install.sh | bash -s ${POCHI_VERSION} && \
    ln -s /root/.pochi/bin/pochi /usr/local/bin/pochi && \
    pip3 install --break-system-packages pytest-json-ctrf altair pandas numpy && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN mkdir -p /home/user && chmod 0755 /home/user

# Create the Altair task project and generate the local experiment dataset.
# The data is generated deterministically (fixed seed) and bundled locally so the
# task never needs any network access or remote dataset.
RUN mkdir -p /home/user/altair-task/data && \
    mkdir -p /home/user/altair-task/output && \
    python3 - <<'EOF'
import csv
import random

random.seed(20240715)

# Four treatment groups with distinct means/spreads and many replicate measurements.
group_params = {
    "A": (50.0, 6.0, 35),
    "B": (58.0, 8.0, 40),
    "C": (46.0, 5.0, 30),
    "D": (62.0, 10.0, 38),
}

rows = []
for group, (mean, std, n) in group_params.items():
    for _ in range(n):
        rows.append({"group": group, "response": round(random.gauss(mean, std), 4)})

with open("/home/user/altair-task/data/measurements.csv", "w", newline="") as f:
    writer = csv.DictWriter(f, fieldnames=["group", "response"])
    writer.writeheader()
    writer.writerows(rows)
EOF

LABEL Author="generate-harbor-tasks"
LABEL Description="Vega-Altair task environment with a bundled local experiment CSV for building a grouped 95% confidence-interval layered chart."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - target library: altair (with pandas + numpy) installed via pip3
#   - /home/user/altair-task: project directory
#   - /home/user/altair-task/data/measurements.csv: bundled local experiment data (4 groups A/B/C/D, many replicates)
#   - /home/user/altair-task/output: directory for the generated chart.html

# Setup entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
