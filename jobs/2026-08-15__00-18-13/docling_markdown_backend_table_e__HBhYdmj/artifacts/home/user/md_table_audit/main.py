import os
import re
import json
import argparse
import base64
import warnings
from pathlib import Path
from io import BytesIO
from PIL import Image

from docling.document_converter import DocumentConverter
from docling.datamodel.base_models import InputFormat
from docling.datamodel.backend_options import MarkdownBackendOptions

def split_unescaped_pipes(line):
    parts = []
    current = []
    i = 0
    n = len(line)
    while i < n:
        if line[i] == '\\' and i + 1 < n and line[i+1] == '|':
            current.append('\\|')
            i += 2
        elif line[i] == '|':
            parts.append("".join(current))
            current = []
            i += 1
        else:
            current.append(line[i])
            i += 1
    parts.append("".join(current))
    return parts

def clean_cell_text(cell_raw):
    text = cell_raw
    text = text.replace('\\|', '|')
    # Replace [text](url) link with text
    text = re.sub(r'\[([^\]]*)\]\([^\)]*\)', r'\1', text)
    # Delete every * and backtick character
    text = text.replace('*', '').replace('`', '')
    # Collapse whitespace runs to a single space, and strip
    text = " ".join(text.split())
    return text

def parse_alignments(d_cells, num_cols):
    aligns = []
    for cell in d_cells[:num_cols]:
        c = cell.strip()
        starts = c.startswith(':')
        ends = c.endswith(':')
        if starts and ends:
            aligns.append("center")
        elif starts:
            aligns.append("left")
        elif ends:
            aligns.append("right")
        else:
            aligns.append("none")
    while len(aligns) < num_cols:
        aligns.append("none")
    return aligns

def parse_table_block(header_line, delimiter_line, body_lines):
    h_trimmed = header_line.strip()
    h_cells = split_unescaped_pipes(h_trimmed)
    if h_trimmed.startswith('|'):
        h_cells = h_cells[1:]
    if h_trimmed.endswith('|'):
        h_cells = h_cells[:-1]
    
    num_cols = len(h_cells)
    
    d_trimmed = delimiter_line.strip()
    d_cells = split_unescaped_pipes(d_trimmed)
    if d_trimmed.startswith('|'):
        d_cells = d_cells[1:]
    if d_trimmed.endswith('|'):
        d_cells = d_cells[:-1]
    
    alignments = parse_alignments(d_cells, num_cols)
    
    grid = []
    header_row = [clean_cell_text(c) for c in h_cells]
    grid.append(header_row)
    
    for line in body_lines:
        l_trimmed = line.strip()
        l_cells = split_unescaped_pipes(l_trimmed)
        if l_trimmed.startswith('|'):
            l_cells = l_cells[1:]
        if l_trimmed.endswith('|'):
            l_cells = l_cells[:-1]
        
        row_cells = []
        for i in range(num_cols):
            if i < len(l_cells):
                row_cells.append(clean_cell_text(l_cells[i]))
            else:
                row_cells.append("")
        grid.append(row_cells)
        
    num_rows = len(grid)
    cell_count = num_rows * num_cols
    
    return {
        "num_rows": num_rows,
        "num_cols": num_cols,
        "cell_count": cell_count,
        "alignments": alignments,
        "grid": grid
    }

def encode_cell(text):
    return text.encode('utf-8').hex()

def decode_cell(hex_str):
    try:
        return bytes.fromhex(hex_str).decode('utf-8')
    except Exception:
        return hex_str

def get_data_uri_bytes(src):
    if src.startswith("data:"):
        comma_idx = src.find(",")
        if comma_idx != -1:
            base64_str = src[comma_idx+1:]
            base64_str = "".join(base64_str.split())
            try:
                padding = len(base64_str) % 4
                if padding:
                    base64_str += "=" * (4 - padding)
                return base64.b64decode(base64_str)
            except Exception:
                return None
    return None

