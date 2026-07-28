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
