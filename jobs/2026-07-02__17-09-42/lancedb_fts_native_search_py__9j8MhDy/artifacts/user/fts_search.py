"""Native (Lance-based) full-text search prototype on top of LanceDB.

- Connects to a local LanceDB database at /home/user/db.
- (Re)creates a table `articles` with columns: id (int64), title (string),
  body (string), vector (fixed_size_list<float32>[4]).
- Seeds the table with 22 rows of varied article content.
  * id=1 is the canonical answer for the query "vector database".
  * id=2 is the canonical answer for the query "lance format".
- Builds a native FTS index on `body` using the Lance backend
  (i.e. `use_tantivy=False`) and replaces any prior index idempotently.
- Runs two full-text queries and writes the combined top-3 results per query
  to /home/user/output/fts_results.json.
"""

from __future__ import annotations

import json
import os
from pathlib import Path

import lancedb
import numpy as np
import pyarrow as pa


DB_URI = "/home/user/db"
TABLE_NAME = "articles"
OUTPUT_DIR = "/home/user/output"
OUTPUT_PATH = os.path.join(OUTPUT_DIR, "fts_results.json")


def build_schema() -> pa.Schema:
    """Return the pyarrow schema for the `articles` table."""
    return pa.schema(
        [
            pa.field("id", pa.int64()),
            pa.field("title", pa.string()),
            pa.field("body", pa.string()),
            pa.field("vector", pa.list_(pa.float32(), 4)),
        ]
    )


