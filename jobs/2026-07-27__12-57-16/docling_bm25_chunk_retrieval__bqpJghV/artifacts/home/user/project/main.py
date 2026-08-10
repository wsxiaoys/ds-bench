import os
import re
import sys
import json
import math
import argparse
from docling.document_converter import DocumentConverter

def tokenize(text):
    if not text:
        return []
    return re.findall(r'[a-zA-Z0-9]+', text.lower())

def build_index():
    pdf_path = "assets/report.pdf"
    output_dir = "output"
    os.makedirs(output_dir, exist_ok=True)
    
    # Convert PDF
    converter = DocumentConverter()
    result = converter.convert(pdf_path)
    doc = result.document
    
    chunks = []
    current_headings = []
    
    for element, parent in doc.iterate_items():
        if type(element).__name__ == "SectionHeaderItem":
            level = getattr(element, "level", 1)
            if level == 1:
                if element.text == "Aurora Field Operations Manual":
                    current_headings = [element.text]
                else:
                    if current_headings and current_headings[0] == "Aurora Field Operations Manual":
                        current_headings = ["Aurora Field Operations Manual", element.text]
                    else:
                        current_headings = [element.text]
            else:
                current_headings = current_headings[:level-1] + [element.text]
        elif type(element).__name__ in ["TextItem", "TableItem"]:
            text = ""
            if type(element).__name__ == "TextItem":
                text = element.text or ""
            elif type(element).__name__ == "TableItem":
                text = element.export_to_markdown(doc=doc) or ""
            
            if not text.strip():
                continue
                
            page_nos = sorted(list(set(p.page_no for p in getattr(element, "prov", []))))
            if not page_nos:
                page_nos = [1]
                
            # Calculate original text term count
            term_count = len(tokenize(text))
            if term_count == 0:
                term_count = 1
                
            chunks.append({
                "chunk_id": len(chunks),
                "heading_path": list(current_headings),
                "page_nos": page_nos,
                "text": text,
                "term_count": term_count
            })
            
    # Write chunks.json
    chunks_json_path = os.path.join(output_dir, "chunks.json")
    with open(chunks_json_path, "w", encoding="utf-8") as f:
        json.dump(chunks, f, indent=2, ensure_ascii=False)
        
    # Build BM25 index components
    # Contextualized texts: prepend heading path
    contextualized_texts = []
    for c in chunks:
        headings_str = " ".join(c["heading_path"])
        contextualized_text = headings_str + " " + c["text"]
        contextualized_texts.append(contextualized_text)
        
    corpus_tokens = [tokenize(t) for t in contextualized_texts]
    N = len(chunks)
    avgdl = sum(len(tokens) for tokens in corpus_tokens) / N if N > 0 else 1.0
    
    df = {}
    for tokens in corpus_tokens:
        unique_tokens = set(tokens)
        for token in unique_tokens:
            df[token] = df.get(token, 0) + 1
            
    idf = {}
    for token, freq in df.items():
        # Standard positive BM25 IDF
        idf[token] = math.log(1.0 + (N - freq + 0.5) / (freq + 0.5))
        
    doc_lens = {str(i): len(tokens) for i, tokens in enumerate(corpus_tokens)}
    
    doc_tfs = {}
    for i, tokens in enumerate(corpus_tokens):
        tf = {}
        for token in tokens:
            tf[token] = tf.get(token, 0) + 1
        doc_tfs[str(i)] = tf
        
    index_data = {
        "N": N,
        "avgdl": avgdl,
        "idf": idf,
        "doc_lens": doc_lens,
        "doc_tfs": doc_tfs
    }
    
    index_path = os.path.join(output_dir, "bm25_index.idx")
    with open(index_path, "w", encoding="utf-8") as f:
        json.dump(index_data, f, indent=2, ensure_ascii=False)
        
    print(f"Successfully built index and chunks. Total chunks: {N}")

def load_index():
    index_path = "output/bm25_index.idx"
    if not os.path.exists(index_path):
        print(f"Error: Index file {index_path} does not exist. Run --build first.", file=sys.stderr)
        sys.exit(1)
    with open(index_path, "r", encoding="utf-8") as f:
        return json.load(f)

def run_query(query_text, index_data, k1=1.5, b=0.75):
    query_tokens = tokenize(query_text)
    N = index_data["N"]
    avgdl = index_data["avgdl"]
    idf = index_data["idf"]
    doc_lens = index_data["doc_lens"]
    doc_tfs = index_data["doc_tfs"]
    
    scores = []
    for doc_id_str, tf in doc_tfs.items():
        doc_id = int(doc_id_str)
        doc_len = doc_lens[doc_id_str]
        score = 0.0
        for token in query_tokens:
            if token in tf:
                token_tf = tf[token]
                token_idf = idf.get(token, 0.0)
                numerator = token_tf * (k1 + 1)
                denominator = token_tf + k1 * (1.0 - b + b * (doc_len / avgdl))
                score += token_idf * (numerator / denominator)
        scores.append({"chunk_id": doc_id, "score": score})
        
    scores.sort(key=lambda x: x["score"], reverse=True)
    return scores

def run_seeded_queries():
    index_data = load_index()
    queries_path = "assets/queries.json"
    if not os.path.exists(queries_path):
        print(f"Error: Queries file {queries_path} does not exist.", file=sys.stderr)
        sys.exit(1)
        
    with open(queries_path, "r", encoding="utf-8") as f:
        queries = json.load(f)
        
    results = {}
    for q in queries:
        query_id = q["query_id"]
        query_text = q["query"]
        scores = run_query(query_text, index_data)
        results[query_id] = scores[:5]
        
    output_path = "output/query_results.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
        
    print(f"Successfully ran seeded queries and wrote results to {output_path}")

def main():
    parser = argparse.ArgumentParser(description="Offline BM25 Retrieval Index over a Docling-Parsed Document")
    parser.add_argument("--build", action="store_true", help="Build the search index and chunks")
    parser.add_argument("--query", type=str, help="Search query text")
    parser.add_argument("--top-k", type=int, default=5, help="Number of results to return (default: 5)")
    parser.add_argument("--run-queries", action="store_true", help="Evaluate seeded queries")
    
    args = parser.parse_args()
    
    if args.build:
        build_index()
    elif args.query is not None:
        index_data = load_index()
        results = run_query(args.query, index_data)
        top_k_results = results[:args.top_k]
        print(json.dumps(top_k_results))
    elif args.run_queries:
        run_seeded_queries()
    else:
        parser.print_help()

if __name__ == "__main__":
    main()
