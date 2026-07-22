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
        "altair>=5.2,<7" \
        pandas \
        numpy \
        vl-convert-python && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN mkdir -p /home/user && chmod 0755 /home/user

# Create the project skeleton and generate the local measurement dataset.
# The dataset is fully synthetic, deterministic (fixed seed) and stored locally;
# no remote dataset or network access is required at any point.
RUN mkdir -p /home/user/altair_boxplot/data /home/user/altair_boxplot/output && \
    python3 - <<'PY'
import csv
import numpy as np

rng = np.random.default_rng(20240607)
alloys = ["A356", "6061", "7075"]
treatments = ["AsCast", "HeatTreated"]
suppliers = ["North", "South"]
base = {"A356": 260, "6061": 310, "7075": 480}

rows = []
for al in alloys:
    for tr in treatments:
        for sup in suppliers:
            mu = base[al] + (40 if tr == "HeatTreated" else 0) + (15 if sup == "South" else 0)
            for v in rng.normal(mu, 22, 60):
                rows.append({
                    "alloy": al,
                    "treatment": tr,
                    "supplier": sup,
                    "strength_mpa": round(float(v), 2),
                })

path = "/home/user/altair_boxplot/data/measurements.csv"
with open(path, "w", newline="") as f:
    writer = csv.DictWriter(f, fieldnames=["alloy", "treatment", "supplier", "strength_mpa"])
    writer.writeheader()
    writer.writerows(rows)
print(f"Wrote {len(rows)} rows to {path}")
PY

LABEL Author="generate-harbor-tasks"
LABEL Description="Vega-Altair (Altair 6) environment with pandas, numpy, and vl-convert-python for building a grouped, faceted box-plot HTML report from a local CSV dataset."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - target library + task deps (pip3): altair (>=5.2,<7), pandas, numpy, vl-convert-python
#   - /home/user/altair_boxplot: project directory
#   - /home/user/altair_boxplot/data/measurements.csv: local, deterministic synthetic dataset (720 rows; columns alloy, treatment, supplier, strength_mpa)
#   - /home/user/altair_boxplot/output: empty directory where the agent writes grouped_boxplot.html

# Setup initial tests and entrypoint script
COPY test_initial_state.py /bootstrap/test_initial_state.py

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