def find_images_in_line(line):
    pattern = r'!\[([^\]]*)\]\(([^)]+)\)'
    matches = []
    for match in re.finditer(pattern, line):
        alt = match.group(1)
        src_part = match.group(2).strip()
        src = src_part.split()[0] if src_part else ""
        matches.append((alt, src))
    return matches

def main():
    parser = argparse.ArgumentParser(description="Offline GFM Table Edge-Case Audit with Docling")
    parser.add_argument("--corpus", required=True, help="Path to the corpus directory")
    parser.add_argument("--out", required=True, help="Path to write the JSON report")
    parser.add_argument("--max-image-bytes", required=True, type=int, help="Byte cap on embedded image data")
    
    args = parser.parse_args()
    
    corpus_dir = Path(args.corpus)
    report_path = Path(args.out)
    max_image_bytes = args.max_image_bytes
    
    if not corpus_dir.is_dir():
        print(f"Error: Corpus directory {corpus_dir} does not exist.")
        exit(1)
        
    # Find and sort files directly in corpus_dir (no recursion)
    files = [f for f in corpus_dir.iterdir() if f.is_file() and f.suffix == ".md"]
    files.sort(key=lambda x: x.name)
    
    documents = []
    failed = []
    
    # Instantiate document converter
    converter = DocumentConverter()
    # Configure converter with max_image_bytes
    max_base64_bytes = max(1, max_image_bytes)
    converter.format_to_options[InputFormat.MD].backend_options = MarkdownBackendOptions(
        fetch_images=True,
        max_image_data_base64_bytes=max_base64_bytes
    )
    
    for filepath in files:
        name = filepath.stem
        
        # 1. Check for UTF-8 decode error
        try:
            with open(filepath, "rb") as f:
                raw_bytes = f.read()
            content = raw_bytes.decode("utf-8")
        except UnicodeDecodeError:
            failed.append({
                "name": name,
                "reason": "decode_error"
            })
            continue
        except Exception as e:
            failed.append({
                "name": name,
                "reason": f"read_error: {str(e)}"
            })
            continue
            
        try:
            lines = content.splitlines()
            
            # Identify fenced code blocks
            fenced_blocks = []
            is_in_fence = False
            fence_start_idx = -1
            fence_lang = ""
            fence_lines = []
            
            for idx, line in enumerate(lines):
                stripped = line.strip()
                if stripped.startswith('```'):
                    if not is_in_fence:
                        is_in_fence = True
                        fence_start_idx = idx
                        fence_lang = stripped[3:].strip()
                        fence_lines = []
                    else:
                        is_in_fence = False
                        fenced_blocks.append({
                            "start_idx": fence_start_idx,
                            "end_idx": idx,
                            "lang": fence_lang,
                            "code": "\n".join(fence_lines)
                        })
                else:
                    if is_in_fence:
                        fence_lines.append(line)
            
            if is_in_fence:
                fenced_blocks.append({
                    "start_idx": fence_start_idx,
                    "end_idx": len(lines) - 1,
                    "lang": fence_lang,
                    "code": "\n".join(fence_lines)
                })
                
            def is_line_in_fence(line_idx):
                for block in fenced_blocks:
                    if block["start_idx"] <= line_idx <= block["end_idx"]:
                        return True
                return False
                
            # Identify tables
            tables_parsed = []
            i = 0
            n = len(lines)
            while i < n:
                if is_line_in_fence(i):
                    i += 1
                    continue
                
                line = lines[i]
                stripped = line.strip()
                
                if stripped and not stripped.startswith('#') and not stripped.startswith('```') and '|' in line:
                    if i + 1 < n and not is_line_in_fence(i + 1):
                        next_line = lines[i + 1]
                        next_stripped = next_line.strip()
                        
                        h_cells = split_unescaped_pipes(stripped)
                        if stripped.startswith('|'):
                            h_cells = h_cells[1:]
                        if stripped.endswith('|'):
                            h_cells = h_cells[:-1]
                        
                        d_cells = split_unescaped_pipes(next_stripped)
                        if next_stripped.startswith('|'):
                            d_cells = d_cells[1:]
                        if next_stripped.endswith('|'):
                            d_cells = d_cells[:-1]
                        
                        if len(h_cells) == len(d_cells) and len(h_cells) > 0:
                            all_match = True
                            for cell in d_cells:
                                c_trim = cell.strip()
                                if not re.match(r'^:?-+:?$', c_trim):
                                    all_match = False
                                    break
                            
                            if all_match:
                                body_lines = []
                                j = i + 2
                                while j < n:
                                    if is_line_in_fence(j):
                                        break
                                    b_line = lines[j]
                                    b_stripped = b_line.strip()
                                    if not b_stripped or b_stripped.startswith('#') or b_stripped.startswith('```'):
                                        break
                                    body_lines.append(b_line)
                                    j += 1
                                
                                tables_parsed.append({
                                    "start_idx": i,
                                    "end_idx": j - 1,
                                    "header": line,
                                    "delimiter": next_line,
                                    "body": body_lines
                                })
                                i = j
                                continue
                i += 1
                
            def is_line_in_table(line_idx):
                for t in tables_parsed:
                    if t["start_idx"] <= line_idx <= t["end_idx"]:
                        return True
                return False
                
            # Construct transport-safe Markdown for docling
            docling_lines = []
            for idx, line in enumerate(lines):
                if is_line_in_fence(idx):
                    docling_lines.append(line)
                elif is_line_in_table(idx):
                    table_found = None
                    for t in tables_parsed:
                        if t["start_idx"] == idx:
                            table_found = t
                            break
                    if table_found:
                        parsed = parse_table_block(table_found["header"], table_found["delimiter"], table_found["body"])
                        enc_header = "| " + " | ".join(encode_cell(c) for c in parsed["grid"][0]) + " |"
                        enc_delim = "| " + " | ".join("---" for _ in range(parsed["num_cols"])) + " |"
                        docling_lines.append(enc_header)
                        docling_lines.append(enc_delim)
                        for row in parsed["grid"][1:]:
                            enc_row = "| " + " | ".join(encode_cell(c) for c in row) + " |"
                            docling_lines.append(enc_row)
                else:
                    if '|' in line:
                        docling_lines.append(line.replace('|', '&#124;'))
                    else:
                        docling_lines.append(line)
                        
            docling_content = "\n".join(docling_lines)
            
            # Convert document with docling and capture warnings
            with warnings.catch_warnings(record=True) as caught_warnings:
                warnings.simplefilter("always")
                result = converter.convert_string(docling_content, format=InputFormat.MD)
                doc = result.document
                
            # Count image size warnings
            image_size_warnings = 0
            for w in caught_warnings:
                if "exceeds size limit" in str(w.message):
                    image_size_warnings += 1
                    
            # Extract tables from docling and map to our parsed tables
            tables_out = []
            for t_idx, t_parsed in enumerate(tables_parsed):
                parsed = parse_table_block(t_parsed["header"], t_parsed["delimiter"], t_parsed["body"])
                
                # Fetch self_ref and docling_cell_count from docling output
                if t_idx < len(doc.tables):
                    docling_table = doc.tables[t_idx]
                    self_ref = docling_table.self_ref
                    docling_cell_count = len(docling_table.data.table_cells)
                    
                    # Read back and decode the grid from docling's TableData
                    grid_decoded = []
                    for row in docling_table.data.grid:
                        row_texts = []
                        for cell in row:
                            row_texts.append(decode_cell(cell.text))
                        grid_decoded.append(row_texts)
                else:
                    self_ref = f"#/tables/{t_idx}"
                    docling_cell_count = parsed["cell_count"]
                    grid_decoded = parsed["grid"]
                    
                tables_out.append({
                    "index": t_idx,
                    "self_ref": self_ref,
                    "num_rows": parsed["num_rows"],
                    "num_cols": parsed["num_cols"],
                    "cell_count": parsed["cell_count"],
                    "docling_cell_count": docling_cell_count,
                    "alignments": parsed["alignments"],
                    "grid": grid_decoded
                })
                
            # Extract pipe_prose
            pipe_prose = []
            for idx, line in enumerate(lines):
                if not is_line_in_fence(idx) and not is_line_in_table(idx):
                    if '|' in line:
                        pipe_prose.append(line.strip())
                        
            # Extract code blocks
            code_items = [item for item, _ in doc.iterate_items() if type(item).__name__ == "CodeItem"]
            code_blocks = []
            code_item_idx = 0
            for idx, fb in enumerate(fenced_blocks):
                target_text = fb["code"].strip()
                found = False
                lang_val = "unknown"
                while code_item_idx < len(code_items):
                    item = code_items[code_item_idx]
                    item_text = item.text.strip() if item.text else ""
                    if item_text == target_text:
                        if hasattr(item, "code_language") and item.code_language is not None:
                            lang_val = item.code_language.value if hasattr(item.code_language, "value") else str(item.code_language)
                        code_item_idx += 1
                        found = True
                        break
                    code_item_idx += 1
                    
                code_blocks.append({
                    "index": idx,
                    "language": lang_val,
                    "chars": len(fb["code"])
                })
                
            # Extract images in document order
            images = []
            img_idx = 0
            for idx, line in enumerate(lines):
                if is_line_in_fence(idx):
                    continue
                for alt, src in find_images_in_line(line):
                    decoded_bytes = get_data_uri_bytes(src)
                    if decoded_bytes is None:
                        images.append({
                            "index": img_idx,
                            "data_bytes": None,
                            "decoded": False,
                            "width": None,
                            "height": None,
                            "reason": "unsupported_source"
                        })
                    else:
                        data_bytes = len(decoded_bytes)
                        if data_bytes > max_image_bytes:
                            images.append({
                                "index": img_idx,
                                "data_bytes": data_bytes,
                                "decoded": False,
                                "width": None,
                                "height": None,
                                "reason": "size_limit"
                            })
                        else:
                            try:
                                img = Image.open(BytesIO(decoded_bytes))
                                w, h = img.size
                                images.append({
                                    "index": img_idx,
                                    "data_bytes": data_bytes,
                                    "decoded": True,
                                    "width": w,
                                    "height": h,
                                    "reason": None
                                })
                            except Exception:
                                images.append({
                                    "index": img_idx,
                                    "data_bytes": data_bytes,
                                    "decoded": False,
                                    "width": None,
                                    "height": None,
                                    "reason": "decode_error"
                                })
                    img_idx += 1
                    
            documents.append({
                "name": name,
                "tables": tables_out,
                "pipe_prose": pipe_prose,
                "code_blocks": code_blocks,
                "images": images,
                "image_size_warnings": image_size_warnings
            })
            
        except Exception as e:
            failed.append({
                "name": name,
                "reason": f"processing_error: {str(e)}"
            })
            
    # Sort documents and failed lists by name ascending
    documents.sort(key=lambda x: x["name"])
    failed.sort(key=lambda x: x["name"])
    
    # Compute totals
    total_documents = len(documents)
    total_failed = len(failed)
    total_tables = sum(len(d["tables"]) for d in documents)
    total_table_cells = sum(sum(t["cell_count"] for t in d["tables"]) for d in documents)
    total_code_blocks = sum(len(d["code_blocks"]) for d in documents)
    total_images = sum(len(d["images"]) for d in documents)
    total_images_decoded = sum(sum(1 for img in d["images"] if img["decoded"]) for d in documents)
    
    totals = {
        "documents": total_documents,
        "failed": total_failed,
        "tables": total_tables,
        "table_cells": total_table_cells,
        "code_blocks": total_code_blocks,
        "images": total_images,
        "images_decoded": total_images_decoded
    }
    
    report = {
        "schema_version": "1.0",
        "max_image_bytes": max_image_bytes,
        "documents": documents,
        "failed": failed,
        "totals": totals
    }
    
    # Ensure parent directories of report_path exist
    report_path.parent.mkdir(parents=True, exist_ok=True)
    
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)
        
    print(f"Audit report successfully written to {report_path}")

if __name__ == "__main__":
    main()
