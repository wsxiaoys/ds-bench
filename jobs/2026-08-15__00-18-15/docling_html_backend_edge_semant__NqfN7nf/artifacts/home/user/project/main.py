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
    parser.add_argument("--local-root", required=True, help="Local root directory for resource resolution")
    parser.add_argument("--report", required=True, help="Path to save the JSON report")
    
    args = parser.parse_args()
    
    html_dir = args.html_dir
    local_root = args.local_root
    report_path = args.report
    
    if not os.path.isdir(html_dir):
        sys.stderr.write(f"Error: HTML directory '{html_dir}' does not exist or is not a directory.\n")
        sys.exit(2)
        
    if not os.path.isdir(local_root):
        sys.stderr.write(f"Error: Local root directory '{local_root}' does not exist or is not a directory.\n")
        sys.exit(2)
        
    # Define bases
    LOCAL_BASE = os.path.abspath(os.path.join(local_root, "page.html"))
    REMOTE_BASE = "https://cdn.example.com/docs/page.html"
    
    # 1. Documents
    documents = []
    converter = DocumentConverter()
    
    html_files = [f for f in os.listdir(html_dir) if f.endswith(".html")]
    html_files.sort()
    
    for fname in html_files:
        fpath = os.path.join(html_dir, fname)
        res = converter.convert(fpath)
        doc = res.document
        
        md_body = doc.export_to_markdown(included_content_layers={ContentLayer.BODY})
        md_full = doc.export_to_markdown(included_content_layers={ContentLayer.BODY, ContentLayer.FURNITURE})
        
        body_lines = []
        for line in md_body.split("\n"):
            stripped = line.rstrip()
            if stripped:
                body_lines.append(stripped)
                
        body_blocks = []
        for block in md_body.split("\n\n"):
            stripped = block.strip()
            if stripped:
                body_blocks.append(stripped)
                
        full_lines = []
        for line in md_full.split("\n"):
            stripped = line.rstrip()
            if stripped:
                full_lines.append(stripped)
                
        tables = len(doc.tables)
        table_shapes = []
        table_cell_texts = []
        for t in doc.tables:
            table_shapes.append([t.data.num_rows, t.data.num_cols])
            cell_texts = [cell.text for cell in t.data.table_cells]
            table_cell_texts.append(cell_texts)
            
        pictures = len(doc.pictures)
        
        documents.append({
            "name": fname,
            "body_lines": body_lines,
            "body_blocks": body_blocks,
            "full_lines": full_lines,
            "tables": tables,
            "table_shapes": table_shapes,
            "table_cell_texts": table_cell_texts,
            "pictures": pictures
        })
        
    # 2. Resolution Probes
    resolution_probes = []
    resolution_specs = [
        ("abs_posix", "/etc/passwd", LOCAL_BASE),
        ("file_uri", "file:///etc/passwd", LOCAL_BASE),
        ("fragment", "#section-2", LOCAL_BASE),
        ("local_relative", "images/tiny.png", LOCAL_BASE),
        ("protocol_relative", "//cdn.example.com/img/a.png", REMOTE_BASE),
        ("remote_relative", "img/a.png", REMOTE_BASE),
        ("remote_root_relative", "/img/a.png", REMOTE_BASE),
        ("traversal", "../../../../etc/passwd", LOCAL_BASE),
        ("traversal_sneaky", "images/../../../../etc/passwd", LOCAL_BASE),
        ("windows_drive", "C:\\Windows\\System32\\config\\sam", LOCAL_BASE)
    ]
    
    loader_res = ImageResourceLoader()
    for pid, loc, base in resolution_specs:
        try:
            res = loader_res.resolve_relative_path(loc, base)
            resolution_probes.append({
                "id": pid,
                "outcome": "resolved",
                "resolved": res,
                "error_type": None,
                "error_message": None
            })
        except Exception as e:
            resolution_probes.append({
                "id": pid,
                "outcome": "rejected",
                "resolved": None,
                "error_type": type(e).__name__,
                "error_message": str(e)
            })
            
    # 3. Fetch Probes
    fetch_probes = []
    tiny_png_path = os.path.abspath(os.path.join(local_root, "images", "tiny.png"))
    with open(tiny_png_path, "rb") as f:
        tiny_png_bytes = f.read()
    tiny_png_b64 = base64.b64encode(tiny_png_bytes).decode("utf-8")
    data_uri_ok_src = f"data:image/png;base64,{tiny_png_b64}"
    
    nul_bytes = b"\x00" * 2048
    nul_b64 = base64.b64encode(nul_bytes).decode("utf-8")
    data_uri_too_large_src = f"data:image/png;base64,{nul_b64}"
    
    diagram_svg_path = os.path.abspath(os.path.join(local_root, "images", "diagram.svg"))
    
    fetch_specs = [
        ("data_uri_ok", data_uri_ok_src, None, {"max_image_data_base64_bytes": 1024}),
        ("data_uri_too_large", data_uri_too_large_src, None, {"max_image_data_base64_bytes": 1024}),
        ("local_disabled", tiny_png_path, LOCAL_BASE, {}),
        ("local_enabled", tiny_png_path, LOCAL_BASE, {"enable_local_fetch": True}),
        ("local_no_base_path", "images/tiny.png", None, {"enable_local_fetch": True}),
        ("remote_disabled", "https://cdn.example.com/img/a.png", None, {}),
        ("svg_skipped", diagram_svg_path, LOCAL_BASE, {"enable_local_fetch": True})
    ]
    
    for pid, src, base, switches in fetch_specs:
        loader_fetch = ImageResourceLoader(**switches)
        try:
            res = loader_fetch.load_image_data(src, base)
            if res is not None:
                fetch_probes.append({
                    "id": pid,
                    "outcome": "loaded",
                    "num_bytes": len(res),
                    "error_type": None,
                    "error_message": None
                })
            else:
                fetch_probes.append({
                    "id": pid,
                    "outcome": "skipped",
                    "num_bytes": None,
                    "error_type": None,
                    "error_message": None
                })
        except Exception as e:
            fetch_probes.append({
                "id": pid,
                "outcome": "blocked",
                "num_bytes": None,
                "error_type": type(e).__name__,
                "error_message": str(e)
            })
            
    # 4. URL Safety Probes
    url_safety_probes = []
    safety_specs = [
        ("link_local_metadata", "http://169.254.169.254/latest/meta-data"),
        ("loopback", "http://127.0.0.1/image.png"),
        ("private_a", "http://10.0.0.1/image.png"),
        ("private_c", "http://192.168.1.1/image.png"),
        ("public_literal", "https://93.184.216.34/image.png")
    ]
    
    for pid, url in safety_specs:
        try:
            validate_url_safety(url)
            url_safety_probes.append({
                "id": pid,
                "url": url,
                "outcome": "allowed",
                "error_type": None,
                "error_message": None
            })
        except Exception as e:
            url_safety_probes.append({
                "id": pid,
                "url": url,
                "outcome": "rejected",
                "error_type": type(e).__name__,
                "error_message": str(e)
            })
            
    # 5. Summary
    summary = {
        "num_documents": len(documents),
        "num_tables": sum(d["tables"] for d in documents),
        "num_pictures": sum(d["pictures"] for d in documents),
        "num_rejected_resolutions": sum(1 for p in resolution_probes if p["outcome"] == "rejected"),
        "num_blocked_fetches": sum(1 for p in fetch_probes if p["outcome"] == "blocked"),
        "num_rejected_urls": sum(1 for p in url_safety_probes if p["outcome"] == "rejected")
    }
    
    report = {
        "documents": documents,
        "resolution_probes": resolution_probes,
        "fetch_probes": fetch_probes,
        "url_safety_probes": url_safety_probes,
        "summary": summary
    }
    
    report_dir = os.path.dirname(report_path)
    if report_dir:
        os.makedirs(report_dir, exist_ok=True)
        
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)
        f.write("\n")
        
    sys.exit(0)

if __name__ == "__main__":
    main()