# 22 short articles. `id=1` is densely populated with the exact phrase
# "vector database"; `id=2` is densely populated with "lance format".
# The remaining rows avoid both phrases so BM25 ranks id=1 and id=2 first
# unambiguously for the respective queries.
ARTICLES = [
    {
        "id": 1,
        "title": "Introduction to Vector Databases",
        "body": (
            "A vector database is a specialized storage system built for "
            "high-dimensional embeddings. A vector database indexes dense "
            "numerical vectors and serves similarity queries in milliseconds. "
            "Modern vector databases integrate tightly with machine learning "
            "pipelines, allowing teams to store embeddings once and query "
            "them by approximate or exact nearest neighbor. A vector database "
            "shines in semantic search, recommendation, and retrieval "
            "augmented generation workloads where traditional keyword search "
            "falls short. Choosing the right vector database involves "
            "considering recall, latency, freshness, and operational cost."
        ),
    },
    {
        "id": 2,
        "title": "Inside the Lance File Format",
        "body": (
            "The Lance format is a modern columnar file format designed for "
            "machine learning data. The Lance format builds on the lessons of "
            "Parquet but adds a custom row group layout optimized for fast "
            "random access and rich schema evolution. The Lance format powers "
            "LanceDB and delivers zero-copy reads from cloud object stores. "
            "Because the Lance format keeps both data and indexes inside the "
            "same file, training jobs and serving jobs can share the same "
            "underlying representation. Teams adopting the Lance format "
            "typically see simpler pipelines and lower storage overhead."
        ),
    },
    {
        "id": 3,
        "title": "BM25 Scoring Explained",
        "body": (
            "BM25 is a probabilistic ranking function used by most keyword "
            "search engines. It extends TF-IDF with term frequency saturation "
            "and document length normalization. BM25 parameters k1 and b "
            "control how quickly scores plateau and how harshly long "
            "documents are penalized. Despite the rise of neural retrievers, "
            "BM25 remains a strong baseline and a key component of many "
            "hybrid retrieval pipelines."
        ),
    },
    {
        "id": 4,
        "title": "HNSW Graphs for Approximate Nearest Neighbors",
        "body": (
            "Hierarchical Navigable Small World graphs are a popular index "
            "structure for approximate nearest neighbor search. HNSW builds "
            "a multi-layer proximity graph that supports logarithmic-time "
            "lookups. The construction cost and memory footprint scale "
            "with the number of stored points and the connectivity factor."
        ),
    },
    {
        "id": 5,
        "title": "Foundations of Information Retrieval",
        "body": (
            "Information retrieval is the science of locating relevant "
            "material within large collections. Classic IR systems rely on "
            "inverted indexes, stemming, stop word removal, and ranking "
            "functions. Modern retrieval pipelines often augment these "
            "foundations with dense embeddings and learned re-rankers."
        ),
    },
    {
        "id": 6,
        "title": "Columnar Storage Layouts",
        "body": (
            "Columnar storage layouts arrange values by field rather than "
            "by row. This organization improves analytical scan performance "
            "because only the columns referenced by a query need to be "
            "read. Compression techniques like run-length encoding and "
            "dictionary encoding pair naturally with the columnar layout."
        ),
    },
    {
        "id": 7,
        "title": "Parquet and ORC Compared",
        "body": (
            "Parquet and ORC are two widely deployed columnar storage "
            "systems. Both support predicate pushdown, statistics, and "
            "schema evolution. Their differences mostly show up in nested "
            "data handling and the breadth of language integrations."
        ),
    },
    {
        "id": 8,
        "title": "Embeddings and Representation Learning",
        "body": (
            "Embeddings map discrete symbols into continuous vector "
            "spaces where semantically similar items sit close together. "
            "Representation learning trains these mappings directly from "
            "data using contrastive or reconstructive objectives. The "
            "resulting representations power retrieval, clustering, and "
            "classification downstream."
        ),
    },
    {
        "id": 9,
        "title": "TF-IDF in Modern Search",
        "body": (
            "Term frequency-inverse document frequency weights a term by "
            "how often it appears in a single document and how rare it is "
            "across the corpus. TF-IDF predates learned rankers but still "
            "appears in many production systems as a feature or a fallback."
        ),
    },
    {
        "id": 10,
        "title": "A Survey of Approximate Nearest Neighbor Algorithms",
        "body": (
            "Approximate nearest neighbor algorithms trade exactness for "
            "speed. Popular families include locality-sensitive hashing, "
            "tree-based partitions, neighborhood graphs, and quantization "
            "based indexes. Each family makes different trade-offs around "
            "recall, latency, and memory."
        ),
    },
    {
        "id": 11,
        "title": "Inverted Index Fundamentals",
        "body": (
            "An inverted index maps each term to a sorted list of postings "
            "that reference the documents containing it. Boolean queries "
            "become set intersections and unions over these postings lists, "
            "while ranked queries apply scoring functions on top."
        ),
    },
    {
        "id": 12,
        "title": "Stemming and Lemmatization",
        "body": (
            "Stemming and lemmatization reduce inflected words to a common "
            "base form so that searches match across morphological "
            "variants. Stemmers are typically rule based and fast, while "
            "lemmatizers use vocabulary and morphological analysis."
        ),
    },
    {
        "id": 13,
        "title": "Stop Word Removal Strategies",
        "body": (
            "Stop word removal filters out frequent but low-information "
            "tokens such as articles, prepositions, and pronouns. Aggressive "
            "filtering shrinks indexes, while conservative filtering "
            "preserves phrase fidelity for short queries."
        ),
    },
    {
        "id": 14,
        "title": "Hybrid Search Architectures",
        "body": (
            "Hybrid search combines keyword and semantic retrievers and "
            "fuses their scores. Reciprocal rank fusion, linear "
            "combination, and learned re-rankers are common fusion "
            "strategies. Hybrid systems consistently outperform either "
            "channel alone on mixed query workloads."
        ),
    },
    {
        "id": 15,
        "title": "Product Quantization for Vector Compression",
        "body": (
            "Product quantization compresses high-dimensional embeddings "
            "by splitting them into subspaces and clustering each subspace "
            "independently. The compressed codes trade a small amount of "
            "recall for a large reduction in memory and disk usage."
        ),
    },
    {
        "id": 16,
        "title": "Disk-Based ANN with Vamana",
        "body": (
            "Vamana is the graph-based index that powers DiskANN. It is "
            "designed to live on solid-state storage while still delivering "
            "millisecond-class queries at billion-point scale. The index "
            "uses a single proximity graph per shard and supports filtered "
            "search through auxiliary label structures."
        ),
    },
    {
        "id": 17,
        "title": "Object Stores and Lakehouses",
        "body": (
            "Cloud object stores provide cheap, highly durable storage that "
            "underpins modern lakehouse architectures. Open table formats "
            "layer transactions and schema management on top of these "
            "object stores, enabling analytics and machine learning on the "
            "same files."
        ),
    },
    {
        "id": 18,
        "title": "Full-Text Search Pipelines",
        "body": (
            "Full-text search pipelines tokenize documents, normalize "
            "tokens, and build postings lists. Query time mirrors that "
            "pipeline: analyze the query, look up postings, score, and "
            "return the top-k hits in milliseconds."
        ),
    },
    {
        "id": 19,
        "title": "Query Understanding Techniques",
        "body": (
            "Query understanding expands, rewrites, or clarifies raw user "
            "input before retrieval. Spell correction, synonym expansion, "
            "and entity recognition all reduce the gap between what users "
            "type and what they actually mean."
        ),
    },
    {
        "id": 20,
        "title": "Evaluating Search Quality",
        "body": (
            "Search quality is measured with offline metrics like nDCG, "
            "MAP, and recall@k. Online metrics such as click-through and "
            "session success gauge real user satisfaction. Both views are "
            "needed to ship ranking changes safely."
        ),
    },
    {
        "id": 21,
        "title": "Re-Ranking with Cross-Encoders",
        "body": (
            "Cross-encoder re-rankers read the query and candidate "
            "document jointly and produce a fine-grained relevance score. "
            "They are expensive, so they typically sit at the end of a "
            "funnel that retrieves hundreds of candidates with a cheaper "
            "first-stage ranker."
        ),
    },
    {
        "id": 22,
        "title": "Schema Evolution in Analytical Systems",
        "body": (
            "Schema evolution allows analytical systems to add, rename, "
            "or drop columns without rewriting historical data. Columnar "
            "stores handle evolution by tracking per-field metadata and "
            "filling missing values with nulls when reading older files."
        ),
    },
]


