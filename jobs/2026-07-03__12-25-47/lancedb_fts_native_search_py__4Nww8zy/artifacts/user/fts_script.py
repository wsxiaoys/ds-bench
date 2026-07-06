import os
import json
import shutil
import numpy as np
import pyarrow as pa
import lancedb

DB_URI = "/home/user/db"
TABLE_NAME = "articles"
OUT_PATH = "/home/user/output/fts_results.json"

if os.path.isdir(DB_URI):
    shutil.rmtree(DB_URI)

schema = pa.schema([
    pa.field("id", pa.int64()),
    pa.field("title", pa.string()),
    pa.field("body", pa.string()),
    pa.field("vector", pa.list_(pa.float32(), 4)),
])

rng = np.random.default_rng(1)

rows = [
    (1, "Vector Databases Explained", "A vector database stores high dimensional embeddings and supports nearest neighbor search at scale. Vector database systems power semantic retrieval, recommendation engines, and similarity search across millions of items. Choosing the right vector database involves tradeoffs in latency, recall, and storage."),
    (2, "The Lance Format for Columnar Data", "The lance format is a modern columnar storage format designed for machine learning workloads. The lance format combines random access, version control, and efficient scans in a single file. With the lance format you can append, update, and slice data without rewriting the whole dataset."),
    (3, "Introduction to BM25", "BM25 is a ranking function used by search engines to estimate the relevance of documents to a query. BM25 scores documents based on term frequency, inverse document frequency, and document length normalization. It remains a strong baseline for information retrieval tasks."),
    (4, "Embeddings 101", "Word and sentence embeddings map text into dense numeric vectors that capture semantic meaning. Modern transformer models produce high quality embeddings suitable for clustering and similarity tasks."),
    (5, "Approximate Nearest Neighbors", "ANN algorithms such as HNSW and IVF trade a small amount of recall for dramatic speedups over brute force nearest neighbor search. They are the workhorses behind large scale retrieval systems."),
    (6, "Information Retrieval Basics", "Information retrieval is the science of searching for information within documents, metadata, and databases. Classic IR systems rely on inverted indexes and term weighting schemes like TF-IDF and BM25."),
    (7, "Tokenization in Search", "Tokenization splits text into tokens such as words, subwords, or n-grams. Good tokenization dramatically improves recall and precision in full text search systems."),
    (8, "Inverted Indexes", "An inverted index maps each term to the list of documents that contain it. Search engines use inverted indexes for fast keyword lookup and ranking."),
    (9, "Hybrid Search Strategies", "Hybrid search combines keyword matching with vector similarity to leverage the strengths of both approaches. Lexical search is precise for rare terms while vector search captures semantic intent."),
    (10, "Columnar Storage Overview", "Columnar storage formats like Parquet and ORC store data by column rather than by row. This layout improves compression and analytical query performance."),
    (11, "Row vs Columnar", "Row based layouts favor write heavy transactional workloads while columnar formats excel at read heavy analytical workloads. Choosing the right layout depends on access patterns."),
    (12, "Search Ranking Signals", "Search engines combine many signals such as term frequency, document freshness, and link popularity to produce a final ranking. BM25 provides a solid lexical baseline."),
    (13, "Cosine Similarity", "Cosine similarity measures the angle between two vectors and is widely used for comparing embeddings. It is robust to vector magnitude differences."),
    (14, "Sparse vs Dense Retrieval", "Sparse retrieval uses inverted indexes over bag of words representations while dense retrieval relies on neural encoders. Both families of methods have complementary strengths."),
    (15, "TF-IDF Fundamentals", "TF-IDF weights terms by how often they appear in a document relative to the entire corpus. It is a precursor to modern ranking functions like BM25."),
    (16, "Stopword Filtering", "Stopwords such as the, is, and at are usually filtered out during indexing because they carry little discriminative signal."),
    (17, "Stemming and Lemmatization", "Stemming reduces words to their root form to improve recall. Lemmatization goes a step further using vocabulary and morphological analysis."),
    (18, "Data Versioning", "Data versioning allows teams to track changes to datasets over time. Versioned datasets enable reproducibility and auditability in machine learning pipelines."),
    (19, "Apache Arrow Basics", "Apache Arrow defines a cross language columnar memory format. It enables zero copy data exchange between analytics engines."),
    (20, "LanceDB Internals", "LanceDB is an open source database for AI applications built on the Lance columnar format. It combines vector search, full text search, and SQL style filtering in a single engine."),
    (21, "Reranking with Cross Encoders", "Cross encoders rerank candidate passages using a deep transformer that jointly encodes the query and document. They are slower but more accurate than bi-encoders."),
]

records = []
for (rid, title, body) in rows:
    records.append({
        "id": rid,
        "title": title,
        "body": body,
        "vector": rng.random(4).astype("float32").tolist(),
    })

db = lancedb.connect(DB_URI)
table = db.create_table(TABLE_NAME, data=records, schema=schema, mode="overwrite")
table.create_fts_index("body", use_tantivy=False, replace=True)

results = {}
for qkey, qtext in [("query_1", "vector database"), ("query_2", "lance format")]:
    hits = table.search(qtext, query_type="fts").limit(3).to_list()
    out = []
    for h in hits:
        out.append({
            "id": int(h["id"]),
            "title": h["title"],
            "_score": float(h["_score"]),
        })
    results[qkey] = out

os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
with open(OUT_PATH, "w") as f:
    json.dump(results, f, indent=2)

print(json.dumps(results, indent=2))
