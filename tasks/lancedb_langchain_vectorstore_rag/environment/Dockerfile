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
        "lancedb==0.25.2" \
        "langchain-community==0.3.27" \
        "langchain-core==0.3.75" \
        pyarrow numpy pandas && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN mkdir -p /home/user && chmod 0755 /home/user
RUN mkdir -p /home/user/rag

# Provided deterministic, fully-offline embedding model (do not modify).
RUN cat >/home/user/rag/local_embeddings.py <<'EOF'
import hashlib
import math
from typing import List

from langchain_core.embeddings import Embeddings


class HashEmbeddings(Embeddings):
    """Deterministic, fully offline embedding model.

    Maps text to a fixed 64-dimensional unit vector using a deterministic
    real-valued token-hashing scheme. No network access or model download is
    required, and identical input always yields an identical vector.
    """

    def __init__(self, dim: int = 64) -> None:
        self.dim = dim

    def _embed(self, text: str) -> List[float]:
        vec = [0.0] * self.dim
        for token in text.lower().split():
            digest = hashlib.sha256(token.encode("utf-8")).hexdigest()
            # Spread each token across several dimensions with real-valued,
            # deterministic weights so that distinct texts get distinct vectors
            # (avoiding distance ties).
            for j in range(4):
                idx = int(digest[j * 8:(j + 1) * 8], 16) % self.dim
                weight = (int(digest[32 + j * 6:38 + j * 6], 16) / float(0xFFFFFF)) - 0.5
                vec[idx] += weight
        norm = math.sqrt(sum(v * v for v in vec))
        if norm == 0.0:
            vec[0] = 1.0
            return vec
        return [v / norm for v in vec]

    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        return [self._embed(t) for t in texts]

    def embed_query(self, text: str) -> List[float]:
        return self._embed(text)
EOF

# Provided document corpus (do not modify).
RUN cat >/home/user/rag/corpus.json <<'EOF'
[
  {"doc_id": "d01", "text": "Install LanceDB with pip and connect to a local database directory on disk.", "source": "guide", "section": "install", "timestamp": 1704067200},
  {"doc_id": "d02", "text": "Quickstart guide to create a table add data and run your first vector search.", "source": "guide", "section": "quickstart", "timestamp": 1704153600},
  {"doc_id": "d03", "text": "Vector search finds nearest neighbors by comparing query embeddings to stored vectors.", "source": "guide", "section": "search", "timestamp": 1704240000},
  {"doc_id": "d04", "text": "Build an IVF PQ vector index to accelerate approximate nearest neighbor search at scale.", "source": "guide", "section": "indexing", "timestamp": 1704326400},
  {"doc_id": "d05", "text": "Filter search results using SQL where clauses on metadata fields before the vector search.", "source": "guide", "section": "filtering", "timestamp": 1704412800},
  {"doc_id": "d06", "text": "Configure an embedding model so vectors are generated automatically for each text row.", "source": "guide", "section": "embedding", "timestamp": 1704499200},
  {"doc_id": "d07", "text": "The search method returns results ordered by distance so call limit to cap the number of hits.", "source": "api", "section": "search", "timestamp": 1704585600},
  {"doc_id": "d08", "text": "Create index accepts num partitions and num sub vectors to tune recall and latency.", "source": "api", "section": "indexing", "timestamp": 1704672000},
  {"doc_id": "d09", "text": "The where method accepts DataFusion SQL predicates for metadata pre filtering.", "source": "api", "section": "filtering", "timestamp": 1704758400},
  {"doc_id": "d10", "text": "Open table and create table manage Arrow backed datasets on the local filesystem.", "source": "api", "section": "table", "timestamp": 1704844800},
  {"doc_id": "d11", "text": "The embedding registry exposes ndims and vector field helpers for schema definition.", "source": "api", "section": "embedding", "timestamp": 1704931200},
  {"doc_id": "d12", "text": "Hybrid search combines full text BM25 keyword matching with semantic vector similarity.", "source": "api", "section": "hybrid", "timestamp": 1705017600},
  {"doc_id": "d13", "text": "Semantic vector search powers retrieval augmented generation for question answering.", "source": "blog", "section": "search", "timestamp": 1705104000},
  {"doc_id": "d14", "text": "Store image and video bytes as binary blobs alongside their multimodal embeddings.", "source": "blog", "section": "multimodal", "timestamp": 1705190400},
  {"doc_id": "d15", "text": "Time travel lets you query a previous version of a dataset for reproducible audits.", "source": "blog", "section": "versioning", "timestamp": 1705276800},
  {"doc_id": "d16", "text": "Manual optimize and compaction merge small fragments to keep query latency low.", "source": "blog", "section": "performance", "timestamp": 1705363200},
  {"doc_id": "d17", "text": "A reranker reorders hybrid candidates to improve relevance of the final results.", "source": "blog", "section": "hybrid", "timestamp": 1705449600},
  {"doc_id": "d18", "text": "Local embedding models avoid network calls and keep the whole pipeline offline.", "source": "blog", "section": "embedding", "timestamp": 1705536000},
  {"doc_id": "d19", "text": "Escape single quotes inside SQL string literals to avoid unterminated string errors.", "source": "faq", "section": "filtering", "timestamp": 1705622400},
  {"doc_id": "d20", "text": "Pre filtering narrows the candidate set before search while post filtering trims results after.", "source": "faq", "section": "search", "timestamp": 1705708800},
  {"doc_id": "d21", "text": "Datasets under one hundred thousand vectors usually do not need an approximate index.", "source": "faq", "section": "install", "timestamp": 1705795200},
  {"doc_id": "d22", "text": "Increase nprobes and refine factor to reduce false positives from selective filters.", "source": "faq", "section": "indexing", "timestamp": 1705881600},
  {"doc_id": "d23", "text": "Strict Arrow typing means a float64 list will not fit a float32 vector column.", "source": "faq", "section": "table", "timestamp": 1705968000},
  {"doc_id": "d24", "text": "Match the embedding dimension of your model to the vector column width exactly.", "source": "faq", "section": "embedding", "timestamp": 1706054400}
]
EOF

LABEL Author="generate-harbor-tasks"
LABEL Description="Offline LangChain + LanceDB RAG retrieval task: local deterministic embeddings and a document corpus prepared in /home/user/rag."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - target/eval pip3 packages: lancedb==0.25.2, langchain-community==0.3.27, langchain-core==0.3.75, pyarrow, numpy, pandas
#   - /home/user/rag: project directory
#   - /home/user/rag/local_embeddings.py: provided deterministic offline HashEmbeddings (dim=64)
#   - /home/user/rag/corpus.json: provided 24-document corpus with doc_id/text/source/section/timestamp

COPY test_initial_state.py /bootstrap/test_initial_state.py

# Setup entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
