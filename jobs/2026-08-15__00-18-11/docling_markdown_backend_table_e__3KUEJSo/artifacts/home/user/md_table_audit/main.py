#!/usr/bin/env python3
import os
import sys
import re
import json
import argparse
import base64
import tempfile
import warnings
from io import BytesIO
from PIL import Image

# Docling imports
from docling.document_converter import DocumentConverter, FormatOption
from docling.datamodel.base_models import InputFormat
from docling.datamodel.backend_options import MarkdownBackendOptions
from docling.utils.code_language import detect_code_language

def split_gfm_line(line: str) -> list[str]:
    cells = []
    current = []
    i = 0
    n = len(line)
    while i < n:
        if line[i] == '\\' and i + 1 < n:
            current.append(line[i])
            current.append(line[i+1])
            i += 2
        elif line[i] == '|':
            cells.append(''.join(current))
            current = []
            i += 1
        else:
            current.append(line[i])
            i += 1
    cells.append(''.join(current))
    
    stripped = line.strip()
    if stripped.startswith('|'):
        cells.pop(0)
    if stripped.endswith('|'):
        # Check if the last '|' is escaped.
        backslash_count = 0
        j = len(stripped) - 2
        while j >= 0 and stripped[j] == '\\':
            backslash_count += 1
            j -= 1
        if backslash_count % 2 == 0:
            cells.pop()
            
    return cells

def normalize_cell_text(cell_raw: str) -> str:
    # Replace escaped pipe with literal pipe
    text = cell_raw.replace('\\|', '|')
    
    # 1. replace [text](url) link with text
    text = re.sub(r'\[([^\]]*)\]\([^)]*\)', r'\1', text)
    
    # 2. delete every * and backtick character
    text = text.replace('*', '').replace('`', '')
    
    # 3. collapse whitespace runs to a single space, and strip
    text = " ".join(text.split())
    
    return text

def parse_markdown_document(content: str, max_image_bytes: int) -> tuple[list[dict], list[dict], list[str], list[dict]]:
    lines = content.splitlines()
    i = 0
    n = len(lines)
    
    tables = []
    code_blocks = []
    pipe_prose = []
    images = []
    
    # Pass 1: Parse code blocks, tables, and pipe prose
    while i < n:
        line = lines[i]
        stripped = line.strip()
        
        # Check for fenced code block start
        if stripped.startswith('```'):
            lang_hint = stripped[3:].strip()
            start_idx = i
            j = i + 1
            while j < n and not lines[j].strip().startswith('```'):
                j += 1
            
            code_lines = lines[i+1 : j]
            code_content = "\n".join(code_lines)
            
            code_blocks.append({
                "index": len(code_blocks),
                "language": detect_code_language(code_content, hint=lang_hint),
                "chars": len(code_content)
            })
            
            if j < n:
                i = j + 1
            else:
                i = n
            continue
            
        # Outside fences, check for table start
        is_table = False
        if stripped != "" and not stripped.startswith('#') and not stripped.startswith('```') and '|' in line:
            if i + 1 < n:
                H = line
                D = lines[i+1]
                cells_H = split_gfm_line(H)
                cells_D = split_gfm_line(D)
                if len(cells_H) > 0 and len(cells_H) == len(cells_D) and all(re.match(r'^:?-+:?$', c.strip()) for c in cells_D):
                    is_table = True
                    
        if is_table:
            H = line
            D = lines[i+1]
            cells_H = split_gfm_line(H)
            cells_D = split_gfm_line(D)
            num_cols = len(cells_H)
            
            # Alignments
            alignments = []
            for c in cells_D:
                sc = c.strip()
                starts = sc.startswith(':')
                ends = sc.endswith(':')
                if starts and ends:
                    alignments.append("center")
                elif starts:
                    alignments.append("left")
                elif ends:
                    alignments.append("right")
                else:
                    alignments.append("none")
            
            # Body rows
            body_lines = []
            k = i + 2
            while k < n:
                bl = lines[k]
                sbl = bl.strip()
                if sbl == "" or sbl.startswith('#') or sbl.startswith('```'):
                    break
                body_lines.append(bl)
                k += 1
                
            # Grid
            grid = []
            header_row = [normalize_cell_text(c) for c in cells_H]
            grid.append(header_row)
            
            for bl in body_lines:
                cells_B = split_gfm_line(bl)
                if len(cells_B) < num_cols:
                    cells_B += [""] * (num_cols - len(cells_B))
                elif len(cells_B) > num_cols:
                    cells_B = cells_B[:num_cols]
                grid.append([normalize_cell_text(c) for c in cells_B])
                
            num_rows = len(grid)
            cell_count = num_rows * num_cols
            
            tables.append({
                "index": len(tables),
                "start_line": i,
                "end_line": k - 1,
                "num_rows": num_rows,
                "num_cols": num_cols,
                "cell_count": cell_count,
                "alignments": alignments,
                "grid": grid
            })
            
            i = k
            continue
            
        # Outside tables and code blocks, check for pipe prose
        if '|' in line:
            pipe_prose.append(stripped)
            
        i += 1
        
    # Pass 2: Parse images (order-preserving, outside fenced code blocks)
    in_fence = False
    for line in lines:
        stripped = line.strip()
        if stripped.startswith('```'):
            in_fence = not in_fence
            continue
        if in_fence:
            continue
            
        for match in re.finditer(r'!\[([^\]]*)\]\(([^)]*)\)', line):
            alt = match.group(1)
            src = match.group(2)
            
            if src.startswith("data:"):
                encoded_data = re.sub(r"^data:image/.+;base64,", "", src)
                try:
                    decoded_data = base64.b64decode(encoded_data)
                    data_bytes = len(decoded_data)
                except Exception:
                    data_bytes = 0
                    
                if data_bytes <= max_image_bytes:
                    try:
                        img = Image.open(BytesIO(decoded_data))
                        width, height = img.size
                        decoded = True
                        reason = None
                    except Exception:
                        width, height = None, None
                        decoded = False
                        reason = "corrupted"
                else:
                    width, height = None, None
                    decoded = False
                    reason = "size_limit"
            else:
                data_bytes = None
                decoded = False
                width, height = None, None
                reason = "unsupported_source"
                
            images.append({
                "index": len(images),
                "data_bytes": data_bytes,
                "decoded": decoded,
                "width": width,
                "height": height,
                "reason": reason
            })
            
    return tables, code_blocks, pipe_prose, images

