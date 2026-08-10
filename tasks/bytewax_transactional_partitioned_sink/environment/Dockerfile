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

# Seed the project directory with the fixed input dataset (events.json).
# 20 events, seq 0..19, keys cycling over 5 categories, value = seq + 1.
RUN mkdir -p /home/user/project && \
    python3 -c "import json; keys=['alpha','beta','gamma','delta','epsilon']; data=[{'seq':i,'key':keys[i%len(keys)],'value':i+1} for i in range(20)]; open('/home/user/project/events.json','w').write(json.dumps(data, indent=2) + '\n')"

LABEL Author="generate-harbor-tasks"
LABEL Description="Bytewax 0.21.1 environment with a project containing events.json for a transactional partitioned-sink exactly-once recovery task."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - bytewax==0.21.1 installed via pip3 (Python-native stream processor)
#   - /home/user/project: task project directory
#   - /home/user/project/events.json: fixed input dataset (20 keyed events)

COPY test_initial_state.py /bootstrap/test_initial_state.py

# Setup entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
