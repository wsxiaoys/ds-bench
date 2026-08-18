import argparse
import hashlib
import io
import json
import os
import sys
import tempfile
from docling_core.types.doc import DoclingDocument
from pydantic import ValidationError

def get_major_version(v_str: str) -> str:
    return v_str.split(".")[0]

def get_file_metadata(filepath: str):
    with open(filepath, "rb") as f:
        content = f.read()
    sha256 = hashlib.sha256(content).hexdigest()
    size_bytes = len(content)
    return content, sha256, size_bytes

def main():
    parser = argparse.ArgumentParser(description="Docling JSON Round-Trip Audit CLI")
    parser.add_argument("--input-dir", required=True, help="Input directory containing candidate JSON files")
    parser.add_argument("--out-dir", required=True, help="Output directory for reports and artifacts")
    args = parser.parse_args()

    # Exit code 5 check
    if not os.path.exists(args.input_dir) or not os.path.isdir(args.input_dir):
        sys.exit(5)

    candidates = [
        f for f in os.listdir(args.input_dir)
        if f.endswith(".json") and os.path.isfile(os.path.join(args.input_dir, f))
    ]
    if not candidates:
        sys.exit(5)

    # Sort candidates by name to ensure deterministic output
    candidates = sorted(candidates)

    # Create out-dir and parents
    os.makedirs(args.out_dir, exist_ok=True)

    # Get installed schema version
    installed_schema_version = "1.10.0"
    if "version" in DoclingDocument.model_fields:
        field_default = DoclingDocument.model_fields["version"].default
        if isinstance(field_default, str):
            installed_schema_version = field_default

    total_candidates = len(candidates)
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
    documents = []

    for candidate in candidates:
        filepath = os.path.join(args.input_dir, candidate)
        stem = os.path.splitext(candidate)[0]

        original_bytes, sha256, size_bytes = get_file_metadata(filepath)

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

        raw_text = None
        data = None
        doc = None

        # 1. UTF-8 decoding
        try:
            raw_text = original_bytes.decode("utf-8")
        except Exception as exc:
            status = "malformed_json"
            error = f"UTF-8 decode failed: {exc}"

        # 2. JSON parsing
        if status is None:
            try:
                data = json.loads(raw_text)
            except Exception as exc:
                status = "malformed_json"
                error = f"JSON parse failed: {exc}"

        # 3. Check if JSON object
        if status is None:
            if not isinstance(data, dict):
                status = "not_an_object"
                error = f"Expected JSON object, got {type(data).__name__}"

        # 4. Extract declared_version if object
        if status is None:
            v = data.get("version")
            if isinstance(v, str):
                declared_version = v

        # 5. Ingestion
        if status is None:
            try:
                doc = DoclingDocument.model_validate_json(raw_text)
                status = "ok"
            except Exception as exc:
                if isinstance(exc, ValidationError):
                    if declared_version is not None:
                        declared_major = get_major_version(declared_version)
                        installed_major = get_major_version(installed_schema_version)
                        if declared_major != installed_major:
                            status = "version_mismatch"
                        else:
                            status = "schema_invalid"
                    else:
                        status = "schema_invalid"
                    error = str(exc)
                else:
                    status = "unreadable"
                    error = f"Ingestion failed with unexpected error: {exc}"

        # 6. Recovery retry
        recovered_bytes = None
        if status == "version_mismatch":
            try:
                recovered_data = dict(data)
                recovered_data["version"] = installed_schema_version
                doc_recovered = DoclingDocument.model_validate(recovered_data)
                recovered = True
                doc = doc_recovered
                recovered_json_str = json.dumps(recovered_data)
                recovered_bytes = recovered_json_str.encode("utf-8")
            except Exception as retry_exc:
                error = f"{error}\nRecovery retry failed: {retry_exc}"

        # 7. Post-ingestion processing
        if status == "ok" or recovered:
            document_version = doc.version
            name = doc.name
            counts = {
                "texts": len(doc.texts),
                "tables": len(doc.tables),
                "pictures": len(doc.pictures),
                "groups": len(doc.groups),
                "pages": len(doc.pages),
            }

            normalized_path = f"normalized/{stem}.json"
            markdown_path = f"markdown/{stem}.md"

            normalized_full_path = os.path.join(args.out_dir, normalized_path)
            markdown_full_path = os.path.join(args.out_dir, markdown_path)

            os.makedirs(os.path.dirname(normalized_full_path), exist_ok=True)
            os.makedirs(os.path.dirname(markdown_full_path), exist_ok=True)

            # Export to dict and serialize normalized JSON
            exported_dict = doc.export_to_dict()
            normalized_json_str = json.dumps(exported_dict, indent=2, sort_keys=True, ensure_ascii=False)
            normalized_json_bytes = (normalized_json_str + "\n").encode("utf-8")

            with open(normalized_full_path, "wb") as f_norm:
                f_norm.write(normalized_json_bytes)

            # Export to markdown
            md = doc.export_to_markdown()
            md_clean = md.rstrip("\r\n") + "\n"
            with open(markdown_full_path, "w", encoding="utf-8") as f_md:
                f_md.write(md_clean)

            # Stream Parity
            try:
                if recovered:
                    with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as tmp:
                        tmp.write(recovered_bytes)
                        tmp_path = tmp.name
                    try:
                        doc_from_path = DoclingDocument.load_from_json(tmp_path)
                    finally:
                        try:
                            os.unlink(tmp_path)
                        except Exception:
                            pass
                    stream = io.BytesIO(recovered_bytes)
                    doc_from_stream = DoclingDocument.model_validate_json(stream.read())
                else:
                    doc_from_path = DoclingDocument.load_from_json(filepath)
                    stream = io.BytesIO(original_bytes)
                    doc_from_stream = DoclingDocument.model_validate_json(stream.read())

                stream_parity = (doc_from_path.export_to_dict() == doc_from_stream.export_to_dict())
            except Exception:
                stream_parity = False

            # Roundtrip Stability
            try:
                doc_roundtrip = DoclingDocument.model_validate_json(normalized_json_bytes)
                roundtrip_stable = (doc_roundtrip.export_to_dict() == exported_dict)
            except Exception:
                roundtrip_stable = False

        # Update counters
        if status == "ok":
            ok_count += 1
        if recovered:
            recovered_count += 1

        status_counts[status] += 1

        documents.append({
            "file": candidate,
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
            "error": error,
        })

    failed_count = total_candidates - ok_count

    # Build report
    report = {
        "schema_version": installed_schema_version,
        "input_dir": args.input_dir,
        "total": total_candidates,
        "ok": ok_count,
        "recovered": recovered_count,
        "failed": failed_count,
        "status_counts": {
            "ok": status_counts["ok"],
            "malformed_json": status_counts["malformed_json"],
            "not_an_object": status_counts["not_an_object"],
            "version_mismatch": status_counts["version_mismatch"],
            "schema_invalid": status_counts["schema_invalid"],
            "unreadable": status_counts["unreadable"],
        },
        "documents": documents,
    }

    report_path = os.path.join(args.out_dir, "audit_report.json")
    with open(report_path, "w", encoding="utf-8") as f_rep:
        json.dump(report, f_rep, indent=2, ensure_ascii=False)

    # Determine exit code
    has_failed_parity_or_stability = False
    for doc_entry in documents:
        is_ingested = (doc_entry["status"] == "ok" or doc_entry["recovered"])
        if is_ingested:
            if not doc_entry["stream_parity"] or not doc_entry["roundtrip_stable"]:
                has_failed_parity_or_stability = True
                break

    if has_failed_parity_or_stability:
        exit_code = 4
    elif failed_count > 0:
        exit_code = 3
    else:
        exit_code = 0

    print(f"AUDIT total={total_candidates} ok={ok_count} recovered={recovered_count} failed={failed_count}")
    sys.exit(exit_code)

if __name__ == "__main__":
    main()
