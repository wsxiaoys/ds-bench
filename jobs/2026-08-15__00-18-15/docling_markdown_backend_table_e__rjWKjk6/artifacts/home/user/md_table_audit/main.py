import os
import re
import sys
import json
import base64
import argparse
import logging
import warnings
import io
from PIL import Image
from docling.document_converter import DocumentConverter, DocumentStream

# Set up logging to avoid cluttering stdout/stderr, but allow capturing
logging.basicConfig(level=logging.WARNING)

def split_row(line):
    parts = []
    current_cell = []
    i = 0
    n = len(line)
    while i < n:
        if line[i] == '\\':
            if i + 1 < n and line[i+1] == '|':
                current_cell.append('|')
                i += 2
            elif i + 1 < n and line[i+1] == '\\':
                current_cell.append('\\')
                i += 2
            else:
                current_cell.append('\\')
                i += 1
        elif line[i] == '|':
            parts.append(''.join(current_cell))
            current_cell = []
            i += 1
        else:
            current_cell.append(line[i])
            i += 1
    parts.append(''.join(current_cell))
    
    trimmed_line = line.strip()
    starts_with_pipe = trimmed_line.startswith('|')
    ends_with_pipe = False
    if trimmed_line.endswith('|'):
        bs_count = 0
        j = len(trimmed_line) - 2
        while j >= 0 and trimmed_line[j] == '\\':
            bs_count += 1
            j -= 1
        if bs_count % 2 == 0:
            ends_with_pipe = True
            
    if starts_with_pipe and len(parts) > 0:
        parts.pop(0)
    if ends_with_pipe and len(parts) > 0:
        parts.pop()
        
    return parts

def remove_links(text):
    return re.sub(r'\[([^\]]*)\]\([^)]*\)', r'\1', text)

def normalize_cell(cell_raw):
    text = remove_links(cell_raw)
    text = text.replace('*', '').replace('`', '')
    text = ' '.join(text.split())
    text = text.strip()
    return text

def parse_gfm_tables(lines):
    # Determine which lines are inside fences
    is_fence_line = [False] * len(lines)
    inside_fence = [False] * len(lines)
    current_inside = False
    for i, line in enumerate(lines):
        stripped = line.strip()
        if stripped.startswith("```"):
            is_fence_line[i] = True
            current_inside = not current_inside
        else:
            inside_fence[i] = current_inside
            
    consumed_lines = set()
    gfm_tables = []
    
    i = 0
    while i < len(lines):
        if i in consumed_lines or is_fence_line[i] or inside_fence[i]:
            i += 1
            continue
            
        line = lines[i]
        stripped = line.strip()
        if not stripped or stripped.startswith('#') or stripped.startswith('```') or '|' not in line:
            i += 1
            continue
            
        if i + 1 >= len(lines):
            i += 1
            continue
            
        next_line = lines[i+1]
        if is_fence_line[i+1] or inside_fence[i+1]:
            i += 1
            continue
            
        h_cells = split_row(line)
        d_cells = split_row(next_line)
        
        if len(h_cells) != len(d_cells) or len(h_cells) == 0:
            i += 1
            continue
            
        d_match = True
        for cell in d_cells:
            cell_stripped = cell.strip()
            if not re.match(r'^:?-+:?$', cell_stripped):
                d_match = False
                break
                
        if not d_match:
            i += 1
            continue
            
        alignments = []
        for cell in d_cells:
            cell_stripped = cell.strip()
            if cell_stripped.startswith(':') and cell_stripped.endswith(':'):
                alignments.append("center")
            elif cell_stripped.startswith(':'):
                alignments.append("left")
            elif cell_stripped.endswith(':'):
                alignments.append("right")
            else:
                alignments.append("none")
                
        body_rows = []
        body_idx = i + 2
        while body_idx < len(lines):
            if is_fence_line[body_idx] or inside_fence[body_idx]:
                break
            body_line = lines[body_idx]
            body_stripped = body_line.strip()
            if not body_stripped or body_stripped.startswith('#') or body_stripped.startswith('```'):
                break
            body_rows.append(body_line)
            body_idx += 1
            
        for tl in range(i, body_idx):
            consumed_lines.add(tl)
            
        gfm_tables.append({
            "start_line_idx": i,
            "end_line_idx": body_idx,
            "H": line,
            "D": next_line,
            "body": body_rows,
            "alignments": alignments,
            "num_cols": len(h_cells),
            "num_rows": 1 + len(body_rows)
        })
        i = body_idx
        
    return gfm_tables, consumed_lines, is_fence_line, inside_fence

