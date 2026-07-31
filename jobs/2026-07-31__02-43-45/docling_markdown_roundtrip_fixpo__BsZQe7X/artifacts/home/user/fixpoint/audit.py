#!/usr/bin/env python3
"""Roundtrip Fixpoint Auditor for Docling document toolchain."""

import hashlib
import io
import json
import os
import re
import shutil
import sys
import unicodedata
from collections import Counter

from docling.document_converter import DocumentConverter
from docling.datamodel.base_models import DocumentStream, InputFormat
from docling_core.types.doc import DoclingDocument


# ---------------------------------------------------------------------------
# Utilities
# ---------------------------------------------------------------------------

def sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def normalize(s: str) -> str:
    """Apply the normalization pipeline."""
    s = unicodedata.normalize("NFC", s)
    s = s.replace("\r\n", "\n").replace("\r", "\n")
    s = s.replace("\t", " ").replace("\u00a0", " ")
    lines = s.split("\n")
    processed = []
    for line in lines:
        collapsed = re.sub(r" {2,}", " ", line).strip(" ")
        processed.append(collapsed)
    surviving = [ln for ln in processed if ln != ""]
    return "\n".join(surviving)


def similarity_score(a: str, b: str) -> float:
    """Compute token-based similarity on normalized text."""
    na = normalize(a)
    nb = normalize(b)
    tokens_a = na.split()
    tokens_b = nb.split()
    if not tokens_a and not tokens_b:
        return 1.0
    ca = Counter(tokens_a)
    cb = Counter(tokens_b)
    all_tokens = set(ca.keys()) | set(cb.keys())
    s = sum(min(ca[t], cb[t]) for t in all_tokens)
    denom = len(tokens_a) + len(tokens_b)
    if denom == 0:
        return 1.0
    value = 2.0 * s / denom
    return round(value + 1e-9, 6)


# ---------------------------------------------------------------------------
# Structure signature
# ---------------------------------------------------------------------------

def _label_key(label: str) -> str:
    lowered = label.lower()
    return re.sub(r"[^a-z0-9]", "_", lowered)


def _resolve_ref(ref_path: str, doc: DoclingDocument):
    parts = ref_path.split("/")
    if len(parts) >= 3:
        collection_name = parts[1]
        try:
            index = int(parts[2])
        except ValueError:
            return None
        collection = getattr(doc, collection_name, None)
        if collection is not None and 0 <= index < len(collection):
            return collection[index]
    return None


def _compute_max_depth(node, doc: DoclingDocument, current_depth: int = 0) -> int:
    if not hasattr(node, "children") or not node.children:
        return current_depth
    max_d = current_depth
    for child_ref in node.children:
        item = _resolve_ref(child_ref.cref, doc)
        if item is not None:
            d = _compute_max_depth(item, doc, current_depth + 1)
            max_d = max(max_d, d)
    return max_d


def _collect_item_counts(node, doc: DoclingDocument, counts: dict) -> None:
    if not hasattr(node, "children"):
        return
    for child_ref in node.children:
        item = _resolve_ref(child_ref.cref, doc)
        if item is not None:
            label = getattr(item, "label", "unspecified")
            key = _label_key(str(label))
            counts[key] = counts.get(key, 0) + 1
            _collect_item_counts(item, doc, counts)


def structure_signature(doc: DoclingDocument) -> dict:
    counts: dict = {}
    _collect_item_counts(doc.body, doc, counts)
    if doc.body.children:
        max_depth = _compute_max_depth(doc.body, doc, 0)
    else:
        max_depth = 0
    table_dims = []
    for table in doc.tables:
        if table.data is not None:
            table_dims.append([table.data.num_rows, table.data.num_cols])
        else:
            table_dims.append([0, 0])
    return {
        "item_counts": counts,
        "max_depth": max_depth,
        "table_dims": table_dims,
    }


# ---------------------------------------------------------------------------
# Channel serializers
# ---------------------------------------------------------------------------

def serialize_markdown(doc: DoclingDocument) -> str:
    return doc.export_to_markdown()


def serialize_json_str(doc: DoclingDocument) -> str:
    return doc.model_dump_json(indent=2)


