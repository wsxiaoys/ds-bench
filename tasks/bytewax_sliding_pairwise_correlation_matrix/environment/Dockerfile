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

RUN mkdir -p /home/user/project/data /home/user/project/output && \
    cat >/home/user/project/data/readings.jsonl <<'EOF'
{"sensor": "s1", "ts": "2024-01-01T00:00:00Z", "value": 1.0}
{"sensor": "s2", "ts": "2024-01-01T00:00:00Z", "value": 2.0}
{"sensor": "s3", "ts": "2024-01-01T00:00:00Z", "value": 10.0}
{"sensor": "s1", "ts": "2024-01-01T00:00:10Z", "value": 2.0}
{"sensor": "s2", "ts": "2024-01-01T00:00:10Z", "value": 4.1}
{"sensor": "s3", "ts": "2024-01-01T00:00:10Z", "value": 8.0}
{"sensor": "s1", "ts": "2024-01-01T00:00:20Z", "value": 3.0}
{"sensor": "s2", "ts": "2024-01-01T00:00:20Z", "value": 5.9}
{"sensor": "s3", "ts": "2024-01-01T00:00:20Z", "value": 6.0}
{"sensor": "s1", "ts": "2024-01-01T00:00:30Z", "value": 4.0}
{"sensor": "s2", "ts": "2024-01-01T00:00:30Z", "value": 8.2}
{"sensor": "s1", "ts": "2024-01-01T00:00:40Z", "value": 5.0}
{"sensor": "s2", "ts": "2024-01-01T00:00:40Z", "value": 9.8}
{"sensor": "s4", "ts": "2024-01-01T00:00:40Z", "value": 1.0}
{"sensor": "s1", "ts": "2024-01-01T00:00:50Z", "value": 6.0}
{"sensor": "s2", "ts": "2024-01-01T00:00:50Z", "value": 12.1}
{"sensor": "s4", "ts": "2024-01-01T00:00:50Z", "value": 2.0}
{"sensor": "s1", "ts": "2024-01-01T00:01:00Z", "value": 5.0}
{"sensor": "s2", "ts": "2024-01-01T00:01:00Z", "value": 1.0}
{"sensor": "s3", "ts": "2024-01-01T00:01:00Z", "value": 4.0}
{"sensor": "s1", "ts": "2024-01-01T00:01:10Z", "value": 5.0}
{"sensor": "s2", "ts": "2024-01-01T00:01:10Z", "value": 2.0}
{"sensor": "s3", "ts": "2024-01-01T00:01:10Z", "value": 3.0}
{"sensor": "s1", "ts": "2024-01-01T00:01:20Z", "value": 5.0}
{"sensor": "s2", "ts": "2024-01-01T00:01:20Z", "value": 3.0}
{"sensor": "s3", "ts": "2024-01-01T00:01:20Z", "value": 2.0}
{"sensor": "s1", "ts": "2024-01-01T00:01:30Z", "value": 5.0}
{"sensor": "s2", "ts": "2024-01-01T00:01:30Z", "value": 4.0}
{"sensor": "s3", "ts": "2024-01-01T00:01:30Z", "value": 1.0}
{"sensor": "s1", "ts": "2024-01-01T00:02:00Z", "value": 1.0}
{"sensor": "s2", "ts": "2024-01-01T00:02:00Z", "value": 9.0}
{"sensor": "s1", "ts": "2024-01-01T00:02:10Z", "value": 2.0}
{"sensor": "s1", "ts": "2024-01-01T00:02:20Z", "value": 3.0}
EOF

LABEL Author="generate-harbor-tasks"
LABEL Description="Bytewax 0.21.1 environment with a multi-sensor time-series JSONL dataset for a per-window pairwise Pearson correlation pipeline task."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - bytewax==0.21.1 installed via pip3 for the stream-processing task
#   - /home/user/project: project directory (agent writes dataflow.py here)
#   - /home/user/project/data/readings.jsonl: fixed multi-sensor input dataset (initial state)
#   - /home/user/project/output: directory for the pipeline's JSONL output

COPY test_initial_state.py /bootstrap/test_initial_state.py

# Setup entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
