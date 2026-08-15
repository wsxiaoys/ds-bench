import os
import re
import sys
import glob
import json
import base64
import argparse
import warnings
from html import unescape
from io import BytesIO

from docling.document_converter import DocumentConverter, InputFormat
from docling.backend.md_backend import MarkdownBackendOptions

def split_gfm_row(line):
    unescaped_pipe_indices = []
    for i, char in enumerate(line):
        if char == '|':
            if i > 0 and line[i-1] == '\\':
                pass
            else:
                unescaped_pipe_indices.append(i)
                
    if not unescaped_pipe_indices:
        return [line]
        
    cells = []
    last_idx = 0
    for idx in unescaped_pipe_indices:
        cells.append(line[last_idx:idx])
        last_idx = idx + 1
    cells.append(line[last_idx:])
    
    # Check if leading/trailing empty cells should be dropped
    if line[:unescaped_pipe_indices[0]].strip() == "":
        cells = cells[1:]
        unescaped_pipe_indices = unescaped_pipe_indices[1:]
        
    if unescaped_pipe_indices and line[unescaped_pipe_indices[-1] + 1:].strip() == "":
        cells = cells[:-1]
        
    return cells

def clean_cell_text(raw_text):
    # First, replace \| with |
    text = raw_text.replace(r'\|', '|')
    
    # 1. Replace every [text](url) link with text
    text = re.sub(r'\[([^\]]*)\]\([^)]*\)', r'\1', text)
    
    # 2. Delete every * and backtick character
    text = text.replace('*', '').replace('`', '')
    
    # 3. Collapse whitespace runs to a single space, and strip
    text = re.sub(r'\s+', ' ', text).strip()
    
    # 4. Empty cells are reported as ""
    if not text:
        return ""
    return text

def get_base64_data_bytes(url):
    if url.startswith("data:") and ";base64," in url:
        try:
            parts = url.split(";base64,", 1)
            b64_data = parts[1].strip()
            decoded = base64.b64decode(b64_data)
            return len(decoded)
        except Exception:
            return None
    return None

