import os
import json
import cohere
import lancedb
import pyarrow as pa

# Determine directories and paths
BASE_DIR = "/home/user/myproject"
if not os.path.exists(BASE_DIR):
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))

LANCEDB_DIR = os.path.join(BASE_DIR, "lancedb_data")
CORPUS_PATH = os.path.join(BASE_DIR, "corpus.json")

def get_run_id() -> str:
    """Reads the run-id from /logs/artifacts/run-id or environment."""
    run_id_path = "/logs/artifacts/run-id"
    if os.path.exists(run_id_path):
        with open(run_id_path, "r", encoding="utf-8") as f:
            return f.read().strip()
    return os.environ.get("RUN_ID", "default")

RUN_ID = get_run_id()
TABLE_NAME = f"multilingual_{RUN_ID}"

def build_index():
    """Reads corpus.json, embeds documents via Cohere, and stores them in LanceDB."""
    # 1. Initialize Cohere client
    api_key = os.environ.get("COHERE_API_KEY")
    if not api_key:
        raise ValueError("COHERE_API_KEY environment variable is not set")
    co = cohere.Client(api_key=api_key)

    # 2. Read corpus.json
    if not os.path.exists(CORPUS_PATH):
        raise FileNotFoundError(f"Corpus file not found at {CORPUS_PATH}")
    
    with open(CORPUS_PATH, "r", encoding="utf-8") as f:
        corpus = json.load(f)

    # 3. Embed all texts as search_document
    texts = [row["text"] for row in corpus]
    response = co.embed(
        texts=texts,
        model="embed-multilingual-v3.0",
        input_type="search_document"
    )
    embeddings = response.embeddings

    # 4. Connect to LanceDB and define schema
    os.makedirs(LANCEDB_DIR, exist_ok=True)
    db = lancedb.connect(LANCEDB_DIR)

    schema = pa.schema([
        pa.field("concept_id", pa.int64()),
        pa.field("language", pa.string()),
        pa.field("text", pa.string()),
        pa.field("vector", pa.list_(pa.float32(), 1024))
    ])

    # 5. Create or overwrite the table
    tbl = db.create_table(TABLE_NAME, schema=schema, mode="overwrite")

    # 6. Format and add data
    data = []
    for row, emb in zip(corpus, embeddings):
        data.append({
            "concept_id": int(row["concept_id"]),
            "language": str(row["language"]),
            "text": str(row["text"]),
            "vector": [float(x) for x in emb]
        })
    tbl.add(data)

def cross_lingual_search(query: str, k: int = 3) -> list[dict]:
    """Embeds the query and searches LanceDB for top-k nearest neighbors."""
    # 1. Ensure index is built lazily if table does not exist
    db = lancedb.connect(LANCEDB_DIR)
    if TABLE_NAME not in db.table_names():
        build_index()
        # Re-connect/get table
        db = lancedb.connect(LANCEDB_DIR)

    tbl = db.open_table(TABLE_NAME)

    # 2. Initialize Cohere client and embed query
    api_key = os.environ.get("COHERE_API_KEY")
    if not api_key:
        raise ValueError("COHERE_API_KEY environment variable is not set")
    co = cohere.Client(api_key=api_key)

    response = co.embed(
        texts=[query],
        model="embed-multilingual-v3.0",
        input_type="search_query"
    )
    query_vector = response.embeddings[0]

    # 3. Perform search using cosine metric
    results = tbl.search(query_vector).metric("cosine").limit(k).to_list()

    # 4. Format and return results
    formatted_results = []
    for item in results:
        formatted_results.append({
            "concept_id": int(item["concept_id"]),
            "language": str(item["language"]),
            "text": str(item["text"])
        })
    return formatted_results
