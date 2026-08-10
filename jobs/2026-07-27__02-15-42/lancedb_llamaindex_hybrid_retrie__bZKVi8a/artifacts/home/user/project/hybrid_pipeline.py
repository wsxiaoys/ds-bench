import os
import json
import hashlib
import re
import math
from typing import List, Dict, Any, Optional

import lancedb
from llama_index.core import VectorStoreIndex, StorageContext, Settings
from llama_index.core.schema import TextNode
from llama_index.vector_stores.lancedb import LanceDBVectorStore
from llama_index.core.embeddings import BaseEmbedding
from llama_index.core.vector_stores import MetadataFilters

# 1. Configure LlamaIndex to be completely offline
Settings.llm = None

# 2. Define the deterministic local embedding function
class LocalCustomEmbedding(BaseEmbedding):
    def _get_query_embedding(self, query: str) -> List[float]:
        return self._compute_embedding(query)

    async def _aget_query_embedding(self, query: str) -> List[float]:
        return self._compute_embedding(query)

    def _get_text_embedding(self, text: str) -> List[float]:
        return self._compute_embedding(text)

    async def _aget_text_embedding(self, text: str) -> List[float]:
        return self._compute_embedding(text)

    def _compute_embedding(self, text: str) -> List[float]:
        tokens = re.findall(r'[a-z0-9]+', text.lower())
        vec = [0.0] * 32
        for token in tokens:
            idx = int(hashlib.sha256(token.encode("utf-8")).hexdigest(), 16) % 32
            vec[idx] += 1.0
        
        # L2-normalize the vector
        norm = math.sqrt(sum(x * x for x in vec))
        if norm > 0:
            vec = [x / norm for x in vec]
        return vec

# Set global embedding model
Settings.embed_model = LocalCustomEmbedding()

# 3. Connect to LanceDB and create/load index
DB_DIR = "/home/user/project/lancedb_data"
TABLE_NAME = "corpus_index"
CORPUS_PATH = "/home/user/project/data/corpus.json"

db = lancedb.connect(DB_DIR)

# Check if table exists
table_exists = TABLE_NAME in db.table_names()

vector_store = LanceDBVectorStore(
    connection=db,
    table_name=TABLE_NAME,
    query_type="hybrid"
)

storage_context = StorageContext.from_defaults(vector_store=vector_store)

if not table_exists:
    # Load corpus
    with open(CORPUS_PATH, "r", encoding="utf-8") as f:
        corpus = json.load(f)
    
    nodes = []
    for item in corpus:
        node = TextNode(
            text=item["text"],
            id_=item["id"],
            metadata={
                "category": item["category"],
                "year": item["year"]
            },
            excluded_embed_metadata_keys=["category", "year"],
            excluded_llm_metadata_keys=["category", "year"]
        )
        nodes.append(node)
    
    index = VectorStoreIndex(
        nodes,
        storage_context=storage_context,
        embed_model=Settings.embed_model
    )
else:
    index = VectorStoreIndex.from_vector_store(
        vector_store,
        storage_context=storage_context,
        embed_model=Settings.embed_model
    )

def retrieve(query: str, filters: Optional[MetadataFilters] = None, top_k: int = 5) -> List[Dict[str, str]]:
    """
    Retrieve documents matching the query using hybrid search and metadata filters.
    """
    retriever = index.as_retriever(
        similarity_top_k=top_k,
        filters=filters,
        embed_model=Settings.embed_model
    )
    results = retriever.retrieve(query)
    
    out = []
    for node_with_score in results:
        out.append({
            "id": node_with_score.node.node_id,
            "text": node_with_score.node.text
        })
    return out