def seed_rows(rng: np.random.Generator) -> list[dict]:
    """Attach a deterministic 4-dim float vector to every article row."""
    rows = []
    for article in ARTICLES:
        rows.append(
            {
                "id": article["id"],
                "title": article["title"],
                "body": article["body"],
                "vector": rng.random(4).astype(np.float32).tolist(),
            }
        )
    return rows


def main() -> None:
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    db = lancedb.connect(DB_URI)

    # Drop any pre-existing table so the run is idempotent.
    if TABLE_NAME in db.table_names():
        db.drop_table(TABLE_NAME)

    rng = np.random.default_rng(1)
    rows = seed_rows(rng)

    schema = build_schema()
    table = db.create_table(
        TABLE_NAME,
        data=rows,
        schema=schema,
        mode="create",
    )

    # Build the native (Lance-based) FTS index idempotently.
    table.create_fts_index(
        "body",
        use_tantivy=False,
        replace=True,
    )

    # Run both queries and capture the top-3 results per query.
    results: dict[str, list[dict]] = {}
    for key, query in (
        ("query_1", "vector database"),
        ("query_2", "lance format"),
    ):
        hits = (
            table.search(query, query_type="fts")
            .limit(3)
            .to_list()
        )
        # Trim each hit to the required keys while keeping descending score order.
        results[key] = [
            {
                "id": int(hit["id"]),
                "title": str(hit["title"]),
                "_score": float(hit["_score"]),
            }
            for hit in hits
        ]

    Path(OUTPUT_PATH).write_text(json.dumps(results, indent=2))

    print(f"Wrote {OUTPUT_PATH}")
    print(f"Top hit for 'vector database': id={results['query_1'][0]['id']}")
    print(f"Top hit for 'lance format':    id={results['query_2'][0]['id']}")


if __name__ == "__main__":
    main()