def parse_image_source(src):
    if src.startswith("data:") and ";base64," in src:
        parts = src.split(";base64,", 1)
        if len(parts) == 2:
            return parts[1].strip()
    return None

class WarningCounterHandler(logging.Handler):
    def __init__(self):
        super().__init__()
        self.count = 0
    def emit(self, record):
        if "exceeds size limit" in record.getMessage():
            self.count += 1

def process_document(file_path, max_image_bytes, converter):
    name = os.path.splitext(os.path.basename(file_path))[0]
    
    with open(file_path, 'r', encoding='utf-8') as f:
        orig_content = f.read()
        
    lines = orig_content.splitlines()
    gfm_tables, consumed_lines, is_fence_line, inside_fence = parse_gfm_tables(lines)
    
    # Compute pipe_prose
    pipe_prose = []
    for idx, line in enumerate(lines):
        if idx in consumed_lines:
            continue
        if is_fence_line[idx] or inside_fence[idx]:
            continue
        if '|' in line:
            pipe_prose.append(line.strip())
            
    # Preprocess markdown to encode tables
    new_lines = []
    line_idx = 0
    while line_idx < len(lines):
        table_found = None
        for t_idx, tbl in enumerate(gfm_tables):
            if tbl["start_line_idx"] == line_idx:
                table_found = (t_idx, tbl)
                break
                
        if table_found:
            t_idx, tbl = table_found
            delim_cells = []
            for align in tbl["alignments"]:
                if align == "center":
                    delim_cells.append(":---:")
                elif align == "left":
                    delim_cells.append(":---")
                elif align == "right":
                    delim_cells.append("---:")
                else:
                    delim_cells.append("---")
            delim_line = "| " + " | ".join(delim_cells) + " |"
            
            h_cells = split_row(tbl["H"])
            encoded_h_cells = []
            for c in range(tbl["num_cols"]):
                norm = normalize_cell(h_cells[c])
                encoded_val = f"h_{t_idx}_0_{c}_" + norm.encode('utf-8').hex()
                encoded_h_cells.append(encoded_val)
            header_line = "| " + " | ".join(encoded_h_cells) + " |"
            
            new_lines.append(header_line)
            new_lines.append(delim_line)
            
            for r in range(1, tbl["num_rows"]):
                body_line_raw = tbl["body"][r-1]
                b_cells = split_row(body_line_raw)
                encoded_b_cells = []
                for c in range(tbl["num_cols"]):
                    raw_cell = b_cells[c] if c < len(b_cells) else ""
                    norm = normalize_cell(raw_cell)
                    encoded_val = f"h_{t_idx}_{r}_{c}_" + norm.encode('utf-8').hex()
                    encoded_b_cells.append(encoded_val)
                body_line = "| " + " | ".join(encoded_b_cells) + " |"
                new_lines.append(body_line)
                
            line_idx = tbl["end_line_idx"]
        else:
            new_lines.append(lines[line_idx])
            line_idx += 1
            
    preprocessed_md = "\n".join(new_lines)
    
    # Parse markdown images from original lines (outside fences)
    md_images = []
    for idx, line in enumerate(lines):
        if is_fence_line[idx] or inside_fence[idx]:
            continue
        matches = re.finditer(r'!\[([^\]]*)\]\(([^)]*)\)', line)
        for m in matches:
            alt = m.group(1)
            url = m.group(2)
            md_images.append({
                "alt": alt,
                "url": url
            })
            
    # Run docling conversion with warning tracking
    log_handler = WarningCounterHandler()
    logger = logging.getLogger()
    logger.addHandler(log_handler)
    
    image_size_warnings = 0
    images_report = []
    
    with warnings.catch_warnings(record=True) as caught_warnings:
        warnings.simplefilter("always")
        stream = DocumentStream(name='document.md', stream=io.BytesIO(preprocessed_md.encode('utf-8')))
        res = converter.convert(stream)
        
        # Now process the images ourselves
        for img_idx, img_info in enumerate(md_images):
            url = img_info["url"]
            b64_data = parse_image_source(url)
            if b64_data is not None:
                try:
                    decoded_bytes = base64.b64decode(b64_data)
                    data_bytes = len(decoded_bytes)
                except Exception:
                    decoded_bytes = None
                    data_bytes = None
                    
                if decoded_bytes is not None:
                    if data_bytes > max_image_bytes:
                        # Exceeds cap!
                        warnings.warn("Image exceeds size limit", UserWarning)
                        images_report.append({
                            "index": img_idx,
                            "data_bytes": data_bytes,
                            "decoded": False,
                            "width": None,
                            "height": None,
                            "reason": "size_limit"
                        })
                    else:
                        try:
                            img = Image.open(io.BytesIO(decoded_bytes))
                            width, height = img.size
                            images_report.append({
                                "index": img_idx,
                                "data_bytes": data_bytes,
                                "decoded": True,
                                "width": width,
                                "height": height,
                                "reason": None
                            })
                        except Exception:
                            images_report.append({
                                "index": img_idx,
                                "data_bytes": data_bytes,
                                "decoded": False,
                                "width": None,
                                "height": None,
                                "reason": "corrupt_image"
                            })
                else:
                    images_report.append({
                        "index": img_idx,
                        "data_bytes": None,
                        "decoded": False,
                        "width": None,
                        "height": None,
                        "reason": "unsupported_source"
                    })
            else:
                images_report.append({
                    "index": img_idx,
                    "data_bytes": None,
                    "decoded": False,
                    "width": None,
                    "height": None,
                    "reason": "unsupported_source"
                })
                
        # Count warnings
        for w in caught_warnings:
            if "exceeds size limit" in str(w.message):
                image_size_warnings += 1
                
    logger.removeHandler(log_handler)
    image_size_warnings += log_handler.count
    
    # Extract code blocks
    code_blocks_report = []
    for item, level in res.document.iterate_items():
        if item.label == 'code':
            if hasattr(item, 'code_language') and item.code_language is not None:
                if hasattr(item.code_language, 'value'):
                    lang = item.code_language.value
                else:
                    lang = str(item.code_language)
            else:
                lang = "unknown"
                
            code_blocks_report.append({
                "index": len(code_blocks_report),
                "language": lang,
                "chars": len(item.text)
            })
            
    # Extract and reconstruct tables
    tables_report = []
    for tbl in gfm_tables:
        tables_report.append({
            "index": len(tables_report),
            "self_ref": "",
            "num_rows": tbl["num_rows"],
            "num_cols": tbl["num_cols"],
            "cell_count": tbl["num_rows"] * tbl["num_cols"],
            "docling_cell_count": 0,
            "alignments": tbl["alignments"],
            "grid": []
        })
        
    for item, level in res.document.iterate_items():
        if item.label == 'table':
            first_cell_text = item.data.grid[0][0].text
            m = re.match(r'^h_(\d+)_(\d+)_(\d+)_(.*)$', first_cell_text)
            if m:
                t_idx = int(m.group(1))
                if t_idx < len(tables_report):
                    tbl_rep = tables_report[t_idx]
                    tbl_rep["self_ref"] = item.self_ref
                    tbl_rep["docling_cell_count"] = len(item.data.table_cells)
                    
                    grid_2d = []
                    for r_idx in range(tbl_rep["num_rows"]):
                        row_cells = []
                        for c_idx in range(tbl_rep["num_cols"]):
                            cell_obj = item.data.grid[r_idx][c_idx]
                            cell_text = cell_obj.text
                            dec_m = re.match(r'^h_(\d+)_(\d+)_(\d+)_(.*)$', cell_text)
                            if dec_m:
                                hex_data = dec_m.group(4)
                                if hex_data:
                                    decoded_val = bytes.fromhex(hex_data).decode('utf-8')
                                else:
                                    decoded_val = ""
                            else:
                                decoded_val = cell_text
                            row_cells.append(decoded_val)
                        grid_2d.append(row_cells)
                    tbl_rep["grid"] = grid_2d
                    
    doc_obj = {
        "name": name,
        "tables": tables_report,
        "pipe_prose": pipe_prose,
        "code_blocks": code_blocks_report,
        "images": images_report,
        "image_size_warnings": image_size_warnings
    }
    return doc_obj

