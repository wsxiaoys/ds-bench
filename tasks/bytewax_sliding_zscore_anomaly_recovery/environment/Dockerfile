FROM ubuntu:24.04

ARG POCHI_VERSION

RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep && \
    ln -s /usr/bin/python3 /usr/bin/python && \
    curl -fsSL https://getpochi.com/install.sh | bash -s ${POCHI_VERSION} && \
    ln -s /root/.pochi/bin/pochi /usr/local/bin/pochi && \
    pip3 install --break-system-packages pytest-json-ctrf bytewax==0.21.1 && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN mkdir -p /home/user && chmod 0755 /home/user

# Create the project directory and seed the deterministic sensor-readings dataset.
RUN mkdir -p /home/user/project/data && \
    python3 - <<'PYEOF'
import json
from datetime import datetime, timedelta, timezone

T0 = datetime(2024, 3, 1, 12, 0, 0, tzinfo=timezone.utc)


def iso(dt):
    return dt.isoformat()


rows = []

# sensor temp-1: a reading every 5s for 300s (61 readings), small wiggle plus
# two large spikes (one positive, one negative) that land inside dense windows.
for i in range(61):
    ts = T0 + timedelta(seconds=5 * i)
    val = 20.0 + (i % 5) * 0.1
    if i == 30:
        val = 60.0
    if i == 45:
        val = -10.0
    rows.append({"sensor_id": "temp-1", "ts": iso(ts), "value": round(val, 3)})

# sensor temp-2: a reading every 10s for 300s (31 readings) with a single spike.
for i in range(31):
    ts = T0 + timedelta(seconds=10 * i)
    val = 5.0 + (i % 3) * 0.5
    if i == 15:
        val = 40.0
    rows.append({"sensor_id": "temp-2", "ts": iso(ts), "value": round(val, 3)})

# flat-1: a constant value, so every window has std == 0 (no anomalies possible).
for i in range(20):
    ts = T0 + timedelta(seconds=5 * i)
    rows.append({"sensor_id": "flat-1", "ts": iso(ts), "value": 100.0})

# sparse-1: only two readings far apart, producing single-reading windows.
rows.append({"sensor_id": "sparse-1", "ts": iso(T0), "value": 7.5})
rows.append({"sensor_id": "sparse-1", "ts": iso(T0 + timedelta(seconds=200)), "value": 9.5})

rows.sort(key=lambda r: r["ts"])

with open("/home/user/project/data/sensor_readings.jsonl", "w") as f:
    for r in rows:
        f.write(json.dumps(r) + "\n")
PYEOF

LABEL Author="generate-harbor-tasks"
LABEL Description="Bytewax 0.21.1 environment with a seeded sensor-readings dataset for sliding-window z-score anomaly detection with SQLite recovery."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - bytewax==0.21.1 installed via pip3 (the target stream-processing framework)
#   - /home/user/project: task project directory (executor adds pipeline code, run.sh, outputs, recovery/)
#   - /home/user/project/data/sensor_readings.jsonl: seeded, deterministic input dataset

COPY test_initial_state.py /bootstrap/test_initial_state.py

# Setup entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