def process_document(file_path, max_image_bytes, converter):
    name = os.path.splitext(os.path.basename(file_path))[0]
    
    try:
        with open(file_path, "rb") as f:
            bytes_content = f.read()
        content = bytes_content.decode("utf-8")
    except Exception:
        return None, {"name": name, "reason": "decode_error"}
        
    lines = content.splitlines()
    N = len(lines)
    
    in_fence = False
    i = 0
    table_blocks = []
    pipe_prose = []
    rewritten_lines = []
    found_images = []
    found_fenced_code_blocks = []
    
    while i < N:
        line = lines[i]
        stripped = line.strip()
        
        # Check for fence toggle / block start
        if stripped.startswith("```"):
            lang_hint = stripped[3:].strip()
            
            # Read lines until we hit the closing fence or EOF
            code_lines = []
            j = i + 1
            while j < N:
                next_line = lines[j]
                if next_line.strip().startswith("```"):
                    break
                code_lines.append(next_line)
                j += 1
                
            code_text = "\n".join(code_lines)
            found_fenced_code_blocks.append({
                "lang_hint": lang_hint,
                "code_text": code_text
            })
            
            # Append the lines to rewritten_lines as they are
            for idx in range(i, min(j + 1, N)):
                rewritten_lines.append(lines[idx])
                
            i = j + 1
            continue
            
        # Outside fences, check if a table block starts at line i (H)
        is_table_start = False
        if stripped != "" and not stripped.startswith("#") and not stripped.startswith("```") and "|" in line:
            if i + 1 < N:
                next_line = lines[i+1]
                h_cells = split_gfm_row(line)
                d_cells = split_gfm_row(next_line)
                
                if len(h_cells) >= 1 and len(d_cells) == len(h_cells):
                    all_match = True
                    for cell in d_cells:
                        if not re.match(r'^:?-+:?$', cell.strip()):
                            all_match = False
                            break
                    if all_match:
                        is_table_start = True
                        
        if is_table_start:
            H_line = line
            D_line = lines[i+1]
            
            h_cells = split_gfm_row(H_line)
            d_cells = split_gfm_row(D_line)
            num_cols = len(h_cells)
            
            # Read body rows
            body_lines = []
            j = i + 2
            while j < N:
                b_line = lines[j]
                b_stripped = b_line.strip()
                if b_stripped == "" or b_stripped.startswith("#") or b_stripped.startswith("```"):
                    break
                body_lines.append(b_line)
                j += 1
                
            # Parse and normalize alignments
            alignments = []
            for cell in d_cells:
                c_trimmed = cell.strip()
                starts = c_trimmed.startswith(':')
                ends = c_trimmed.endswith(':')
                if starts and ends:
                    alignments.append("center")
                elif starts:
                    alignments.append("left")
                elif ends:
                    alignments.append("right")
                else:
                    alignments.append("none")
                    
            # Parse and normalize grid
            grid = []
            header_row = [clean_cell_text(c) for c in h_cells]
            grid.append(header_row)
            
            # Look for images in header row line
            matches = re.findall(r'!\[([^\]]*)\]\(([^)]+)\)', H_line)
            for alt, url in matches:
                found_images.append((alt, url))
                
            # Look for images in delimiter line
            matches = re.findall(r'!\[([^\]]*)\]\(([^)]+)\)', D_line)
            for alt, url in matches:
                found_images.append((alt, url))
                
            for b_line in body_lines:
                # Look for images in body row lines
                matches = re.findall(r'!\[([^\]]*)\]\(([^)]+)\)', b_line)
                for alt, url in matches:
                    found_images.append((alt, url))
                    
                b_cells = split_gfm_row(b_line)
                b_row = [clean_cell_text(c) for c in b_cells]
                if len(b_row) < num_cols:
                    b_row += [""] * (num_cols - len(b_row))
                elif len(b_row) > num_cols:
                    b_row = b_row[:num_cols]
                grid.append(b_row)
                
            num_rows = len(grid)
            cell_count = num_rows * num_cols
            
            # Store table block info
            table_blocks.append({
                "num_rows": num_rows,
                "num_cols": num_cols,
                "cell_count": cell_count,
                "alignments": alignments,
                "grid": grid
            })
            
            # Rewrite the table with transport-safe encoding
            def encode_cell(text):
                return text.replace('|', 'PIPEPLACEHOLDER')
                
            encoded_header = [encode_cell(c) for c in grid[0]]
            rewritten_lines.append("| " + " | ".join(encoded_header) + " |")
            
            delim_cells = []
            for align in alignments:
                if align == "center":
                    delim_cells.append(":---:")
                elif align == "left":
                    delim_cells.append(":---")
                elif align == "right":
                    delim_cells.append("---:")
                else:
                    delim_cells.append("---")
            rewritten_lines.append("| " + " | ".join(delim_cells) + " |")
            
            for r in range(1, num_rows):
                encoded_row = [encode_cell(c) for c in grid[r]]
                rewritten_lines.append("| " + " | ".join(encoded_row) + " |")
                
            i = j
            continue
            
        else:
            # Not a table start
            # Check for images on this line
            matches = re.findall(r'!\[([^\]]*)\]\(([^)]+)\)', line)
            for alt, url in matches:
                found_images.append((alt, url))
                
            # Check for pipe prose
            if "|" in line:
                pipe_prose.append(stripped)
                
            rewritten_lines.append(line)
            i += 1
            
    # Combine rewritten lines
    preprocessed_markdown = "\n".join(rewritten_lines)
    
    # Run docling conversion and catch warnings
    with warnings.catch_warnings(record=True) as caught_warnings:
        warnings.simplefilter("always")
        result = converter.convert_string(preprocessed_markdown, format=InputFormat.MD, name=name)
        
    # Count warnings whose message contains "exceeds size limit"
    image_size_warnings = 0
    for w in caught_warnings:
        msg = str(w.message)
        if "exceeds size limit" in msg:
            image_size_warnings += 1
            
    doc = result.document
    
    # Process tables
    tables_list = []
    for t_idx, tb in enumerate(table_blocks):
        p_item = doc.tables[t_idx]
        docling_cell_count = len(p_item.data.table_cells)
        
        grid = []
        for r in range(p_item.data.num_rows):
            row_cells = []
            for c in range(p_item.data.num_cols):
                cell = p_item.data.grid[r][c]
                cell_text = cell.text.replace('PIPEPLACEHOLDER', '|')
                row_cells.append(cell_text)
            grid.append(row_cells)
            
        tables_list.append({
            "index": t_idx,
            "self_ref": p_item.self_ref,
            "num_rows": p_item.data.num_rows,
            "num_cols": p_item.data.num_cols,
            "cell_count": tb["cell_count"],
            "docling_cell_count": docling_cell_count,
            "alignments": tb["alignments"],
            "grid": grid
        })
        
    # Process code blocks
    code_blocks_list = []
    matched_items = []
    for cb_idx, cb in enumerate(found_fenced_code_blocks):
        code_text = cb["code_text"]
        
        matched_code_item = None
        for item in doc.texts:
            if item.label == 'code' and item.text == code_text and item not in matched_items:
                matched_code_item = item
                matched_items.append(item)
                break
                
        language = "unknown"
        if matched_code_item is not None:
            lang_val = getattr(matched_code_item, "code_language", None)
            if lang_val is not None:
                if hasattr(lang_val, "value"):
                    language = lang_val.value
                else:
                    language = str(lang_val)
                    
        code_blocks_list.append({
            "index": cb_idx,
            "language": language,
            "chars": len(code_text)
        })
        
    # Process images
    images_list = []
    for idx, (alt, url) in enumerate(found_images):
        is_b64 = url.startswith("data:") and ";base64," in url
        
        data_bytes = None
        if is_b64:
            data_bytes = get_base64_data_bytes(url)
            
        p_item = None
        if idx < len(doc.pictures):
            p_item = doc.pictures[idx]
            
        decoded = False
        width = None
        height = None
        reason = None
        
        if p_item is not None and p_item.image is not None:
            decoded = True
            if p_item.image.pil_image is not None:
                width = p_item.image.pil_image.width
                height = p_item.image.pil_image.height
            else:
                width = int(p_item.image.size.width)
                height = int(p_item.image.size.height)
        else:
            if not is_b64:
                reason = "unsupported_source"
            else:
                reason = "size_limit"
                
        images_list.append({
            "index": idx,
            "data_bytes": data_bytes,
            "decoded": decoded,
            "width": width,
            "height": height,
            "reason": reason
        })
        
    document_obj = {
        "name": name,
        "tables": tables_list,
        "pipe_prose": pipe_prose,
        "code_blocks": code_blocks_list,
        "images": images_list,
        "image_size_warnings": image_size_warnings
    }
    
    return document_obj, None

