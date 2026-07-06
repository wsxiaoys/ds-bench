import os
import re
import pypdf
import httpx
import lancedb
from openai import OpenAI

# Configuration
DB_PATH = "/home/user/myproject/lancedb/"
CORPUS_DIR = "/app/corpus/"
EMBEDDING_MODEL = "text-embedding-3-small"

def get_run_id():
    # Try reading from environment variable first
    run_id = os.environ.get("RUN_ID")
    if run_id:
        return run_id.strip()
    # Fallback to reading from /logs/artifacts/run-id
    run_id_path = "/logs/artifacts/run-id"
    if os.path.exists(run_id_path):
        with open(run_id_path, "r") as f:
            return f.read().strip()
    return "default_run"

def get_table_name():
    run_id = get_run_id()
    return f"pdf_chunks_{run_id}"

def chunk_by_sentences(text, chunk_size=3, overlap=1):
    # Normalize whitespaces and newlines
    text_cleaned = " ".join(text.split())
    # Split by sentence ending punctuation
    sentences = [s.strip() for s in re.split(r'(?<=[.!?])\s+', text_cleaned) if s.strip()]
    if not sentences:
        return []
    
    chunks = []
    i = 0
    while i < len(sentences):
        group = sentences[i:i+chunk_size]
        chunks.append(" ".join(group))
        if i + chunk_size >= len(sentences):
            break
        i += (chunk_size - overlap)
    return chunks

def get_openai_client():
    # Workaround for unexpected keyword argument 'proxies' in SyncHttpxClientWrapper
    return OpenAI(
        base_url=os.environ.get("OPENAI_BASE_URL"),
        api_key=os.environ.get("OPENAI_API_KEY"),
        http_client=httpx.Client()
    )

def ingest_corpus():
    print("Starting ingestion process...")
    
    # 1. Read and parse PDFs
    all_chunks = []
    if not os.path.exists(CORPUS_DIR):
        print(f"Corpus directory {CORPUS_DIR} does not exist.")
        return
        
    pdf_files = sorted([f for f in os.listdir(CORPUS_DIR) if f.endswith(".pdf")])
    print(f"Found PDF files: {pdf_files}")
    
    for pdf_file in pdf_files:
        doc_id = os.path.splitext(pdf_file)[0]
        pdf_path = os.path.join(CORPUS_DIR, pdf_file)
        
        reader = pypdf.PdfReader(pdf_path)
        print(f"Processing {pdf_file} ({len(reader.pages)} pages)...")
        
        for page_idx, page in enumerate(reader.pages):
            page_num = page_idx + 1
            text = page.extract_text() or ""
            chunks = chunk_by_sentences(text)
            
            for chunk_idx, chunk_text in enumerate(chunks):
                chunk_id = f"{doc_id}_p{page_num}_c{chunk_idx}"
                all_chunks.append({
                    "doc_id": doc_id,
                    "page": page_num,
                    "chunk_id": chunk_id,
                    "text": chunk_text
                })
                
    if not all_chunks:
        print("No chunks extracted from PDFs.")
        return
        
    print(f"Extracted {len(all_chunks)} total chunks. Computing embeddings...")
    
    # 2. Compute embeddings using OpenAI API
    client = get_openai_client()
    texts_to_embed = [item["text"] for item in all_chunks]
    
    # Call OpenAI embeddings API
    response = client.embeddings.create(
        input=texts_to_embed,
        model=EMBEDDING_MODEL
    )
    
    # Add embeddings to chunk data
    for idx, item in enumerate(response.data):
        all_chunks[idx]["embedding"] = item.embedding
        
    print("Embeddings computed. Saving to LanceDB...")
    
    # 3. Save to LanceDB
    os.makedirs(DB_PATH, exist_ok=True)
    db = lancedb.connect(DB_PATH)
    table_name = get_table_name()
    
    # Create or overwrite table
    table = db.create_table(table_name, data=all_chunks, mode="overwrite")
    print(f"Successfully ingested {len(all_chunks)} chunks into LanceDB table '{table_name}'.")

def search(query: str, k: int) -> list[dict]:
    """
    Embeds the query with the same OpenAI embedding model used during ingestion,
    and returns the top-k most relevant chunks as a list of dicts.
    """
    client = get_openai_client()
    
    # Embed query
    response = client.embeddings.create(
        input=[query],
        model=EMBEDDING_MODEL
    )
    query_vector = response.data[0].embedding
    
    # Connect to LanceDB and open table
    db = lancedb.connect(DB_PATH)
    table_name = get_table_name()
    
    if table_name not in db.table_names():
        raise ValueError(f"Table '{table_name}' does not exist. Please run ingestion first.")
        
    table = db.open_table(table_name)
    
    # Search table
    results = table.search(query_vector).limit(k).to_list()
    
    # Format and return results
    formatted_results = []
    for r in results:
        formatted_results.append({
            "doc_id": r["doc_id"],
            "page": int(r["page"]),
            "snippet": r["text"]
        })
        
    return formatted_results

if __name__ == "__main__":
    ingest_corpus()