def parse_document(text: str, name: str) -> DoclingDocument:
    dc = DocumentConverter()
    buf = io.BytesIO(text.encode("utf-8"))
    stream = DocumentStream(name=name, stream=buf)
    result = dc.convert(stream)
    return result.document


# ---------------------------------------------------------------------------
# Argument parsing (manual, for proper error messages)
# ---------------------------------------------------------------------------

def parse_args(argv=None):
    if argv is None:
        argv = sys.argv[1:]

    corpus = "corpus"
    out = "out"
    max_iterations = "3"
    min_similarity = "0.95"
    docs = []

    i = 0
    while i < len(argv):
        arg = argv[i]
        if arg == "--corpus":
            i += 1
            if i >= len(argv):
                print("error: --corpus requires a value", file=sys.stderr)
                sys.exit(2)
            corpus = argv[i]
        elif arg == "--out":
            i += 1
            if i >= len(argv):
                print("error: --out requires a value", file=sys.stderr)
                sys.exit(2)
            out = argv[i]
        elif arg == "--max-iterations":
            i += 1
            if i >= len(argv):
                print("error: --max-iterations requires a value", file=sys.stderr)
                sys.exit(2)
            max_iterations = argv[i]
        elif arg == "--min-similarity":
            i += 1
            if i >= len(argv):
                print("error: --min-similarity requires a value", file=sys.stderr)
                sys.exit(2)
            min_similarity = argv[i]
        elif arg == "--doc":
            i += 1
            if i >= len(argv):
                print("error: --doc requires a value", file=sys.stderr)
                sys.exit(2)
            docs.append(argv[i])
        elif arg in ("-h", "--help"):
            print("usage: python3 audit.py [--corpus <dir>] [--out <dir>] "
                  "[--max-iterations <int>] [--min-similarity <float>] "
                  "[--doc <document_id>]...")
            sys.exit(0)
        else:
            print(f"error: unrecognized argument: {arg}", file=sys.stderr)
            sys.exit(2)
        i += 1

    return corpus, out, max_iterations, min_similarity, docs


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------

def validate_args(corpus_rel, out_rel, max_iterations_str, min_similarity_str, doc_filter):
    # Validate max_iterations
    try:
        max_iterations = int(max_iterations_str)
    except ValueError:
        print("error: --max-iterations must be an integer", file=sys.stderr)
        sys.exit(2)
    if max_iterations < 2 or max_iterations > 10:
        print("error: --max-iterations must be between 2 and 10 inclusive", file=sys.stderr)
        sys.exit(2)

    # Validate min_similarity
    try:
        min_similarity = float(min_similarity_str)
    except ValueError:
        print("error: --min-similarity must be a number", file=sys.stderr)
        sys.exit(2)
    if min_similarity < 0.0 or min_similarity > 1.0:
        print("error: --min-similarity must be between 0.0 and 1.0 inclusive", file=sys.stderr)
        sys.exit(2)

    # Resolve and validate corpus
    corpus_path = os.path.abspath(corpus_rel)
    if not os.path.isdir(corpus_path):
        print("error: corpus path does not exist or is not a directory", file=sys.stderr)
        sys.exit(2)

    # Discover eligible files
    eligible = []
    doc_ids_seen = set()
    try:
        entries = sorted(os.listdir(corpus_path))
    except OSError:
        print("error: cannot read corpus directory", file=sys.stderr)
        sys.exit(2)

    for entry in entries:
        fpath = os.path.join(corpus_path, entry)
        if not os.path.isfile(fpath):
            continue
        ext = os.path.splitext(entry)[1].lower()
        if ext not in (".md", ".html"):
            continue
        doc_id = os.path.splitext(entry)[0]
        if doc_id in doc_ids_seen:
            print("error: duplicate document id", file=sys.stderr)
            sys.exit(2)
        doc_ids_seen.add(doc_id)
        eligible.append((doc_id, entry, fpath))

    if not eligible:
        print("error: no eligible files found in corpus", file=sys.stderr)
        sys.exit(2)

    # Filter by --doc if provided
    if doc_filter:
        doc_set = set(doc_filter)
        eligible = [(did, entry, fpath) for did, entry, fpath in eligible if did in doc_set]
        if not eligible:
            print("error: no eligible files match --doc filter", file=sys.stderr)
            sys.exit(2)
        # Check that all --doc values are valid
        valid_ids = {did for did, _, _ in eligible}
        for d in doc_filter:
            if d not in valid_ids:
                print("error: --doc value not among eligible document ids", file=sys.stderr)
                sys.exit(2)

    out_path = os.path.abspath(out_rel)

    return corpus_path, out_path, max_iterations, min_similarity, eligible


