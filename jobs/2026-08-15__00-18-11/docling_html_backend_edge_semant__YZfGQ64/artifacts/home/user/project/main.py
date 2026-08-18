import os
import sys
import json
import base64
import argparse
from docling.document_converter import DocumentConverter
from docling_core.types.doc import ContentLayer, TableItem, PictureItem
from docling.backend.utils.image_resource_loader import ImageResourceLoader, validate_url_safety

def process_lines(markdown_str):
    lines = markdown_str.split("\n")
    processed = []
    for line in lines:
        rstripped = line.rstrip()
        if rstripped:
            processed.append(rstripped)
    return processed

def process_blocks(markdown_str):
    blocks = markdown_str.split("\n\n")
    processed = []
    for block in blocks:
        stripped = block.strip()
        if stripped:
            processed.append(stripped)
    return processed

def run_resolution_probe(pid, location, base_location):
    loader = ImageResourceLoader()
    try:
        resolved = loader.resolve_relative_path(location, base_location)
        return {
            "id": pid,
            "outcome": "resolved",
            "resolved": resolved,
            "error_type": None,
            "error_message": None
        }
    except Exception as e:
        return {
            "id": pid,
            "outcome": "rejected",
            "resolved": None,
            "error_type": type(e).__name__,
            "error_message": str(e)
        }

def run_fetch_probe(pid, source, base_location, switches):
    loader = ImageResourceLoader(**switches)
    try:
        res = loader.load_image_data(source, base_location)
        if res is None:
            return {
                "id": pid,
                "outcome": "skipped",
                "num_bytes": None,
                "error_type": None,
                "error_message": None
            }
        else:
            return {
                "id": pid,
                "outcome": "loaded",
                "num_bytes": len(res),
                "error_type": None,
                "error_message": None
            }
    except Exception as e:
        return {
            "id": pid,
            "outcome": "blocked",
            "num_bytes": None,
            "error_type": type(e).__name__,
            "error_message": str(e)
        }

def run_url_safety_probe(pid, url):
    try:
        validate_url_safety(url)
        return {
            "id": pid,
            "url": url,
            "outcome": "allowed",
            "error_type": None,
            "error_message": None
        }
    except Exception as e:
        return {
            "id": pid,
            "url": url,
            "outcome": "rejected",
            "error_type": type(e).__name__,
            "error_message": str(e)
        }

