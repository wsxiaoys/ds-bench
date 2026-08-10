#!/usr/bin/env python3
import os
import sys
import json
import argparse

def discover_files(corpus_dir):
    supported_files = []
    skipped_files = []
    
    for root, dirs, files in os.walk(corpus_dir):
        for f in files:
            full_path = os.path.join(root, f)
            rel_path = os.path.relpath(full_path, corpus_dir)
            posix_rel_path = rel_path.replace(os.path.sep, "/")
            
            ext = os.path.splitext(f)[1].lower()
            if ext in [".md", ".html", ".docx", ".pdf"]:
                supported_files.append((posix_rel_path, full_path))
            else:
                skipped_files.append(posix_rel_path)
                
    supported_files.sort(key=lambda x: x[0])
    skipped_files.sort()
    
    return supported_files, skipped_files

def construct_chunk_text(heading_path, body):
    if heading_path:
        prefix = "\n".join(heading_path) + "\n"
        return prefix + body
    else:
        return body

def run_pack(args):
    if not os.path.isdir(args.corpus):
        sys.stderr.write(f"ERROR: --corpus directory '{args.corpus}' does not exist\n")
        sys.exit(2)
        
    try:
        max_tokens = int(args.max_tokens)
        if max_tokens < 32:
            raise ValueError()
    except (ValueError, TypeError):
        sys.stderr.write("ERROR: --max-tokens must be an integer of at least 32\n")
        sys.exit(2)
        
    merge_peers = not args.no_merge_peers
    
    script_dir = os.path.dirname(os.path.abspath(__file__))
    tokenizer_dir = os.path.join(script_dir, "assets/tokenizer")
    if not os.path.isdir(tokenizer_dir):
        tokenizer_dir = "/home/user/chunkforge/assets/tokenizer"
    tokenizer_dir = os.path.abspath(tokenizer_dir)
    
    try:
        from transformers import AutoTokenizer
        tokenizer = AutoTokenizer.from_pretrained(tokenizer_dir, local_files_only=True)
    except Exception as e:
        sys.stderr.write(f"ERROR: Failed to load tokenizer from {tokenizer_dir}: {e}\n")
        sys.exit(2)
        
    supported_files, skipped_files = discover_files(args.corpus)
    
    try:
        from docling.document_converter import DocumentConverter
        converter = DocumentConverter()
    except Exception as e:
        sys.stderr.write(f"ERROR: Failed to initialize DocumentConverter: {e}\n")
        sys.exit(2)
        
    os.makedirs(args.out, exist_ok=True)
    
    all_chunks = []
    documents_summary = []
    total_index = 0
    
    for posix_rel_path, full_path in supported_files:
        try:
            result = converter.convert(full_path)
            doc = result.document
        except Exception as e:
            sys.stderr.write(f"ERROR: Failed to convert {posix_rel_path}: {e}\n")
            sys.exit(2)
            
        current_headings = {}
        initial_chunks = []
        
        for item, _ in doc.iterate_items():
            name = type(item).__name__
            if name == 'TitleItem':
                current_headings = {0: item.text}
            elif name == 'SectionHeaderItem':
                level = getattr(item, 'level', None)
                if level is None or level < 1:
                    level = 1
                if 0 not in current_headings:
                    current_headings = {0: item.text}
                else:
                    current_headings = {k: v for k, v in current_headings.items() if k < level}
                    current_headings[level] = item.text
            elif name in ['TextItem', 'TableItem']:
                if name == 'TableItem':
                    body_text = item.export_to_markdown(doc)
                else:
                    body_text = item.text
                    
                if not body_text or not body_text.strip():
                    continue
                    
                heading_path = [v for k, v in sorted(current_headings.items()) if v]
                
                page_numbers = []
                if hasattr(item, "prov") and item.prov:
                    for p in item.prov:
                        if hasattr(p, "page_no") and p.page_no is not None:
                            page_numbers.append(p.page_no)
                page_numbers = sorted(list(set(page_numbers)))
                
                prefix = "\n".join(heading_path) + "\n" if heading_path else ""
                words = body_text.split()
                
                element_chunks = []
                current_words = []
                
                for word in words:
                    test_words = current_words + [word]
                    test_body = " ".join(test_words)
                    test_text = prefix + test_body
                    test_tokens = len(tokenizer.encode(test_text, add_special_tokens=False))
                    
                    if test_tokens <= max_tokens:
                        current_words.append(word)
                    else:
                        if current_words:
                            element_chunks.append({
                                "body": " ".join(current_words),
                                "is_partial": True
                            })
                            current_words = [word]
                        else:
                            current_words = [word]
                
                if current_words:
                    element_chunks.append({
                        "body": " ".join(current_words),
                        "is_partial": True
                    })
                    
                if len(element_chunks) == 1:
                    element_chunks[0]["is_partial"] = False
                    
                for ec in element_chunks:
                    body = ec["body"]
                    text = prefix + body
                    token_count = len(tokenizer.encode(text, add_special_tokens=False))
                    initial_chunks.append({
                        "heading_path": heading_path,
                        "page_numbers": page_numbers,
                        "is_partial_element": ec["is_partial"],
                        "body": body,
                        "text": text,
                        "token_count": token_count
                    })
                    
        final_chunks = []
        for chunk in initial_chunks:
            if not final_chunks:
                final_chunks.append(chunk)
                continue
            
            prev = final_chunks[-1]
            if merge_peers and prev["heading_path"] == chunk["heading_path"]:
                merged_body = prev["body"] + "\n" + chunk["body"]
                merged_text = construct_chunk_text(chunk["heading_path"], merged_body)
                merged_tokens = len(tokenizer.encode(merged_text, add_special_tokens=False))
                if merged_tokens <= max_tokens:
                    prev["body"] = merged_body
                    prev["page_numbers"] = sorted(list(set(prev["page_numbers"] + chunk["page_numbers"])))
                    prev["is_partial_element"] = False
                    prev["token_count"] = merged_tokens
                    prev["text"] = merged_text
                else:
                    final_chunks.append(chunk)
            else:
                final_chunks.append(chunk)
                
        doc_chunk_count = len(final_chunks)
        doc_token_total = 0
        doc_max_chunk_tokens = 0
        doc_partial_chunk_count = 0
        doc_max_heading_depth = 0
        doc_page_numbers = set()
        
        for ordinal, chunk in enumerate(final_chunks):
            chunk_id = f"{posix_rel_path}#{ordinal:04d}"
            
            doc_token_total += chunk["token_count"]
            doc_max_chunk_tokens = max(doc_max_chunk_tokens, chunk["token_count"])
            if chunk["is_partial_element"]:
                doc_partial_chunk_count += 1
            doc_max_heading_depth = max(doc_max_heading_depth, len(chunk["heading_path"]))
            doc_page_numbers.update(chunk["page_numbers"])
            
            record = {
                "chunk_id": chunk_id,
                "index": total_index,
                "source": posix_rel_path,
                "ordinal": ordinal,
                "heading_path": chunk["heading_path"],
                "page_numbers": chunk["page_numbers"],
                "token_count": chunk["token_count"],
                "is_partial_element": chunk["is_partial_element"],
                "text": chunk["text"]
            }
            all_chunks.append(record)
            total_index += 1
            
        doc_mean_chunk_tokens = 0.0
        if doc_chunk_count > 0:
            doc_mean_chunk_tokens = round(doc_token_total / doc_chunk_count, 2)
            
        documents_summary.append({
            "source": posix_rel_path,
            "chunk_count": doc_chunk_count,
            "token_total": doc_token_total,
            "max_chunk_tokens": doc_max_chunk_tokens,
            "mean_chunk_tokens": doc_mean_chunk_tokens,
            "partial_chunk_count": doc_partial_chunk_count,
            "max_heading_depth": doc_max_heading_depth,
            "page_numbers": sorted(list(doc_page_numbers))
        })
        
    total_document_count = len(supported_files)
    total_chunk_count = len(all_chunks)
    total_token_total = sum(c["token_count"] for c in all_chunks)
    total_partial_chunk_count = sum(1 for c in all_chunks if c["is_partial_element"])
    total_budget_violations = sum(1 for c in all_chunks if c["token_count"] > max_tokens)
    
    summary = {
        "tokenizer_path": tokenizer_dir,
        "max_tokens": max_tokens,
        "merge_peers": merge_peers,
        "documents": documents_summary,
        "totals": {
            "document_count": total_document_count,
            "chunk_count": total_chunk_count,
            "token_total": total_token_total,
            "partial_chunk_count": total_partial_chunk_count,
            "budget_violations": total_budget_violations
        },
        "skipped_files": skipped_files
    }
    
    chunks_file_path = os.path.join(args.out, "chunks.jsonl")
    with open(chunks_file_path, "w", encoding="utf-8", newline="\n") as f:
        for chunk in all_chunks:
            f.write(json.dumps(chunk, ensure_ascii=False) + "\n")
            
    summary_file_path = os.path.join(args.out, "summary.json")
    with open(summary_file_path, "w", encoding="utf-8", newline="\n") as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)
        f.write("\n")
        
    print(f"PACKED documents={total_document_count} chunks={total_chunk_count} max_tokens={max_tokens} merge_peers={str(merge_peers).lower()}")
    sys.exit(0)