# ---------------------------------------------------------------------------
# Sort keys helper
# ---------------------------------------------------------------------------

def sort_dict(d):
    """Recursively sort dictionary keys."""
    if isinstance(d, dict):
        return {k: sort_dict(v) for k, v in sorted(d.items())}
    if isinstance(d, list):
        return [sort_dict(v) for v in d]
    return d


# ---------------------------------------------------------------------------
# Per-iteration record
# ---------------------------------------------------------------------------

def make_iteration_record(
    iteration: int,
    text: str,
    prev_text: str | None,
    prev_normalized: str | None,
    doc: DoclingDocument,
    prev_structure: dict | None,
) -> dict:
    text_bytes = text.encode("utf-8")
    text_len = len(text_bytes)
    text_hash = sha256_hex(text_bytes)
    norm = normalize(text)
    norm_hash = sha256_hex(norm.encode("utf-8"))
    struct = structure_signature(doc)

    if prev_text is not None:
        byte_eq = text == prev_text
        norm_eq = norm == prev_normalized
        sim = similarity_score(text, prev_text)
        struct_eq = struct == prev_structure
    else:
        byte_eq = False
        norm_eq = False
        sim = 0.0
        struct_eq = False

    return {
        "iteration": iteration,
        "bytes": text_len,
        "sha256": text_hash,
        "normalized_sha256": norm_hash,
        "byte_equal_to_previous": byte_eq,
        "normalized_equal_to_previous": norm_eq,
        "similarity_to_previous": sim,
        "structure": struct,
        "structure_equal_to_previous": struct_eq,
    }


# ---------------------------------------------------------------------------
# Classification
# ---------------------------------------------------------------------------

def classify(records: list, max_iterations: int, prev_texts: list) -> tuple:
    """Classify a run based on its records.

    Returns (code, fixpoint_iteration, converged, final_similarity).
    """
    K = max_iterations
    # Find fixpoint: smallest i in 1..K-1 where T_i == T_{i+1} byte for byte
    fixpoint_iteration = None
    for i in range(K - 1):
        if prev_texts[i] is not None and prev_texts[i + 1] is not None:
            if prev_texts[i] == prev_texts[i + 1]:
                fixpoint_iteration = i + 1  # 1-based
                break

    converged = fixpoint_iteration is not None

    final_record = records[-1]
    final_similarity = final_record["similarity_to_previous"]

    if fixpoint_iteration == 1:
        code = "STABLE_IMMEDIATE"
    elif fixpoint_iteration is not None:
        code = "STABLE_DELAYED"
    elif final_record["normalized_equal_to_previous"]:
        code = "WHITESPACE_DRIFT"
    elif final_record["structure_equal_to_previous"]:
        code = "TEXT_DRIFT"
    else:
        code = "STRUCTURE_DRIFT"

    return code, fixpoint_iteration, converged, final_similarity


# ---------------------------------------------------------------------------
# Channel execution
# ---------------------------------------------------------------------------

CHANNELS = [
    ("json", ".json", serialize_json_str),
    ("markdown", ".md", serialize_markdown),
]


