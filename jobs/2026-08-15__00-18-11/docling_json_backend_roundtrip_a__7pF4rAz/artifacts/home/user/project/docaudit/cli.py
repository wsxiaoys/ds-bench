import argparse
import sys
import os
import json
import hashlib
import tempfile
from pydantic import ValidationError
from docling_core.types.doc import DoclingDocument

def main():
    parser = argparse.ArgumentParser(description="Docling JSON Round-Trip Audit CLI")
    parser.add_argument("--input-dir", required=True, help="Input directory containing candidate JSON files")
    parser.add_argument("--out-dir", required=True, help="Output directory for reports and artifacts")
    
    try:
        args = parser.parse_args()
    except SystemExit:
        sys.exit(2)
        
    input_dir = args.input_dir
    out_dir = args.out_dir
    
    # Check if input directory exists and is a directory
    if not os.path.exists(input_dir) or not os.path.isdir(input_dir):
        sys.exit(5)
        
    # Find candidates: files whose name ends with .json located directly inside input_dir
    try:
        candidates = [
            f for f in os.listdir(input_dir)
            if f.endswith('.json') and os.path.isfile(os.path.join(input_dir, f))
        ]
    except Exception:
        sys.exit(5)
        
    if not candidates:
        sys.exit(5)
        
    candidates = sorted(candidates)
    
    # Create out-dir and parents if they don't exist
    os.makedirs(out_dir, exist_ok=True)
    os.makedirs(os.path.join(out_dir, "normalized"), exist_ok=True)
    os.makedirs(os.path.join(out_dir, "markdown"), exist_ok=True)
    
    # Get schema version of the installed Docling document model
    try:
        installed_version = DoclingDocument.model_fields['version'].default
        if not isinstance(installed_version, str):
            installed_version = DoclingDocument(name="temp").version
    except Exception:
        installed_version = "1.10.0"
        
    installed_major = installed_version.split('.')[0]
    
    total = len(candidates)
    ok_count = 0
    recovered_count = 0
    
    status_counts = {
        "ok": 0,
        "malformed_json": 0,
        "not_an_object": 0,
        "version_mismatch": 0,
        "schema_invalid": 0,
        "unreadable": 0,
    }
    
    documents_list = []
    
    for file_name in candidates:
        file_path = os.path.join(input_dir, file_name)
        stem = file_name[:-5]  # Remove '.json' suffix
        
        # Read candidate bytes
        try:
            with open(file_path, 'rb') as f:
                bytes_content = f.read()
        except Exception as e:
            # If we cannot read the file, classify as unreadable
            documents_list.append({
                "file": file_name,
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
                "error": str(e)
            })
            status_counts["unreadable"] += 1
            continue
            
        size_bytes = len(bytes_content)
        sha256 = hashlib.sha256(bytes_content).hexdigest()
        
        # 1. Check malformed_json
        decoded_content = None
        json_obj = None
        is_malformed = False
        malformed_error = None
        
        try:
            decoded_content = bytes_content.decode('utf-8')
        except UnicodeDecodeError as e:
            is_malformed = True
            malformed_error = f"Invalid UTF-8: {e}"
            
        if not is_malformed:
            try:
                json_obj = json.loads(decoded_content)
            except json.JSONDecodeError as e:
                is_malformed = True
                malformed_error = f"Malformed JSON: {e}"
                
        if is_malformed:
            documents_list.append({
                "file": file_name,
                "status": "malformed_json",
                "sha256": sha256,
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
                "error": malformed_error
            })
            status_counts["malformed_json"] += 1
            continue
            
        # 2. Check not_an_object
        if not isinstance(json_obj, dict):
            documents_list.append({
                "file": file_name,
                "status": "not_an_object",
                "sha256": sha256,
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
                "error": f"Top-level JSON value is not an object, got {type(json_obj).__name__}"
            })
            status_counts["not_an_object"] += 1
            continue
            
        # 3. Get declared_version
        declared_version = None
        v = json_obj.get("version")
        if isinstance(v, str):
            declared_version = v
            
        # Check if version major component mismatch
        is_version_mismatch = False
        if declared_version is not None:
            major = declared_version.split('.')[0]
            if major != installed_major:
                is_version_mismatch = True
                
        # Try to ingest
        doc = None
        recovered = False
        status = None
        error_msg = None
        
        try:
            doc = DoclingDocument.model_validate(json_obj)
            status = "ok"
            ok_count += 1
        except ValidationError as ve:
            error_msg = str(ve)
            if is_version_mismatch:
                status = "version_mismatch"
            else:
                status = "schema_invalid"
        except Exception as e:
            error_msg = str(e)
            status = "unreadable"
            
        # 4. Recovery for version_mismatch
        if status == "version_mismatch":
            recovered_json_obj = dict(json_obj)
            recovered_json_obj["version"] = installed_version
            try:
                doc = DoclingDocument.model_validate(recovered_json_obj)
                recovered = True
                recovered_count += 1
            except Exception as e:
                # Recovery failed
                recovered = False
                doc = None
                
        # Update status counts
        status_counts[status] += 1
        
        # 5. Handle successful ingestion (directly ok or recovered)
        if doc is not None:
            # Extract counts
            counts = {
                "texts": len(doc.texts),
                "tables": len(doc.tables),
                "pictures": len(doc.pictures),
                "groups": len(doc.groups),
                "pages": len(doc.pages)
            }
            
            # Stream parity check
            if recovered:
                bytes_to_use = json.dumps(recovered_json_obj, ensure_ascii=False).encode('utf-8')
            else:
                bytes_to_use = bytes_content
                
            try:
                doc_stream = DoclingDocument.model_validate_json(bytes_to_use)
                
                # Write to temp file to load via load_from_json
                with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as tmp:
                    tmp.write(bytes_to_use)
                    temp_path = tmp.name
                try:
                    doc_path = DoclingDocument.load_from_json(temp_path)
                finally:
                    try:
                        os.remove(temp_path)
                    except Exception:
                        pass
                        
                stream_parity = (doc_stream.model_dump() == doc_path.model_dump())
            except Exception:
                stream_parity = False
                
            # Emit normalized JSON artifact
            exported_dict = doc.model_dump()
            normalized_json_str = json.dumps(exported_dict, indent=2, sort_keys=True, ensure_ascii=False) + "\n"
            normalized_path = os.path.join(out_dir, "normalized", f"{stem}.json")
            try:
                with open(normalized_path, "w", encoding="utf-8") as f:
                    f.write(normalized_json_str)
                normalized_path_rel = f"normalized/{stem}.json"
            except Exception:
                normalized_path_rel = None
                
            # Emit Markdown artifact
            try:
                markdown_content = doc.export_to_markdown()
                markdown_content = markdown_content.rstrip('\r\n') + "\n"
                markdown_path = os.path.join(out_dir, "markdown", f"{stem}.md")
                with open(markdown_path, "w", encoding="utf-8") as f:
                    f.write(markdown_content)
                markdown_path_rel = f"markdown/{stem}.md"
            except Exception:
                markdown_path_rel = None
                
            # Round-trip stability check
            try:
                with open(normalized_path, "rb") as f:
                    norm_bytes = f.read()
                doc_roundtrip = DoclingDocument.model_validate_json(norm_bytes)
                roundtrip_stable = (doc_roundtrip.model_dump() == exported_dict)
            except Exception:
                roundtrip_stable = False
                
            documents_list.append({
                "file": file_name,
                "status": status,
                "sha256": sha256,
                "size_bytes": size_bytes,
                "declared_version": declared_version,
                "document_version": doc.version,
                "name": doc.name,
                "counts": counts,
                "stream_parity": stream_parity,
                "roundtrip_stable": roundtrip_stable,
                "recovered": recovered,
                "normalized_path": normalized_path_rel,
                "markdown_path": markdown_path_rel,
                "error": error_msg
            })
        else:
            # Failed ingestion
            documents_list.append({
                "file": file_name,
                "status": status,
                "sha256": sha256,
                "size_bytes": size_bytes,
                "declared_version": declared_version,
                "document_version": None,
                "name": None,
                "counts": None,
                "stream_parity": False,
                "roundtrip_stable": False,
                "recovered": False,
                "normalized_path": None,
                "markdown_path": None,
                "error": error_msg
            })
            
    # Build final report
    report = {
        "schema_version": installed_version,
        "input_dir": args.input_dir,
        "total": total,
        "ok": ok_count,
        "recovered": recovered_count,
        "failed": total - ok_count,
        "status_counts": {
            "ok": status_counts["ok"],
            "malformed_json": status_counts["malformed_json"],
            "not_an_object": status_counts["not_an_object"],
            "version_mismatch": status_counts["version_mismatch"],
            "schema_invalid": status_counts["schema_invalid"],
            "unreadable": status_counts["unreadable"]
        },
        "documents": documents_list
    }
    
    report_path = os.path.join(out_dir, "audit_report.json")
    report_json = json.dumps(report, indent=2, ensure_ascii=False) + "\n"
    with open(report_path, "w", encoding="utf-8") as f:
        f.write(report_json)
        
    # Check exit code criteria
    any_parity_or_roundtrip_failed = False
    for doc_entry in documents_list:
        is_ingested = (doc_entry["status"] == "ok" or doc_entry["recovered"])
        if is_ingested:
            if not doc_entry["stream_parity"] or not doc_entry["roundtrip_stable"]:
                any_parity_or_roundtrip_failed = True
                break
                
    # Print summary output
    print(f"AUDIT total={total} ok={ok_count} recovered={recovered_count} failed={total - ok_count}")
    
    if any_parity_or_roundtrip_failed:
        sys.exit(4)
    elif total - ok_count > 0:
        sys.exit(3)
    else:
        sys.exit(0)

if __name__ == "__main__":
    main()