def run_verify(args):
    chunks_path = os.path.join(args.out, "chunks.jsonl")
    summary_path = os.path.join(args.out, "summary.json")
    
    if not os.path.isfile(chunks_path) or not os.path.isfile(summary_path):
        sys.stderr.write("ERROR: Missing chunks.jsonl or summary.json\n")
        sys.exit(2)
        
    try:
        with open(summary_path, "r", encoding="utf-8") as f:
            summary = json.load(f)
    except Exception as e:
        sys.stderr.write(f"VIOLATION: summary.json is not valid JSON: {e}\n")
        sys.exit(3)
        
    max_tokens = summary.get("max_tokens")
    tokenizer_path = summary.get("tokenizer_path")
    
    if max_tokens is None or tokenizer_path is None:
        sys.stderr.write("VIOLATION: summary.json is missing max_tokens or tokenizer_path\n")
        sys.exit(3)
        
    try:
        from transformers import AutoTokenizer
        tokenizer = AutoTokenizer.from_pretrained(tokenizer_path, local_files_only=True)
    except Exception as e:
        sys.stderr.write(f"VIOLATION: Failed to load tokenizer from {tokenizer_path}: {e}\n")
        sys.exit(3)
        
    chunks = []
    try:
        with open(chunks_path, "r", encoding="utf-8") as f:
            for line_no, line in enumerate(f, 1):
                line_stripped = line.strip()
                if not line_stripped:
                    continue
                try:
                    chunk = json.loads(line_stripped)
                    chunks.append((line_no, chunk))
                except Exception as e:
                    sys.stderr.write(f"VIOLATION: Line {line_no} of chunks.jsonl is not valid JSON: {e}\n")
                    sys.exit(3)
    except Exception as e:
        sys.stderr.write(f"VIOLATION: Failed to read chunks.jsonl: {e}\n")
        sys.exit(3)
        
    required_keys = {"chunk_id", "index", "source", "ordinal", "heading_path", "page_numbers", "token_count", "is_partial_element", "text"}
    expected_index = 0
    source_ordinals = {}
    
    for line_no, chunk in chunks:
        if set(chunk.keys()) != required_keys or len(chunk.keys()) != 9:
            sys.stderr.write(f"VIOLATION: Line {line_no} does not have exactly the nine required keys. Keys: {list(chunk.keys())}\n")
            sys.exit(3)
            
        chunk_id = chunk["chunk_id"]
        index = chunk["index"]
        source = chunk["source"]
        ordinal = chunk["ordinal"]
        heading_path = chunk["heading_path"]
        page_numbers = chunk["page_numbers"]
        token_count = chunk["token_count"]
        is_partial_element = chunk["is_partial_element"]
        text = chunk["text"]
        
        if index != expected_index:
            sys.stderr.write(f"VIOLATION: Line {line_no} has index {index}, expected {expected_index}\n")
            sys.exit(3)
        expected_index += 1
        
        expected_ordinal = source_ordinals.get(source, 0)
        if ordinal != expected_ordinal:
            sys.stderr.write(f"VIOLATION: Line {line_no} has ordinal {ordinal} for source '{source}', expected {expected_ordinal}\n")
            sys.exit(3)
        source_ordinals[source] = expected_ordinal + 1
        
        expected_chunk_id = f"{source}#{ordinal:04d}"
        if chunk_id != expected_chunk_id:
            sys.stderr.write(f"VIOLATION: Line {line_no} has chunk_id '{chunk_id}', expected '{expected_chunk_id}'\n")
            sys.exit(3)
            
        try:
            actual_tokens = len(tokenizer.encode(text, add_special_tokens=False))
        except Exception as e:
            sys.stderr.write(f"VIOLATION: Line {line_no} failed to tokenize: {e}\n")
            sys.exit(3)
            
        if token_count != actual_tokens:
            sys.stderr.write(f"VIOLATION: Line {line_no} has token_count {token_count}, but freshly computed tokens is {actual_tokens}\n")
            sys.exit(3)
            
        if not (0 < token_count <= max_tokens):
            sys.stderr.write(f"VIOLATION: Line {line_no} has token_count {token_count}, which violates the budget (0 < token_count <= {max_tokens})\n")
            sys.exit(3)
            
    print("VERIFIED: All checks passed successfully.")
    sys.exit(0)

def main():
    parser = argparse.ArgumentParser(description="ChunkPack CLI")
    subparsers = parser.add_subparsers(dest="command", required=True)
    
    pack_parser = subparsers.add_parser("pack")
    pack_parser.add_argument("--corpus", required=True, help="Corpus directory")
    pack_parser.add_argument("--out", required=True, help="Output directory")
    pack_parser.add_argument("--max-tokens", required=True, help="Max tokens budget")
    pack_parser.add_argument("--no-merge-peers", action="store_true", help="Disable peer merging")
    
    verify_parser = subparsers.add_parser("verify")
    verify_parser.add_argument("--out", required=True, help="Output directory")
    
    args = parser.parse_args()
    
    if args.command == "pack":
        run_pack(args)
    elif args.command == "verify":
        run_verify(args)

if __name__ == "__main__":
    main()