def main():
    parser = argparse.ArgumentParser(description="GFM Table Edge-Case Audit with Docling")
    parser.add_argument("--corpus", required=True, help="Path to the corpus directory")
    parser.add_argument("--out", required=True, help="Path to the output report JSON file")
    parser.add_argument("--max-image-bytes", required=True, type=int, help="Byte cap on embedded image data")
    
    args = parser.parse_args()
    
    corpus_dir = args.corpus
    report_path = args.out
    max_image_bytes = args.max_image_bytes
    
    if not os.path.isdir(corpus_dir):
        print(f"Error: Corpus directory '{corpus_dir}' does not exist.", file=sys.stderr)
        sys.exit(1)
        
    # Find all .md files directly in corpus_dir
    files = [f for f in os.listdir(corpus_dir) if f.endswith(".md")]
    files.sort()
    
    documents = []
    failed = []
    
    converter = DocumentConverter()
    
    for file_name in files:
        file_path = os.path.join(corpus_dir, file_name)
        name = os.path.splitext(file_name)[0]
        
        # Test if it is valid UTF-8
        try:
            with open(file_path, 'rb') as f:
                content_bytes = f.read()
            content_bytes.decode('utf-8')
        except UnicodeDecodeError:
            failed.append({
                "name": name,
                "reason": "decode_error"
            })
            continue
        except Exception as e:
            failed.append({
                "name": name,
                "reason": f"error: {str(e)}"
            })
            continue
            
        try:
            doc_obj = process_document(file_path, max_image_bytes, converter)
            documents.append(doc_obj)
        except Exception as e:
            failed.append({
                "name": name,
                "reason": f"processing_error: {str(e)}"
            })
            
    # Sort documents and failed by name ascending (they are already sorted by file name, but let's be explicit)
    documents.sort(key=lambda d: d["name"])
    failed.sort(key=lambda f: f["name"])
    
    # Calculate totals
    total_tables = sum(len(d["tables"]) for d in documents)
    total_table_cells = sum(sum(t["cell_count"] for t in d["tables"]) for d in documents)
    total_code_blocks = sum(len(d["code_blocks"]) for d in documents)
    total_images = sum(len(d["images"]) for d in documents)
    total_images_decoded = sum(sum(1 for img in d["images"] if img["decoded"]) for d in documents)
    
    totals = {
        "documents": len(documents),
        "failed": len(failed),
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
    
    # Create parent directories of report_path if they don't exist
    parent_dir = os.path.dirname(os.path.abspath(report_path))
    if parent_dir:
        os.makedirs(parent_dir, exist_ok=True)
        
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, indent=2, ensure_ascii=False)
        
    print(f"Audit completed. Report written to {report_path}")
    sys.exit(0)

if __name__ == "__main__":
    main()
