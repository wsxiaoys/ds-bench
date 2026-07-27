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

RUN mkdir -p /home/user/etl_router/data && \
    cat >/home/user/etl_router/data/input.jsonl <<'EOF'
{"id": "a1", "category": "orders", "amount": 10.50, "currency": "USD"}
{"id": 2, "category": "payments", "amount": 100, "currency": "EUR"}
{"id": "r9", "category": "refunds", "amount": 42.42, "currency": "GBP"}
{not valid json
[1, 2, 3]
{"id": "b2", "category": "orders", "amount": 5.00, "currency": "USD", "extra": "ignored"}
{"category": "orders", "amount": 5.0, "currency": "USD"}
{"id": "c3", "amount": 5.0, "currency": "USD"}
{"id": "d4", "category": "orders", "currency": "USD"}
{"id": "e5", "category": "orders", "amount": 5.0}
{"id": ["x"], "category": "orders", "amount": 5.0, "currency": "USD"}
{"id": "f6", "category": 7, "amount": 5.0, "currency": "USD"}
{"id": "g7", "category": "orders", "amount": "5.0", "currency": "USD"}
{"id": "h8", "category": "orders", "amount": true, "currency": "USD"}
{"id": "i9", "category": "shipping", "amount": 5.0, "currency": "USD"}
{"id": "j10", "category": "orders", "amount": 0, "currency": "USD"}
{"id": "k11", "category": "payments", "amount": -3.5, "currency": "USD"}
{"id": "l12", "category": "orders", "amount": 5.0, "currency": "JPY"}

{"id": "m13", "category": "payments", "amount": 20.00, "currency": "USD"}
EOF

LABEL Author="generate-harbor-tasks"
LABEL Description="Bytewax 0.21.1 stream-processing task: validating ETL router with multi-sink routing and a dead-letter sink, seeded with a raw JSON-line dataset in /home/user/etl_router."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - bytewax==0.21.1 installed via pip3 (the target stream-processing framework)
#   - /home/user/etl_router: project directory the executor works in
#   - /home/user/etl_router/data/input.jsonl: seeded 20-line raw JSON-line dataset (Dataset A)

COPY test_initial_state.py /bootstrap/test_initial_state.py

# Setup entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
