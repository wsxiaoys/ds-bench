import os
import lancedb
from openai import OpenAI

def get_run_id():
    run_id_path = "/logs/artifacts/run-id"
    if os.path.exists(run_id_path):
        with open(run_id_path, "r") as f:
            return f.read().strip()
    return os.environ.get("RUN_ID", "default")

def parse_markdown(file_path: str):
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()
        
    doc_title = None
    sections = []
    
    lines = content.splitlines()
    current_section_title = None
    current_section_lines = []
    
    for line in lines:
        stripped = line.strip()
        if stripped.startswith('# '):
            doc_title = stripped[2:].strip()
        elif stripped.startswith('## '):
            if current_section_title is not None:
                sections.append({
                    'section_title': current_section_title,
                    'content': '\n'.join(current_section_lines).strip()
                })
            current_section_title = stripped[3:].strip()
            current_section_lines = []
        else:
            if current_section_title is not None:
                current_section_lines.append(line)
                
    if current_section_title is not None:
        sections.append({
            'section_title': current_section_title,
            'content': '\n'.join(current_section_lines).strip()
        })
        
    return doc_title, sections

def get_openai_client():
    client_kwargs = {}
    if os.environ.get("OPENAI_API_KEY"):
        client_kwargs["api_key"] = os.environ.get("OPENAI_API_KEY")
    if os.environ.get("OPENAI_BASE_URL"):
        client_kwargs["base_url"] = os.environ.get("OPENAI_BASE_URL")
    return OpenAI(**client_kwargs)

def index_docs():
    client = get_openai_client()
    docs_dir = "/app/docs"
    
    md_files = []
    for root, dirs, files in os.walk(docs_dir):
        for file in files:
            if file.endswith(".md"):
                md_files.append(os.path.join(root, file))
                
    data = []
    for file_path in md_files:
        repo_path = os.path.relpath(file_path, docs_dir)
        doc_title, sections = parse_markdown(file_path)
        if not doc_title:
            doc_title = os.path.splitext(os.path.basename(file_path))[0]
            
        for sec in sections:
            sec_title = sec['section_title']
            content = sec['content']
            
            # Compute embedding
            response = client.embeddings.create(
                input=content,
                model="text-embedding-3-small"
            )
            embedding = response.data[0].embedding
            
            data.append({
                "repo_path": repo_path,
                "doc_title": doc_title,
                "section_title": sec_title,
                "content": content,
                "vector": embedding,
                "embedding": embedding
            })
            
    db_dir = "/home/user/myproject/lancedb/"
    os.makedirs(db_dir, exist_ok=True)
    db = lancedb.connect(db_dir)
    
    run_id = get_run_id()
    table_name = f"docs_sections_{run_id}"
    
    table = db.create_table(table_name, data=data, mode="overwrite")
    print(f"Successfully indexed {len(data)} sections into table '{table_name}'.")

def search(query: str, k: int) -> list[dict]:
    client = get_openai_client()
    
    db_dir = "/home/user/myproject/lancedb/"
    db = lancedb.connect(db_dir)
    
    run_id = get_run_id()
    table_name = f"docs_sections_{run_id}"
    table = db.open_table(table_name)
    
    # Embed query
    response = client.embeddings.create(
        input=query,
        model="text-embedding-3-small"
    )
    query_vector = response.data[0].embedding
    
    # Search
    results = table.search(query_vector, vector_column_name="vector").limit(k).to_list()
    
    formatted_results = []
    for item in results:
        score = float(item.get("_distance", item.get("_score", item.get("score", 0.0))))
        formatted_results.append({
            "repo_path": str(item["repo_path"]),
            "doc_title": str(item["doc_title"]),
            "section_title": str(item["section_title"]),
            "score": score
        })
        
    return formatted_results

if __name__ == "__main__":
    index_docs()
