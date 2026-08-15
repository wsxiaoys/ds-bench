#!/usr/bin/env python3
import argparse
import base64
import json
import os
import sys
from docling.document_converter import DocumentConverter
from docling_core.types.doc.document import ContentLayer
from docling.backend.utils.image_resource_loader import ImageResourceLoader, validate_url_safety

def main():
    parser = argparse.ArgumentParser(description="HTML Ingestion Audit Tool")
    parser.add_argument("--html-dir", required=True, help="Directory containing HTML fixtures")
    parser.add_argument("--local-root", required=True, help="Local root directory for assets")
    parser.add_argument("--report", required=True, help="Path to write the JSON report")
    
    args = parser.parse_args()
    
    html_dir = args.html_dir
    local_root = args.local_root
    report_path = args.report
    
    # Validation: If --html-dir or --local-root does not exist as a directory, write no report, print a diagnostic to stderr, and exit with code 2.
    if not os.path.isdir(html_dir):
        sys.stderr.write(f"Error: HTML directory '{html_dir}' does not exist or is not a directory.\n")
        sys.exit(2)
    if not os.path.isdir(local_root):
        sys.stderr.write(f"Error: Local root directory '{local_root}' does not exist or is not a directory.\n")
        sys.exit(2)
        
    # Get absolute paths
    html_dir_abs = os.path.abspath(html_dir)
    local_root_abs = os.path.abspath(local_root)
    
    # 1. Documents
    documents_report = []
    html_files = sorted([f for f in os.listdir(html_dir_abs) if f.endswith(".html")])
    
    converter = DocumentConverter()
    
    for filename in html_files:
        file_path = os.path.join(html_dir_abs, filename)
        res = converter.convert(file_path)
        doc = res.document
        
        # BODY-only markdown
        body_md = doc.export_to_markdown(included_content_layers={ContentLayer.BODY})
        body_lines = [line.rstrip() for line in body_md.split("\n")]
        body_lines = [line for line in body_lines if line]
        
        body_blocks = [block.strip() for block in body_md.split("\n\n")]
        body_blocks = [block for block in body_blocks if block]
        
        # BODY + FURNITURE markdown
        full_md = doc.export_to_markdown(included_content_layers={ContentLayer.BODY, ContentLayer.FURNITURE})
        full_lines = [line.rstrip() for line in full_md.split("\n")]
        full_lines = [line for line in full_lines if line]
        
        tables = list(doc.tables)
        table_shapes = [[t.data.num_rows, t.data.num_cols] for t in tables]
        table_cell_texts = [[c.text for c in t.data.table_cells] for t in tables]
        
        pictures = len(list(doc.pictures))
        
        doc_entry = {
            "name": filename,
            "body_lines": body_lines,
            "body_blocks": body_blocks,
            "full_lines": full_lines,
            "tables": len(tables),
            "table_shapes": table_shapes,
            "table_cell_texts": table_cell_texts,
            "pictures": pictures
        }
        documents_report.append(doc_entry)
        
    # 2. Resolution Probes
    LOCAL_BASE = os.path.abspath(os.path.join(local_root_abs, "page.html"))
    REMOTE_BASE = "https://cdn.example.com/docs/page.html"
    
    res_probe_definitions = [
        ("abs_posix", "/etc/passwd", LOCAL_BASE),
        ("file_uri", "file:///etc/passwd", LOCAL_BASE),
        ("fragment", "#section-2", LOCAL_BASE),
        ("local_relative", "images/tiny.png", LOCAL_BASE),
        ("protocol_relative", "//cdn.example.com/img/a.png", REMOTE_BASE),
        ("remote_relative", "img/a.png", REMOTE_BASE),
        ("remote_root_relative", "/img/a.png", REMOTE_BASE),
        ("traversal", "../../../../etc/passwd", LOCAL_BASE),
        ("traversal_sneaky", "images/../../../../etc/passwd", LOCAL_BASE),
        ("windows_drive", r"C:\Windows\System32\config\sam", LOCAL_BASE),
    ]
    
    resolution_probes_report = []
    num_rejected_resolutions = 0
    
    loader_res = ImageResourceLoader()
    for pid, loc, base in sorted(res_probe_definitions, key=lambda x: x[0]):
        try:
            resolved_val = loader_res.resolve_relative_path(loc, base)
            resolution_probes_report.append({
                "id": pid,
                "outcome": "resolved",
                "resolved": resolved_val,
                "error_type": None,
                "error_message": None
            })
        except Exception as e:
            num_rejected_resolutions += 1
            resolution_probes_report.append({
                "id": pid,
                "outcome": "rejected",
                "resolved": None,
                "error_type": type(e).__name__,
                "error_message": str(e)
            })
            
    # 3. Fetch Probes
    tiny_png_path = os.path.abspath(os.path.join(local_root_abs, "images", "tiny.png"))
    svg_path = os.path.abspath(os.path.join(local_root_abs, "images", "diagram.svg"))
    
    # Read tiny.png and encode to base64
    with open(tiny_png_path, "rb") as f:
        tiny_png_bytes = f.read()
    tiny_png_b64 = base64.b64encode(tiny_png_bytes).decode("utf-8")
    
    nul_b64 = base64.b64encode(b"\x00" * 2048).decode("utf-8")
    
    fetch_probe_definitions = [
        ("data_uri_ok", f"data:image/png;base64,{tiny_png_b64}", None, {"max_image_data_base64_bytes": 1024}),
        ("data_uri_too_large", f"data:image/png;base64,{nul_b64}", None, {"max_image_data_base64_bytes": 1024}),
        ("local_disabled", tiny_png_path, LOCAL_BASE, {}),
        ("local_enabled", tiny_png_path, LOCAL_BASE, {"enable_local_fetch": True}),
        ("local_no_base_path", "images/tiny.png", None, {"enable_local_fetch": True}),
        ("remote_disabled", "https://cdn.example.com/img/a.png", None, {}),
        ("svg_skipped", svg_path, LOCAL_BASE, {"enable_local_fetch": True}),
    ]
    
    fetch_probes_report = []
    num_blocked_fetches = 0
    
    for pid, src, base, switches in sorted(fetch_probe_definitions, key=lambda x: x[0]):
        loader_fetch = ImageResourceLoader(**switches)
        try:
            data = loader_fetch.load_image_data(src, base)
            if data is None:
                fetch_probes_report.append({
                    "id": pid,
                    "outcome": "skipped",
                    "num_bytes": None,
                    "error_type": None,
                    "error_message": None
                })
            else:
                fetch_probes_report.append({
                    "id": pid,
                    "outcome": "loaded",
                    "num_bytes": len(data),
                    "error_type": None,
                    "error_message": None
                })
        except Exception as e:
            num_blocked_fetches += 1
            fetch_probes_report.append({
                "id": pid,
                "outcome": "blocked",
                "num_bytes": None,
                "error_type": type(e).__name__,
                "error_message": str(e)
            })
            
    # 4. URL Safety Probes
    url_probe_definitions = [
        ("link_local_metadata", "http://169.254.169.254/latest/meta-data"),
        ("loopback", "http://127.0.0.1/image.png"),
        ("private_a", "http://10.0.0.1/image.png"),
        ("private_c", "http://192.168.1.1/image.png"),
        ("public_literal", "https://93.184.216.34/image.png"),
    ]
    
    url_safety_probes_report = []
    num_rejected_urls = 0
    
    for pid, url in sorted(url_probe_definitions, key=lambda x: x[0]):
        try:
            validate_url_safety(url)
            url_safety_probes_report.append({
                "id": pid,
                "url": url,
                "outcome": "allowed",
                "error_type": None,
                "error_message": None
            })
        except Exception as e:
            num_rejected_urls += 1
            url_safety_probes_report.append({
                "id": pid,
                "url": url,
                "outcome": "rejected",
                "error_type": type(e).__name__,
                "error_message": str(e)
            })
            
    # Summary
    num_documents = len(documents_report)
    num_tables = sum(doc["tables"] for doc in documents_report)
    num_pictures = sum(doc["pictures"] for doc in documents_report)
    
    summary = {
        "num_documents": num_documents,
        "num_tables": num_tables,
        "num_pictures": num_pictures,
        "num_rejected_resolutions": num_rejected_resolutions,
        "num_blocked_fetches": num_blocked_fetches,
        "num_rejected_urls": num_rejected_urls
    }
    
    report = {
        "documents": documents_report,
        "resolution_probes": resolution_probes_report,
        "fetch_probes": fetch_probes_report,
        "url_safety_probes": url_safety_probes_report,
        "summary": summary
    }
    
    # Create parent directories of the report if they do not exist.
    report_dir = os.path.dirname(report_path)
    if report_dir:
        os.makedirs(report_dir, exist_ok=True)
        
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)
        
    sys.exit(0)

if __name__ == "__main__":
    main()