def encode_markdown_for_docling(content: str, tables: list[dict]) -> str:
    lines = content.splitlines()
    encoded_lines = []
    
    line_to_table = {}
    for t in tables:
        for idx in range(t["start_line"], t["end_line"] + 1):
            line_to_table[idx] = t
            
    in_fence = False
    for idx, line in enumerate(lines):
        stripped = line.strip()
        if stripped.startswith('```'):
            in_fence = not in_fence
            encoded_lines.append(line)
            continue
            
        if in_fence:
            encoded_lines.append(line)
            continue
            
        if idx in line_to_table:
            t = line_to_table[idx]
            if idx == t["start_line"]:
                encoded_cells = [cell.replace('|', 'POCHIPIPE') for cell in t["grid"][0]]
                encoded_lines.append("| " + " | ".join(encoded_cells) + " |")
            elif idx == t["start_line"] + 1:
                encoded_lines.append("| " + " | ".join("---" for _ in range(t["num_cols"])) + " |")
            else:
                row_idx = idx - (t["start_line"] + 2)
                encoded_cells = [cell.replace('|', 'POCHIPIPE') for cell in t["grid"][1 + row_idx]]
                encoded_lines.append("| " + " | ".join(encoded_cells) + " |")
        else:
            encoded_line = line.replace('|', '&#124;')
            encoded_lines.append(encoded_line)
            
    return "\n".join(encoded_lines)

