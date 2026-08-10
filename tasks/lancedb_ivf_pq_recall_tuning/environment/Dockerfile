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
        "numpy>=1.26,<3" \
        "pyarrow>=15" && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN mkdir -p /home/user && chmod 0755 /home/user

# Bake the precomputed, deterministic vector dataset into the environment at BUILD time.
# The data is generated fully offline with a fixed seed so both the task and the
# verifier observe identical arrays. No external embedding service is ever contacted.
RUN mkdir -p /home/user/recall_tuning/data && \
    cat > /tmp/gen_data.py <<'PYEOF' && \
    python3 /tmp/gen_data.py && \
    rm -f /tmp/gen_data.py
import numpy as np

DIM = 128
N_BASE = 60000
N_QUERY = 1000
N_CLUSTERS = 200
CENTER_SCALE = 1.0
NOISE_STD = 0.35
OUT_DIR = "/home/user/recall_tuning/data"

rng = np.random.default_rng(20240723)

# Fixed cluster centers give the corpus realistic (clustered) structure so that
# an IVF_PQ index can reach the recall target once query-time params are tuned.
centers = rng.normal(0.0, CENTER_SCALE, size=(N_CLUSTERS, DIM)).astype(np.float32)

base_assign = rng.integers(0, N_CLUSTERS, size=N_BASE)
base = centers[base_assign] + rng.normal(0.0, NOISE_STD, size=(N_BASE, DIM)).astype(np.float32)
base = base.astype(np.float32)

query_assign = rng.integers(0, N_CLUSTERS, size=N_QUERY)
queries = centers[query_assign] + rng.normal(0.0, NOISE_STD, size=(N_QUERY, DIM)).astype(np.float32)
queries = queries.astype(np.float32)

np.save(f"{OUT_DIR}/base_vectors.npy", base)
np.save(f"{OUT_DIR}/query_vectors.npy", queries)
print("base", base.shape, base.dtype)
print("query", queries.shape, queries.dtype)
PYEOF

LABEL Author="generate-harbor-tasks"
LABEL Description="LanceDB (Python, v0.34.0) offline environment with a precomputed 60000x128 float32 vector corpus and 1000-query held-out set for IVF_PQ ANN recall tuning."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - target library: lancedb==0.34.0 (plus numpy, pyarrow) installed via pip3, used fully offline on local filesystem
#   - /home/user/recall_tuning: project directory
#   - /home/user/recall_tuning/data/base_vectors.npy: precomputed (60000, 128) float32 corpus vectors (seeded, deterministic)
#   - /home/user/recall_tuning/data/query_vectors.npy: precomputed (1000, 128) float32 held-out query vectors (seeded, deterministic)

COPY test_initial_state.py /bootstrap/test_initial_state.py

# Setup entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
