#!/usr/bin/env python3
"""
HTML Ingestion Audit Tool
Structural Fidelity and Resource-Fetch Policy (Docling)
"""

import os
import sys
import json
import base64
import argparse
import warnings

# Suppress or allow warnings as requested.
# "Warnings printed by the conversion are acceptable; they must not change the exit code."
# We will keep default warning behavior.

from docling.document_converter import DocumentConverter
from docling_core.types.doc.common.content_layer import ContentLayer
from docling.backend.utils.image_resource_loader import ImageResourceLoader, validate_url_safety


def main():
    parser = argparse.ArgumentParser(description="Docling HTML Ingestion Audit Tool")
    parser.add_argument("--html-dir", required=True, help="Directory containing HTML fixtures")
    parser.add_argument("--local-root", required=True, help="Directory containing local resource tree")
    parser.add_argument("--report", required=True, help="Path to write the aggregated JSON report")

    args = parser.parse_args()

    html_dir = args.html_dir
    local_root = args.local_root
    report_path = args.report

    # Validation of directories
    if not os.path.isdir(html_dir):
        sys.stderr.write(f"Error: --html-dir '{html_dir}' does not exist as a directory.\n")
        sys.exit(2)

    if not os.path.isdir(local_root):
        sys.stderr.write(f"Error: --local-root '{local_root}' does not exist as a directory.\n")
        sys.exit(2)

    # Base locations
    LOCAL_BASE = os.path.abspath(os.path.join(local_root, "page.html"))
    REMOTE_BASE = "https://cdn.example.com/docs/page.html"

    # ---------------------------------------------------------
    # 1. Documents (Structural Fidelity)
    # ---------------------------------------------------------
    documents = []
    total_tables = 0
    total_pictures = 0

    # Find and sort HTML files in html_dir (non-recursive)
    html_files = []
    for entry in os.listdir(html_dir):
        full_path = os.path.join(html_dir, entry)
        if os.path.isfile(full_path) and entry.lower().endswith(".html"):
            html_files.append(entry)
    html_files.sort()

    converter = DocumentConverter()

    for name in html_files:
        full_path = os.path.join(html_dir, name)
        res = converter.convert(full_path)
        doc = res.document

        # BODY markdown
        body_markdown = doc.export_to_markdown(included_content_layers={ContentLayer.BODY})
        
        # Derivation of body_lines
        body_lines_raw = body_markdown.split("\n")
        body_lines = [line.rstrip() for line in body_lines_raw]
        body_lines = [line for line in body_lines if line != ""]

        # Derivation of body_blocks
        body_blocks_raw = body_markdown.split("\n\n")
        body_blocks = [block.strip() for block in body_blocks_raw]
        body_blocks = [block for block in body_blocks if block != ""]

        # FULL markdown (BODY + FURNITURE)
        full_markdown = doc.export_to_markdown(included_content_layers={ContentLayer.BODY, ContentLayer.FURNITURE})
        
        # Derivation of full_lines
        full_lines_raw = full_markdown.split("\n")
        full_lines = [line.rstrip() for line in full_lines_raw]
        full_lines = [line for line in full_lines if line != ""]

        # Tables
        tables_list = list(doc.tables)
        num_tables = len(tables_list)
        total_tables += num_tables

        table_shapes = []
        table_cell_texts = []
        for table in tables_list:
            rows = table.data.num_rows
            cols = table.data.num_cols
            table_shapes.append([rows, cols])
            
            cells = [cell.text for cell in table.data.table_cells]
            table_cell_texts.append(cells)

        # Pictures
        num_pictures = len(list(doc.pictures))
        total_pictures += num_pictures

        documents.append({
            "name": name,
            "body_lines": body_lines,
            "body_blocks": body_blocks,
            "full_lines": full_lines,
            "tables": num_tables,
            "table_shapes": table_shapes,
            "table_cell_texts": table_cell_texts,
            "pictures": num_pictures
        })

    # ---------------------------------------------------------
    # 2. Resolution Probes
    # ---------------------------------------------------------
    resolution_probes_config = [
        {"id": "abs_posix", "location": "/etc/passwd", "base": LOCAL_BASE},
        {"id": "file_uri", "location": "file:///etc/passwd", "base": LOCAL_BASE},
        {"id": "fragment", "location": "#section-2", "base": LOCAL_BASE},
        {"id": "local_relative", "location": "images/tiny.png", "base": LOCAL_BASE},
        {"id": "protocol_relative", "location": "//cdn.example.com/img/a.png", "base": REMOTE_BASE},
        {"id": "remote_relative", "location": "img/a.png", "base": REMOTE_BASE},
        {"id": "remote_root_relative", "location": "/img/a.png", "base": REMOTE_BASE},
        {"id": "traversal", "location": "../../../../etc/passwd", "base": LOCAL_BASE},
        {"id": "traversal_sneaky", "location": "images/../../../../etc/passwd", "base": LOCAL_BASE},
        {"id": "windows_drive", "location": "C:\\Windows\\System32\\config\\sam", "base": LOCAL_BASE}
    ]

    resolution_probes = []
    num_rejected_resolutions = 0
    res_loader = ImageResourceLoader()

    # Sort probes by id ascending (they are already sorted, but let's enforce it)
    resolution_probes_config.sort(key=lambda x: x["id"])

    for probe in resolution_probes_config:
        pid = probe["id"]
        loc = probe["location"]
        base = probe["base"]

        try:
            resolved_val = res_loader.resolve_relative_path(loc, base)
            resolution_probes.append({
                "id": pid,
                "outcome": "resolved",
                "resolved": resolved_val,
                "error_type": None,
                "error_message": None
            })
        except Exception as e:
            num_rejected_resolutions += 1
            resolution_probes.append({
                "id": pid,
                "outcome": "rejected",
                "resolved": None,
                "error_type": type(e).__name__,
                "error_message": str(e)
            })

    # ---------------------------------------------------------
    # 3. Fetch Probes
    # ---------------------------------------------------------
    # Dynamically read and encode tiny.png bytes
    tiny_png_path = os.path.join(local_root, "images", "tiny.png")
    with open(tiny_png_path, "rb") as f:
        tiny_bytes = f.read()

    data_uri_ok_src = "data:image/png;base64," + base64.b64encode(tiny_bytes).decode("utf-8")
    data_uri_too_large_src = "data:image/png;base64," + base64.b64encode(b"\x00" * 2048).decode("utf-8")
    tiny_abs_path = os.path.abspath(os.path.join(local_root, "images", "tiny.png"))
    svg_abs_path = os.path.abspath(os.path.join(local_root, "images", "diagram.svg"))

    fetch_probes_config = [
        {
            "id": "data_uri_ok",
            "source": data_uri_ok_src,
            "base": None,
            "switches": {"max_image_data_base64_bytes": 1024}
        },
        {
            "id": "data_uri_too_large",
            "source": data_uri_too_large_src,
            "base": None,
            "switches": {"max_image_data_base64_bytes": 1024}
        },
        {
            "id": "local_disabled",
            "source": tiny_abs_path,
            "base": LOCAL_BASE,
            "switches": {}
        },
        {
            "id": "local_enabled",
            "source": tiny_abs_path,
            "base": LOCAL_BASE,
            "switches": {"enable_local_fetch": True}
        },
        {
            "id": "local_no_base_path",
            "source": "images/tiny.png",
            "base": None,
            "switches": {"enable_local_fetch": True}
        },
        {
            "id": "remote_disabled",
            "source": "https://cdn.example.com/img/a.png",
            "base": None,
            "switches": {}
        },
        {
            "id": "svg_skipped",
            "source": svg_abs_path,
            "base": LOCAL_BASE,
            "switches": {"enable_local_fetch": True}
        }
    ]

    fetch_probes = []
    num_blocked_fetches = 0

    # Sort probes by id ascending
    fetch_probes_config.sort(key=lambda x: x["id"])

    for probe in fetch_probes_config:
        pid = probe["id"]
        src = probe["source"]
        base = probe["base"]
        switches = probe["switches"]

        loader = ImageResourceLoader(**switches)
        try:
            res_bytes = loader.load_image_data(src, base)
            if res_bytes is None:
                fetch_probes.append({
                    "id": pid,
                    "outcome": "skipped",
                    "num_bytes": None,
                    "error_type": None,
                    "error_message": None
                })
            else:
                fetch_probes.append({
                    "id": pid,
                    "outcome": "loaded",
                    "num_bytes": len(res_bytes),
                    "error_type": None,
                    "error_message": None
                })
        except Exception as e:
            num_blocked_fetches += 1
            fetch_probes.append({
                "id": pid,
                "outcome": "blocked",
                "num_bytes": None,
                "error_type": type(e).__name__,
                "error_message": str(e)
            })

    # ---------------------------------------------------------
    # 4. URL Safety Probes
    # ---------------------------------------------------------
    url_safety_probes_config = [
        {"id": "link_local_metadata", "url": "http://169.254.169.254/latest/meta-data"},
        {"id": "loopback", "url": "http://127.0.0.1/image.png"},
        {"id": "private_a", "url": "http://10.0.0.1/image.png"},
        {"id": "private_c", "url": "http://192.168.1.1/image.png"},
        {"id": "public_literal", "url": "https://93.184.216.34/image.png"}
    ]

    url_safety_probes = []
    num_rejected_urls = 0

    # Sort probes by id ascending
    url_safety_probes_config.sort(key=lambda x: x["id"])

    for probe in url_safety_probes_config:
        pid = probe["id"]
        url = probe["url"]

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
            num_rejected_urls += 1
            url_safety_probes.append({
                "id": pid,
                "url": url,
                "outcome": "rejected",
                "error_type": type(e).__name__,
                "error_message": str(e)
            })

    # ---------------------------------------------------------
    # 5. Summary
    # ---------------------------------------------------------
    summary = {
        "num_documents": len(documents),
        "num_tables": total_tables,
        "num_pictures": total_pictures,
        "num_rejected_resolutions": num_rejected_resolutions,
        "num_blocked_fetches": num_blocked_fetches,
        "num_rejected_urls": num_rejected_urls
    }

    # Construct the final JSON report structure
    report_data = {
        "documents": documents,
        "resolution_probes": resolution_probes,
        "fetch_probes": fetch_probes,
        "url_safety_probes": url_safety_probes,
        "summary": summary
    }

    # Ensure parent directories of the report exist
    report_dir = os.path.dirname(os.path.abspath(report_path))
    if report_dir:
        os.makedirs(report_dir, exist_ok=True)

    # Write report
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(report_data, f, indent=2, ensure_ascii=False)
        f.write("\n")


if __name__ == "__main__":
    main()
