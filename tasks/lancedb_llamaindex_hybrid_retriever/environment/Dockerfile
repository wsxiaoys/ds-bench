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
        "lancedb==0.34.0" \
        "llama-index-core==0.14.23" \
        "llama-index-vector-stores-lancedb==0.5.0" \
        "tantivy==0.26.0" \
        "pandas==3.0.3" && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN mkdir -p /home/user && chmod 0755 /home/user

RUN mkdir -p /home/user/project/data && \
    cat >/home/user/project/data/corpus.json <<'EOF'
[
  {"id": "d1", "text": "neural networks and deep learning models for image classification", "category": "ml", "year": 2019},
  {"id": "d2", "text": "gradient descent optimization for training deep neural networks", "category": "ml", "year": 2021},
  {"id": "d3", "text": "relational databases and sql query optimization techniques", "category": "db", "year": 2018},
  {"id": "d4", "text": "distributed systems consensus algorithms like raft and paxos", "category": "systems", "year": 2020},
  {"id": "d5", "text": "vector databases enable fast similarity search over embeddings", "category": "db", "year": 2022},
  {"id": "d6", "text": "transformer models revolutionized natural language processing", "category": "ml", "year": 2023},
  {"id": "d7", "text": "full text search using an inverted index and bm25 ranking", "category": "db", "year": 2016},
  {"id": "d8", "text": "reinforcement learning agents optimize reward through exploration", "category": "ml", "year": 2017},
  {"id": "d9", "text": "graph databases model relationships between connected entities", "category": "db", "year": 2021},
  {"id": "d10", "text": "convolutional neural networks for computer vision tasks", "category": "ml", "year": 2015}
]
EOF

LABEL Author="generate-harbor-tasks"
LABEL Description="Offline LlamaIndex + LanceDB hybrid retriever task environment with a seeded local document corpus."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - target libraries: lancedb==0.34.0, llama-index-core==0.14.23,
#     llama-index-vector-stores-lancedb==0.5.0, tantivy==0.26.0, pandas==3.0.3 (all used offline at runtime)
#   - /home/user/project: task project directory
#   - /home/user/project/data/corpus.json: seeded local document corpus (10 records)

COPY test_initial_state.py /bootstrap/test_initial_state.py

# Setup entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
