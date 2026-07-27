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

# Create the project scaffold and generate the deterministic input event stream.
RUN mkdir -p /home/user/project/data /home/user/project/out && \
    python3 - <<'PY'
import json
from datetime import datetime, timedelta, timezone

ALIGN = datetime(2024, 1, 1, 0, 0, 0, tzinfo=timezone.utc)

# counts[item][window_index] = number of events for that item in that window.
counts = {
    "apple": {0: 3, 1: 10, 2: 4, 3: 12, 4: 12},
    "banana": {0: 2, 2: 8, 3: 8},
    "cherry": {1: 5, 2: 10, 4: 10},
    "date": {0: 9, 1: 1, 2: 1, 3: 1},
    "elderberry": {4: 7},
    "fig": {2: 5, 3: 10, 4: 10},
}

events = []
for item, per_window in counts.items():
    for w, c in per_window.items():
        for s in range(1, c + 1):
            ts = ALIGN + timedelta(seconds=w * 60 + s)
            events.append({"item": item, "ts": ts.isoformat()})

# Emit events in ascending event-time order.
events.sort(key=lambda e: (e["ts"], e["item"]))

with open("/home/user/project/data/events.jsonl", "w") as f:
    for ev in events:
        f.write(json.dumps(ev) + "\n")
PY

LABEL Author="generate-harbor-tasks"
LABEL Description="Bytewax 0.21.1 environment with a deterministic event stream for a cascading event-time top-K and trend-detection dataflow task."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - bytewax==0.21.1 installed via pip3 (Python-native stream processing framework)
#   - /home/user/project: task project directory (working dir for `python -m bytewax.run pipeline:flow`)
#   - /home/user/project/data/events.jsonl: deterministic input event stream (ascending event time)
#   - /home/user/project/out: directory where the pipeline writes topk.jsonl and trending.jsonl

COPY test_initial_state.py /bootstrap/test_initial_state.py

# Setup entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