def main():
    parser = argparse.ArgumentParser(description="Offline GFM Table Edge-Case Audit with Docling")
    parser.add_argument("--corpus", required=True, help="Corpus directory path")
    parser.add_argument("--out", required=True, help="Output report path")
    parser.add_argument("--max-image-bytes", required=True, type=int, help="Maximum allowed bytes for embedded image data")
    
    args = parser.parse_args()
    
    corpus_dir = args.corpus
    report_path = args.out
    max_image_bytes = args.max_image_bytes
    
    if not os.path.isdir(corpus_dir):
        print(f"Error: Corpus directory '{corpus_dir}' does not exist.", file=sys.stderr)
        sys.exit(1)
        
    # Find all *.md files directly in corpus_dir
    files = []
    for f in os.listdir(corpus_dir):
        if f.endswith(".md"):
            files.append(f)
    files.sort()
    
    documents = []
    failed = []
    
    # Initialize Docling converter
    converter_default = DocumentConverter()
    default_md_opt = converter_default.format_to_options[InputFormat.MD]
    md_opt = default_md_opt.model_copy()
    md_opt.backend_options = MarkdownBackendOptions(
        fetch_images=True,
        max_image_data_base64_bytes=max_image_bytes
    )
    converter = DocumentConverter(format_options={InputFormat.MD: md_opt})
    
    for filename in files:
        filepath = os.path.join(corpus_dir, filename)
        name = filename[:-3] # Remove '.md' suffix
        
        # Read file and check for decode error
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                content = f.read()
        except UnicodeDecodeError:
            failed.append({
                "name": name,
                "reason": "decode_error"
            })
            continue
            
        # Parse document using GFM rules
        tables, code_blocks, pipe_prose, images = parse_markdown_document(content, max_image_bytes)
        
        # Encode markdown to pass to docling
        encoded_content = encode_markdown_for_docling(content, tables)
        
        # Run docling on encoded content using a temporary file
        image_size_warnings = 0
        with tempfile.NamedTemporaryFile(suffix=".md", mode="w+", encoding="utf-8", delete=False) as tmp:
            tmp.write(encoded_content)
            tmp_path = tmp.name
            
        try:
            with warnings.catch_warnings(record=True) as w:
                warnings.simplefilter("always")
                result = converter.convert(tmp_path)
                doc = result.document
                
                # Count warnings containing "exceeds size limit"
                for warning in w:
                    if "exceeds size limit" in str(warning.message):
                        image_size_warnings += 1
        except Exception as e:
            # If docling fails to convert, report as failed
            # (Though with our safe encoding it should not fail)
            failed.append({
                "name": name,
                "reason": f"docling_error: {str(e)}"
            })
            try:
                os.remove(tmp_path)
            except OSError:
                pass
            continue
            
        try:
            os.remove(tmp_path)
        except OSError:
            pass
            
        # Extract TableItems from docling output and match them to our tables
        docling_tables = []
        for item, _ in doc.iterate_items():
            if item.label == "table":
                docling_tables.append(item)
                
        # Reconstruct tables with self_ref and docling_cell_count
        report_tables = []
        for idx, t in enumerate(tables):
            if idx < len(docling_tables):
                table_item = docling_tables[idx]
                self_ref = table_item.self_ref
                
                # Retrieve the grid from docling to be 100% sure we read it from TableData
                grid_cells = []
                for r in table_item.data.grid:
                    grid_row = []
                    for cell in r:
                        cell_text = cell.text.replace('POCHIPIPE', '|')
                        grid_row.append(cell_text)
                    grid_cells.append(grid_row)
                    
                docling_cell_count = sum(len(r) for r in table_item.data.grid)
            else:
                self_ref = f"#/tables/{idx}"
                docling_cell_count = t["cell_count"]
                grid_cells = t["grid"]
                
            report_tables.append({
                "index": t["index"],
                "self_ref": self_ref,
                "num_rows": t["num_rows"],
                "num_cols": t["num_cols"],
                "cell_count": t["cell_count"],
                "docling_cell_count": docling_cell_count,
                "alignments": t["alignments"],
                "grid": grid_cells
            })
            
        documents.append({
            "name": name,
            "tables": report_tables,
            "pipe_prose": pipe_prose,
            "code_blocks": code_blocks,
            "images": images,
            "image_size_warnings": image_size_warnings
        })
        
    # Sort documents and failed by name ascending
    documents.sort(key=lambda x: x["name"])
    failed.sort(key=lambda x: x["name"])
    
    # Calculate totals
    total_documents = len(documents)
    total_failed = len(failed)
    total_tables = sum(len(d["tables"]) for d in documents)
    total_table_cells = sum(sum(t["cell_count"] for t in d["tables"]) for d in documents)
    total_code_blocks = sum(len(d["code_blocks"]) for d in documents)
    total_images = sum(len(d["images"]) for d in documents)
    total_images_decoded = sum(sum(1 for img in d["images"] if img["decoded"]) for d in documents)
    
    report_data = {
        "schema_version": "1.0",
        "max_image_bytes": max_image_bytes,
        "documents": documents,
        "failed": failed,
        "totals": {
            "documents": total_documents,
            "failed": total_failed,
            "tables": total_tables,
            "table_cells": total_table_cells,
            "code_blocks": total_code_blocks,
            "images": total_images,
            "images_decoded": total_images_decoded
        }
    }
    
    # Write report
    out_dir = os.path.dirname(report_path)
    if out_dir:
        os.makedirs(out_dir, exist_ok=True)
        
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(report_data, f, indent=2)
        
    print(f"Audit completed successfully. Report written to {report_path}")
    sys.exit(0)

if __name__ == "__main__":
    main()