def main():
    parser = argparse.ArgumentParser(description="Offline GFM Table Edge-Case Audit with Docling")
    parser.add_argument("--corpus", required=True, help="Path to corpus directory")
    parser.add_argument("--out", required=True, help="Path to write the report JSON")
    parser.add_argument("--max-image-bytes", type=int, required=True, help="Byte cap on embedded image data")
    args = parser.parse_args()
    
    corpus_dir = args.corpus
    report_path = args.out
    max_image_bytes = args.max_image_bytes
    
    # Initialize DocumentConverter
    converter = DocumentConverter()
    converter.format_to_options[InputFormat.MD].backend_options = MarkdownBackendOptions(
        fetch_images=True,
        max_image_data_base64_bytes=max_image_bytes,
        enable_remote_fetch=False,
        enable_local_fetch=False
    )
    
    # Find all .md files in the corpus directory (no recursion)
    md_files = glob.glob(os.path.join(corpus_dir, "*.md"))
    # Sort by filename ascending
    md_files.sort(key=lambda x: os.path.basename(x))
    
    documents = []
    failed = []
    
    for file_path in md_files:
        doc_obj, fail_obj = process_document(file_path, max_image_bytes, converter)
        if fail_obj:
            failed.append(fail_obj)
        else:
            documents.append(doc_obj)
            
    # Sort documents and failed by name ascending
    documents.sort(key=lambda x: x["name"])
    failed.sort(key=lambda x: x["name"])
    
    # Calculate totals
    total_docs = len(documents)
    total_failed = len(failed)
    total_tables = sum(len(d["tables"]) for d in documents)
    total_table_cells = sum(sum(t["cell_count"] for t in d["tables"]) for d in documents)
    total_code_blocks = sum(len(d["code_blocks"]) for d in documents)
    total_images = sum(len(d["images"]) for d in documents)
    total_images_decoded = sum(sum(1 for img in d["images"] if img["decoded"]) for d in documents)
    
    report = {
        "schema_version": "1.0",
        "max_image_bytes": max_image_bytes,
        "documents": documents,
        "failed": failed,
        "totals": {
            "documents": total_docs,
            "failed": total_failed,
            "tables": total_tables,
            "table_cells": total_table_cells,
            "code_blocks": total_code_blocks,
            "images": total_images,
            "images_decoded": total_images_decoded
        }
    }
    
    # Create parent directories of report_path if they don't exist
    out_dir = os.path.dirname(os.path.abspath(report_path))
    if out_dir:
        os.makedirs(out_dir, exist_ok=True)
        
    # Write report
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)
        
    sys.exit(0)

if __name__ == "__main__":
    main()
