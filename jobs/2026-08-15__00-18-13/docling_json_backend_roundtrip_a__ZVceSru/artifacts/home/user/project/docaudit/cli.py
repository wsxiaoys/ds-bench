import os
import sys
import json
import hashlib
import io
import tempfile
import argparse
import copy
from pathlib import Path
from pydantic import ValidationError
from docling_core.types.doc import DoclingDocument

def compute_sha256(file_path: Path) -> str:
    h = hashlib.sha256()
    with open(file_path, 'rb') as f:
        for chunk in iter(lambda: f.read(65536), b''):
            h.update(chunk)
    return h.hexdigest().lower()

def main():
    parser = argparse.ArgumentParser(description="Docling JSON Round-Trip Audit CLI")
    parser.add_argument("--input-dir", required=True, help="Input directory containing candidate JSON files")
    parser.add_argument("--out-dir", required=True, help="Output directory for reports and artifacts")
    
    args = parser.parse_args()
    
    input_dir = Path(args.input_dir)
    # Check if --input-dir exists and is a directory
    if not input_dir.exists() or not input_dir.is_dir():
        sys.exit(5)
        
    # Find candidates directly in the directory
    candidates = sorted([f for f in input_dir.iterdir() if f.is_file() and f.name.endswith('.json')])
    if not candidates:
        sys.exit(5)
        
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    
    # Create subdirectories for artifacts
    normalized_dir = out_dir / "normalized"
    markdown_dir = out_dir / "markdown"
    normalized_dir.mkdir(parents=True, exist_ok=True)
    markdown_dir.mkdir(parents=True, exist_ok=True)
    
    installed_version = DoclingDocument(name="temp").version
    installed_major = installed_version.split('.')[0]
    
    status_counts = {
        "ok": 0,
        "malformed_json": 0,
        "not_an_object": 0,
        "version_mismatch": 0,
        "schema_invalid": 0,
        "unreadable": 0
    }
    
    documents_report = []
    
    for fpath in candidates:
        stem = fpath.stem
        raw_bytes = fpath.read_bytes()
        sha256 = hashlib.sha256(raw_bytes).hexdigest().lower()
        size_bytes = len(raw_bytes)
        
        # Default report values for candidate
        status = None
        declared_version = None
        document_version = None
        name = None
        counts = None
        stream_parity = False
        roundtrip_stable = False
        recovered = False
        normalized_path = None
        markdown_path = None
        error = None
        
        # 1. Parse JSON & check malformed_json
        try:
            text = raw_bytes.decode('utf-8')
            parsed = json.loads(text)
            is_json = True
        except (UnicodeDecodeError, json.JSONDecodeError) as e:
            is_json = False
            status = "malformed_json"
            error = str(e)
            
        if is_json:
            # 2. Check not_an_object
            if not isinstance(parsed, dict):
                status = "not_an_object"
                error = "Top-level value is not a JSON object"
            else:
                # Find declared version
                declared_version = parsed.get("version")
                if not isinstance(declared_version, str):
                    declared_version = None
                
                # 3. Attempt ingestion
                doc_path = None
                try:
                    doc_path = DoclingDocument.model_validate(parsed)
                    status = "ok"
                except ValidationError as e:
                    # Check if version mismatch
                    is_version_mismatch = False
                    if declared_version is not None:
                        declared_major = declared_version.split('.')[0]
                        if declared_major != installed_major:
                            is_version_mismatch = True
                            
                    if is_version_mismatch:
                        status = "version_mismatch"
                        # Try recovery
                        recovered_parsed = copy.deepcopy(parsed)
                        recovered_parsed["version"] = installed_version
                        
                        # Ingest recovered JSON from a temporary file path
                        with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as tmp:
                            tmp.write(json.dumps(recovered_parsed).encode('utf-8'))
                            tmp_path = tmp.name
                        try:
                            doc_path = DoclingDocument.load_from_json(tmp_path)
                            recovered = True
                            error = str(e) # Original validation error
                        except Exception as retry_err:
                            doc_path = None
                            recovered = False
                            error = f"Recovery failed: {retry_err}. Original error: {e}"
                        finally:
                            if os.path.exists(tmp_path):
                                os.unlink(tmp_path)
                    else:
                        status = "schema_invalid"
                        error = str(e)
                except Exception as e:
                    status = "unreadable"
                    error = str(e)
                    
                # If successfully ingested (either directly or after recovery)
                if doc_path is not None:
                    # Record document details
                    document_version = doc_path.version
                    name = doc_path.name
                    
                    # Compute stream parity
                    if recovered:
                        ingested_bytes = json.dumps(recovered_parsed).encode('utf-8')
                    else:
                        ingested_bytes = raw_bytes
                        
                    stream = io.BytesIO(ingested_bytes)
                    stream_bytes = stream.read()
                    try:
                        doc_stream = DoclingDocument.model_validate_json(stream_bytes)
                        stream_parity = (doc_path.export_to_dict() == doc_stream.export_to_dict())
                    except Exception:
                        stream_parity = False
                        
                    # Emit normalized JSON artifact
                    try:
                        exported_dict = doc_path.export_to_dict()
                        json_str = json.dumps(exported_dict, indent=2, sort_keys=True, ensure_ascii=False)
                        json_str = json_str.rstrip('\r\n') + '\n'
                        
                        norm_file_path = normalized_dir / f"{stem}.json"
                        with open(norm_file_path, "w", encoding="utf-8") as f:
                            f.write(json_str)
                        normalized_path = f"normalized/{stem}.json"
                        
                        # Re-ingest to check roundtrip stability
                        doc_roundtrip = DoclingDocument.load_from_json(norm_file_path)
                        roundtrip_stable = (doc_path.export_to_dict() == doc_roundtrip.export_to_dict())
                    except Exception as artifact_err:
                        roundtrip_stable = False
                        # If there's an error emitting/re-ingesting, we could append it to error
                        if error is None:
                            error = f"Artifact emission error: {artifact_err}"
                        else:
                            error = f"{error}. Artifact emission error: {artifact_err}"
                            
                    # Emit Markdown artifact
                    try:
                        markdown_str = doc_path.export_to_markdown()
                        markdown_str = markdown_str.rstrip('\r\n') + '\n'
                        
                        md_file_path = markdown_dir / f"{stem}.md"
                        with open(md_file_path, "w", encoding="utf-8") as f:
                            f.write(markdown_str)
                        markdown_path = f"markdown/{stem}.md"
                    except Exception as md_err:
                        if error is None:
                            error = f"Markdown emission error: {md_err}"
                        else:
                            error = f"{error}. Markdown emission error: {md_err}"
                            
                    # Record counts
                    counts = {
                        "texts": len(doc_path.texts),
                        "tables": len(doc_path.tables),
                        "pictures": len(doc_path.pictures),
                        "groups": len(doc_path.groups),
                        "pages": len(doc_path.pages)
                    }
                    
        # Update status counts
        status_counts[status] += 1
        
        # Append to documents report
        documents_report.append({
            "file": fpath.name,
            "status": status,
            "sha256": sha256,
            "size_bytes": size_bytes,
            "declared_version": declared_version,
            "document_version": document_version,
            "name": name,
            "counts": counts,
            "stream_parity": stream_parity,
            "roundtrip_stable": roundtrip_stable,
            "recovered": recovered,
            "normalized_path": normalized_path,
            "markdown_path": markdown_path,
            "error": error
        })
        
    # Sort documents by file in ascending Unicode code-point order
    documents_report.sort(key=lambda x: x["file"])
    
    # Calculate report totals
    total = len(candidates)
    ok_count = status_counts["ok"]
    recovered_count = sum(1 for d in documents_report if d["recovered"])
    failed_count = total - ok_count
    
    report = {
        "schema_version": installed_version,
        "input_dir": args.input_dir,
        "total": total,
        "ok": ok_count,
        "recovered": recovered_count,
        "failed": failed_count,
        "status_counts": status_counts,
        "documents": documents_report
    }
    
    # Write report
    report_path = out_dir / "audit_report.json"
    report_json_str = json.dumps(report, indent=2, ensure_ascii=False)
    report_json_str = report_json_str.rstrip('\r\n') + '\n'
    with open(report_path, "w", encoding="utf-8") as f:
        f.write(report_json_str)
        
    # Print the last non-empty line of stdout
    print(f"AUDIT total={total} ok={ok_count} recovered={recovered_count} failed={failed_count}")
    
    # Determine exit code
    # 4 when at least one ingested candidate has stream_parity or roundtrip_stable false.
    # 3 when neither of the above applies and failed is greater than zero.
    # 0 otherwise.
    ingested_candidates = [d for d in documents_report if d["status"] == "ok" or d["recovered"]]
    any_parity_or_stability_failed = any(not d["stream_parity"] or not d["roundtrip_stable"] for d in ingested_candidates)
    
    if any_parity_or_stability_failed:
        sys.exit(4)
    elif failed_count > 0:
        sys.exit(3)
    else:
        sys.exit(0)

if __name__ == "__main__":
    main()
