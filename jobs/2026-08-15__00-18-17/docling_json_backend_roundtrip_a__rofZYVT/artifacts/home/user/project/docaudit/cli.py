import argparse
import hashlib
import io
import json
import os
import sys
import tempfile
from pathlib import Path

import pydantic
from docling_core.types.doc import DoclingDocument

def get_major_version(v_str: str) -> str:
    if "." in v_str:
        return v_str.split(".", 1)[0]
    return v_str

def serialize_canonical_json(data: dict) -> str:
    serialized = json.dumps(data, indent=2, sort_keys=True, ensure_ascii=False)
    return serialized.rstrip("\r\n") + "\n"

def main():
    parser = argparse.ArgumentParser(description="Docling JSON Round-Trip Audit CLI")
    parser.add_argument("--input-dir", required=True, help="Input directory containing candidate JSON files")
    parser.add_argument("--out-dir", required=True, help="Output directory to emit report and artifacts")
    
    args = parser.parse_args()
    
    input_path = Path(args.input_dir)
    out_path = Path(args.out_dir)
    
    # Check if input directory exists and is a directory
    if not input_path.is_dir():
        sys.exit(5)
        
    # Gather candidates (files ending with .json directly inside input_dir)
    candidate_files = []
    try:
        for f in os.listdir(input_path):
            full_p = input_path / f
            if f.endswith(".json") and full_p.is_file():
                candidate_files.append(f)
    except Exception:
        sys.exit(5)
        
    if not candidate_files:
        sys.exit(5)
        
    # Sort candidates by filename in ascending Unicode code-point order
    candidate_files.sort()
    
    # Get installed Docling document schema version
    installed_version = DoclingDocument.model_fields['version'].default
    if not isinstance(installed_version, str):
        installed_version = DoclingDocument(name="dummy").version
    installed_major = get_major_version(installed_version)
    
    # Create output directories
    out_path.mkdir(parents=True, exist_ok=True)
    normalized_dir = out_path / "normalized"
    markdown_dir = out_path / "markdown"
    
    total = len(candidate_files)
    ok_count = 0
    recovered_count = 0
    
    status_counts = {
        "ok": 0,
        "malformed_json": 0,
        "not_an_object": 0,
        "version_mismatch": 0,
        "schema_invalid": 0,
        "unreadable": 0
    }
    
    document_entries = []
    any_parity_or_roundtrip_failed = False
    
    for filename in candidate_files:
        filepath = input_path / filename
        
        # Read file bytes
        try:
            bytes_data = filepath.read_bytes()
        except Exception as e:
            status_counts["unreadable"] += 1
            document_entries.append({
                "file": filename,
                "status": "unreadable",
                "sha256": "",
                "size_bytes": 0,
                "declared_version": None,
                "document_version": None,
                "name": None,
                "counts": None,
                "stream_parity": False,
                "roundtrip_stable": False,
                "recovered": False,
                "normalized_path": None,
                "markdown_path": None,
                "error": f"Failed to read file bytes: {e}"
            })
            continue
            
        size_bytes = len(bytes_data)
        sha256_val = hashlib.sha256(bytes_data).hexdigest()
        
        # Try decoding and parsing as JSON
        try:
            content_str = bytes_data.decode("utf-8")
            js_obj = json.loads(content_str)
        except UnicodeDecodeError as ude:
            status_counts["malformed_json"] += 1
            document_entries.append({
                "file": filename,
                "status": "malformed_json",
                "sha256": sha256_val,
                "size_bytes": size_bytes,
                "declared_version": None,
                "document_version": None,
                "name": None,
                "counts": None,
                "stream_parity": False,
                "roundtrip_stable": False,
                "recovered": False,
                "normalized_path": None,
                "markdown_path": None,
                "error": f"UTF-8 decode error: {ude}"
            })
            continue
        except json.JSONDecodeError as jde:
            status_counts["malformed_json"] += 1
            document_entries.append({
                "file": filename,
                "status": "malformed_json",
                "sha256": sha256_val,
                "size_bytes": size_bytes,
                "declared_version": None,
                "document_version": None,
                "name": None,
                "counts": None,
                "stream_parity": False,
                "roundtrip_stable": False,
                "recovered": False,
                "normalized_path": None,
                "markdown_path": None,
                "error": f"JSON parse error: {jde}"
            })
            continue
            
        # Check if top-level value is a JSON object
        if not isinstance(js_obj, dict):
            status_counts["not_an_object"] += 1
            document_entries.append({
                "file": filename,
                "status": "not_an_object",
                "sha256": sha256_val,
                "size_bytes": size_bytes,
                "declared_version": None,
                "document_version": None,
                "name": None,
                "counts": None,
                "stream_parity": False,
                "roundtrip_stable": False,
                "recovered": False,
                "normalized_path": None,
                "markdown_path": None,
                "error": f"Top-level JSON value is not an object (type: {type(js_obj).__name__})"
            })
            continue
            
        # Extract declared version
        declared_version = None
        v_val = js_obj.get("version")
        if isinstance(v_val, str):
            declared_version = v_val
            
        # Try to ingest
        status = None
        recovered = False
        doc = None
        error_msg = None
        
        try:
            doc = DoclingDocument.model_validate(js_obj)
            status = "ok"
            ok_count += 1
        except pydantic.ValidationError as ve:
            # Check for version mismatch
            if declared_version is not None and get_major_version(declared_version) != installed_major:
                status = "version_mismatch"
                # Try recovery
                modified_js = dict(js_obj)
                modified_js["version"] = installed_version
                try:
                    doc = DoclingDocument.model_validate(modified_js)
                    recovered = True
                    recovered_count += 1
                    error_msg = f"Version mismatch: declared version '{declared_version}' is incompatible with SDK version '{installed_version}'. Replaced version and recovered successfully."
                except Exception as retry_err:
                    recovered = False
                    doc = None
                    error_msg = f"Version mismatch: declared version '{declared_version}' is incompatible with SDK version '{installed_version}'. Recovery failed: {retry_err}"
            else:
                status = "schema_invalid"
                recovered = False
                doc = None
                error_msg = str(ve)
        except Exception as ex:
            status = "unreadable"
            recovered = False
            doc = None
            error_msg = f"Ingestion error: {ex}"
            
        status_counts[status] += 1
        
        # If successfully ingested
        if doc is not None:
            counts = {
                "texts": len(doc.texts) if doc.texts is not None else 0,
                "tables": len(doc.tables) if doc.tables is not None else 0,
                "pictures": len(doc.pictures) if doc.pictures is not None else 0,
                "groups": len(doc.groups) if doc.groups is not None else 0,
                "pages": len(doc.pages) if doc.pages is not None else 0,
            }
            document_version = doc.version
            doc_name = doc.name
            
            # Prepare bytes for stream parity
            if recovered:
                modified_js = dict(js_obj)
                modified_js["version"] = installed_version
                ingested_bytes = json.dumps(modified_js).encode("utf-8")
            else:
                ingested_bytes = bytes_data
                
            # Perform path-based ingestion
            with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as tf:
                tf.write(ingested_bytes)
                temp_path = tf.name
            try:
                doc_path = DoclingDocument.load_from_json(temp_path)
            finally:
                try:
                    os.unlink(temp_path)
                except Exception:
                    pass
                    
            # Perform stream-based ingestion
            stream = io.BytesIO(ingested_bytes)
            doc_stream = DoclingDocument.model_validate_json(stream.read())
            
            stream_parity = (doc_path.export_to_dict() == doc_stream.export_to_dict())
            if not stream_parity:
                any_parity_or_roundtrip_failed = True
                
            # Emit artifacts
            stem = Path(filename).stem
            normalized_dir.mkdir(parents=True, exist_ok=True)
            markdown_dir.mkdir(parents=True, exist_ok=True)
            
            normalized_file = normalized_dir / f"{stem}.json"
            markdown_file = markdown_dir / f"{stem}.md"
            
            # Normalized JSON
            canonical_json = serialize_canonical_json(doc.export_to_dict())
            normalized_file.write_text(canonical_json, encoding="utf-8")
            
            # Markdown
            try:
                md_content = doc.export_to_markdown()
            except Exception as md_err:
                md_content = f"Error exporting to markdown: {md_err}"
            md_content_cleaned = md_content.rstrip("\r\n") + "\n"
            markdown_file.write_text(md_content_cleaned, encoding="utf-8")
            
            # Round-trip stability check
            doc_roundtrip = DoclingDocument.load_from_json(normalized_file)
            roundtrip_stable = (doc_roundtrip.export_to_dict() == doc.export_to_dict())
            if not roundtrip_stable:
                any_parity_or_roundtrip_failed = True
                
            normalized_path = f"normalized/{stem}.json"
            markdown_path = f"markdown/{stem}.md"
        else:
            document_version = None
            doc_name = None
            counts = None
            stream_parity = False
            roundtrip_stable = False
            normalized_path = None
            markdown_path = None
            
        document_entries.append({
            "file": filename,
            "status": status,
            "sha256": sha256_val,
            "size_bytes": size_bytes,
            "declared_version": declared_version,
            "document_version": document_version,
            "name": doc_name,
            "counts": counts,
            "stream_parity": stream_parity,
            "roundtrip_stable": roundtrip_stable,
            "recovered": recovered,
            "normalized_path": normalized_path,
            "markdown_path": markdown_path,
            "error": error_msg
        })
        
    # Write report
    failed_count = total - ok_count
    report = {
        "schema_version": installed_version,
        "input_dir": args.input_dir,
        "total": total,
        "ok": ok_count,
        "recovered": recovered_count,
        "failed": failed_count,
        "status_counts": status_counts,
        "documents": document_entries
    }
    
    report_file = out_path / "audit_report.json"
    report_file.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    
    # Print the last non-empty line on stdout
    print(f"AUDIT total={total} ok={ok_count} recovered={recovered_count} failed={failed_count}")
    
    # Determine exit code
    if any_parity_or_roundtrip_failed:
        sys.exit(4)
    elif failed_count > 0:
        sys.exit(3)
    else:
        sys.exit(0)

if __name__ == "__main__":
    main()