def run_channel(
    doc_id: str,
    channel_name: str,
    channel_ext: str,
    serializer,
    d0: DoclingDocument,
    max_iterations: int,
    artifacts_dir: str,
) -> dict:
    """Run the iterated cycle for one channel.

    Returns the channel result dict for detail.json.
    """
    os.makedirs(artifacts_dir, exist_ok=True)

    records = []
    prev_texts = []  # T_0 through T_K, where prev_texts[i] = T_i (T_0 = None conceptually)
    prev_normalized = None
    prev_structure = None
    current_doc = d0

    for i in range(1, max_iterations + 1):
        # Serialize D_{i-1} to T_i
        t_i = serializer(current_doc)

        # Write artifact
        artifact_name = f"iter_{i:02d}{channel_ext}"
        artifact_path = os.path.join(artifacts_dir, artifact_name)
        with open(artifact_path, "w", encoding="utf-8") as f:
            f.write(t_i)

        # Parse T_i back to D_i
        d_i = parse_document(t_i, artifact_name)

        # Record
        prev_text = prev_texts[-1] if prev_texts else None
        record = make_iteration_record(
            iteration=i,
            text=t_i,
            prev_text=prev_text,
            prev_normalized=prev_normalized,
            doc=d_i,
            prev_structure=prev_structure,
        )
        records.append(record)

        # Update for next iteration
        prev_texts.append(t_i)
        prev_normalized = normalize(t_i)
        prev_structure = record["structure"]
        current_doc = d_i

    code, fixpoint_iteration, converged, final_similarity = classify(
        records, max_iterations, prev_texts
    )

    # Build artifacts list (relative to document dir)
    artifacts_rel = []
    for i in range(1, max_iterations + 1):
        artifacts_rel.append(f"{channel_name}/iter_{i:02d}{channel_ext}")

    return {
        "code": code,
        "converged": converged,
        "fixpoint_iteration": fixpoint_iteration,
        "final_similarity": final_similarity,
        "artifacts": artifacts_rel,
        "iterations": records,
    }


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    corpus_rel, out_rel, max_iterations_str, min_similarity_str, doc_filter = parse_args()
    corpus_path, out_path, max_iterations, min_similarity, eligible = validate_args(
        corpus_rel, out_rel, max_iterations_str, min_similarity_str, doc_filter
    )

    # Remove existing output directory, create fresh
    if os.path.exists(out_path):
        shutil.rmtree(out_path)
    os.makedirs(out_path, exist_ok=True)

    documents_dir = os.path.join(out_path, "documents")
    os.makedirs(documents_dir, exist_ok=True)

    # Sort eligible by document_id ascending
    eligible.sort(key=lambda x: x[0])

    # Converter for initial parse
    dc = DocumentConverter()

    report_documents = []
    all_runs = []

    for doc_id, source_file, source_path in eligible:
        doc_dir = os.path.join(documents_dir, doc_id)
        os.makedirs(doc_dir, exist_ok=True)

        # Read source file bytes
        with open(source_path, "rb") as f:
            source_bytes = f.read()
        source_hash = sha256_hex(source_bytes)

        # Parse source to D0
        result = dc.convert(source_path)
        d0 = result.document

        # HTML observation (export once, never in cycle)
        html_str = d0.export_to_html()
        html_bytes = html_str.encode("utf-8")
        html_hash = sha256_hex(html_bytes)
        html_len = len(html_bytes)
        obs_path = os.path.join(doc_dir, "observation.html")
        with open(obs_path, "w", encoding="utf-8") as f:
            f.write(html_str)

        # Run both channels
        channel_results = {}
        runs_for_report = []

        for channel_name, channel_ext, serializer in CHANNELS:
            chan_dir = os.path.join(doc_dir, channel_name)
            chan_result = run_channel(
                doc_id=doc_id,
                channel_name=channel_name,
                channel_ext=channel_ext,
                serializer=serializer,
                d0=d0,
                max_iterations=max_iterations,
                artifacts_dir=chan_dir,
            )
            channel_results[channel_name] = chan_result

            run_entry = {
                "channel": channel_name,
                "iterations": max_iterations,
                "fixpoint_iteration": chan_result["fixpoint_iteration"],
                "converged": chan_result["converged"],
                "code": chan_result["code"],
                "final_similarity": chan_result["final_similarity"],
            }
            runs_for_report.append(run_entry)
            all_runs.append((doc_id, channel_name, run_entry))

        # Write detail.json
        detail = {
            "document_id": doc_id,
            "source_file": source_file,
            "source_sha256": source_hash,
            "html_sha256": html_hash,
            "html_bytes": html_len,
            "channels": channel_results,
        }
        detail = sort_dict(detail)
        detail_path = os.path.join(doc_dir, "detail.json")
        with open(detail_path, "w", encoding="utf-8") as f:
            json.dump(detail, f, indent=2, ensure_ascii=False)
            f.write("\n")

        report_doc = {
            "document_id": doc_id,
            "source_file": source_file,
            "html_sha256": html_hash,
            "runs": runs_for_report,
        }
        report_documents.append(report_doc)

    # Sort report documents by document_id ascending
    report_documents.sort(key=lambda x: x["document_id"])

    # Sort runs within each document by channel ascending
    for d in report_documents:
        d["runs"].sort(key=lambda r: r["channel"])

    # Compute totals
    total_documents = len(report_documents)
    total_runs = len(all_runs)
    converged_runs = sum(1 for _, _, r in all_runs if r["converged"])

    codes = {
        "STABLE_IMMEDIATE": 0,
        "STABLE_DELAYED": 0,
        "WHITESPACE_DRIFT": 0,
        "TEXT_DRIFT": 0,
        "STRUCTURE_DRIFT": 0,
    }
    for _, _, r in all_runs:
        codes[r["code"]] += 1

    min_final_similarity = min(r["final_similarity"] for _, _, r in all_runs) if all_runs else 1.0

    # Gate
    violations = []
    # Walk in report order: doc_id ascending, channel ascending
    sorted_runs = sorted(all_runs, key=lambda x: (x[0], x[1]))
    for doc_id, channel_name, run_entry in sorted_runs:
        code = run_entry["code"]
        if code not in ("STABLE_IMMEDIATE", "STABLE_DELAYED"):
            violations.append(f"{doc_id}/{channel_name}:{code}")
        if run_entry["final_similarity"] < min_similarity:
            violations.append(f"{doc_id}/{channel_name}:LOW_SIMILARITY")

    gate_passed = len(violations) == 0
    exit_code = 0 if gate_passed else 3

    # Build report.json
    report = {
        "schema_version": "1.0",
        "corpus": corpus_path,
        "max_iterations": max_iterations,
        "min_similarity": min_similarity,
        "channels": ["json", "markdown"],
        "documents": report_documents,
        "totals": {
            "documents": total_documents,
            "runs": total_runs,
            "converged_runs": converged_runs,
            "codes": codes,
            "min_final_similarity": min_final_similarity,
        },
        "gate": {
            "passed": gate_passed,
            "exit_code": exit_code,
            "violations": violations,
        },
    }
    report = sort_dict(report)
    report_path = os.path.join(out_path, "report.json")
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)
        f.write("\n")

    # Build summary.txt
    summary_lines = []
    summary_lines.append("FIXPOINT AUDIT")
    summary_lines.append(f"corpus: {corpus_path}")
    summary_lines.append(f"documents: {total_documents}")
    summary_lines.append(f"runs: {total_runs}")
    summary_lines.append(f"max_iterations: {max_iterations}")
    summary_lines.append(f"min_similarity: {min_similarity:.6f}")
    summary_lines.append("")

    for doc_id, channel_name, run_entry in sorted_runs:
        fp = run_entry["fixpoint_iteration"]
        fp_str = str(fp) if fp is not None else "-"
        sim_str = f"{run_entry['final_similarity']:.6f}"
        summary_lines.append(
            f"{doc_id} {channel_name} {run_entry['code']} fixpoint={fp_str} similarity={sim_str}"
        )

    summary_lines.append("")
    if gate_passed:
        summary_lines.append("GATE: PASS")
    else:
        summary_lines.append(f"GATE: FAIL ({len(violations)} violations)")

    summary_text = "\n".join(summary_lines) + "\n"
    summary_path = os.path.join(out_path, "summary.txt")
    with open(summary_path, "w", encoding="utf-8", newline="") as f:
        f.write(summary_text)

    # Write summary to stdout
    sys.stdout.write(summary_text)

    sys.exit(exit_code)


if __name__ == "__main__":
    main()