def main():
    parser = argparse.ArgumentParser(description="HTML Ingestion Audit Tool")
    parser.add_argument("--html-dir", required=True, help="Directory containing HTML fixtures")
    parser.add_argument("--local-root", required=True, help="Directory containing local resource tree")
    parser.add_argument("--report", required=True, help="Path to write the JSON report")

    args = parser.parse_args()

    # Verify input directories exist
    if not os.path.isdir(args.html_dir):
        sys.stderr.write(f"Error: html-dir '{args.html_dir}' is not a directory.\n")
        sys.exit(2)

    if not os.path.isdir(args.local_root):
        sys.stderr.write(f"Error: local-root '{args.local_root}' is not a directory.\n")
        sys.exit(2)

    # Convert HTML documents
    converter = DocumentConverter()
    html_files = sorted([f for f in os.listdir(args.html_dir) if f.endswith(".html")])

    documents_report = []
    total_tables = 0
    total_pictures = 0

    for filename in html_files:
        file_path = os.path.join(args.html_dir, filename)
        res = converter.convert(file_path)
        doc = res.document

        # Generate markdown views
        body_md = doc.export_to_markdown(included_content_layers={ContentLayer.BODY})
        full_md = doc.export_to_markdown(included_content_layers={ContentLayer.BODY, ContentLayer.FURNITURE})

        body_lines = process_lines(body_md)
        body_blocks = process_blocks(body_md)
        full_lines = process_lines(full_md)

        # Count tables and pictures across ALL content layers
        tables = []
        pictures = []
        for item, lvl in doc.iterate_items(included_content_layers=set(ContentLayer)):
            if isinstance(item, TableItem):
                tables.append(item)
            elif isinstance(item, PictureItem):
                pictures.append(item)

        num_tables = len(tables)
        num_pictures = len(pictures)
        total_tables += num_tables
        total_pictures += num_pictures

        table_shapes = []
        table_cell_texts = []
        for table in tables:
            table_shapes.append([table.data.num_rows, table.data.num_cols])
            cell_texts = [cell.text for cell in table.data.table_cells]
            table_cell_texts.append(cell_texts)

        doc_entry = {
            "name": filename,
            "body_lines": body_lines,
            "body_blocks": body_blocks,
            "full_lines": full_lines,
            "tables": num_tables,
            "table_shapes": table_shapes,
            "table_cell_texts": table_cell_texts,
            "pictures": num_pictures
        }
        documents_report.append(doc_entry)

    # Prepare resolution probes
    LOCAL_BASE = os.path.abspath(os.path.join(args.local_root, "page.html"))
    REMOTE_BASE = "https://cdn.example.com/docs/page.html"

    resolution_probe_specs = [
        ("abs_posix", "/etc/passwd", LOCAL_BASE),
        ("file_uri", "file:///etc/passwd", LOCAL_BASE),
        ("fragment", "#section-2", LOCAL_BASE),
        ("local_relative", "images/tiny.png", LOCAL_BASE),
        ("protocol_relative", "//cdn.example.com/img/a.png", REMOTE_BASE),
        ("remote_relative", "img/a.png", REMOTE_BASE),
        ("remote_root_relative", "/img/a.png", REMOTE_BASE),
        ("traversal", "../../../../etc/passwd", LOCAL_BASE),
        ("traversal_sneaky", "images/../../../../etc/passwd", LOCAL_BASE),
        ("windows_drive", r"C:\Windows\System32\config\sam", LOCAL_BASE)
    ]

    resolution_probes_report = []
    num_rejected_resolutions = 0
    # Sort specs by id ascending
    resolution_probe_specs.sort(key=lambda x: x[0])
    for pid, loc, base in resolution_probe_specs:
        probe_res = run_resolution_probe(pid, loc, base)
        resolution_probes_report.append(probe_res)
        if probe_res["outcome"] == "rejected":
            num_rejected_resolutions += 1

    # Prepare fetch probes
    tiny_png_path = os.path.join(args.local_root, "images", "tiny.png")
    diagram_svg_path = os.path.join(args.local_root, "images", "diagram.svg")

    with open(tiny_png_path, "rb") as f:
        tiny_bytes = f.read()
    tiny_b64 = base64.b64encode(tiny_bytes).decode("utf-8")
    data_uri_ok_src = f"data:image/png;base64,{tiny_b64}"

    nul_bytes = b"\x00" * 2048
    nul_b64 = base64.b64encode(nul_bytes).decode("utf-8")
    data_uri_too_large_src = f"data:image/png;base64,{nul_b64}"

    tiny_abs_path = os.path.abspath(tiny_png_path)
    diagram_abs_path = os.path.abspath(diagram_svg_path)

    fetch_probe_specs = [
        ("data_uri_ok", data_uri_ok_src, None, {"max_image_data_base64_bytes": 1024}),
        ("data_uri_too_large", data_uri_too_large_src, None, {"max_image_data_base64_bytes": 1024}),
        ("local_disabled", tiny_abs_path, LOCAL_BASE, {}),
        ("local_enabled", tiny_abs_path, LOCAL_BASE, {"enable_local_fetch": True}),
        ("local_no_base_path", "images/tiny.png", None, {"enable_local_fetch": True}),
        ("remote_disabled", "https://cdn.example.com/img/a.png", None, {}),
        ("svg_skipped", diagram_abs_path, LOCAL_BASE, {"enable_local_fetch": True})
    ]

    fetch_probes_report = []
    num_blocked_fetches = 0
    fetch_probe_specs.sort(key=lambda x: x[0])
    for pid, src, base, switches in fetch_probe_specs:
        probe_res = run_fetch_probe(pid, src, base, switches)
        fetch_probes_report.append(probe_res)
        if probe_res["outcome"] == "blocked":
            num_blocked_fetches += 1

    # Prepare URL safety probes
    url_safety_probe_specs = [
        ("link_local_metadata", "http://169.254.169.254/latest/meta-data"),
        ("loopback", "http://127.0.0.1/image.png"),
        ("private_a", "http://10.0.0.1/image.png"),
        ("private_c", "http://192.168.1.1/image.png"),
        ("public_literal", "https://93.184.216.34/image.png")
    ]

    url_safety_probes_report = []
    num_rejected_urls = 0
    url_safety_probe_specs.sort(key=lambda x: x[0])
    for pid, url in url_safety_probe_specs:
        probe_res = run_url_safety_probe(pid, url)
        url_safety_probes_report.append(probe_res)
        if probe_res["outcome"] == "rejected":
            num_rejected_urls += 1

    # Prepare summary
    summary = {
        "num_documents": len(documents_report),
        "num_tables": total_tables,
        "num_pictures": total_pictures,
        "num_rejected_resolutions": num_rejected_resolutions,
        "num_blocked_fetches": num_blocked_fetches,
        "num_rejected_urls": num_rejected_urls
    }

    # Put everything together
    report_data = {
        "documents": documents_report,
        "resolution_probes": resolution_probes_report,
        "fetch_probes": fetch_probes_report,
        "url_safety_probes": url_safety_probes_report,
        "summary": summary
    }

    # Ensure parent directories of the report exist
    report_dir = os.path.dirname(args.report)
    if report_dir:
        os.makedirs(report_dir, exist_ok=True)

    # Write report
    with open(args.report, "w", encoding="utf-8") as f:
        json.dump(report_data, f, indent=2, ensure_ascii=False)

if __name__ == "__main__":
    main()
