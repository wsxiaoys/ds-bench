#!/usr/bin/env python3
"""CSV Bulk Loader CLI for LanceDB."""
import argparse
import csv
import json
import os
import sys
import time
import urllib.request
import urllib.error
from typing import List, Dict, Any

import lancedb
import pyarrow as pa


DB_DIR = "/home/user/loader_project/lance_db"
EMBEDDING_MODEL = "text-embedding-3-small"
VECTOR_DIM = 1536
OPENAI_BASE_URL = os.environ.get("OPENAI_BASE_URL", "https://api.minimax.io/v1").rstrip("/")
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")


def embed_texts(texts, max_retries=20):
    if not OPENAI_API_KEY:
        raise RuntimeError("OPENAI_API_KEY env var is required")
    url = f"{OPENAI_BASE_URL}/embeddings"
    payload = json.dumps({
        "model": EMBEDDING_MODEL,
        "texts": texts,
        "type": "db",
    }).encode("utf-8")

    backoff = 2.0
    for attempt in range(max_retries):
        req = urllib.request.Request(
            url,
            data=payload,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {OPENAI_API_KEY}",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=120) as resp:
                body = resp.read().decode("utf-8")
            data = json.loads(body)
            vectors = data.get("vectors")
            base_resp = data.get("base_resp") or {}
            status_code = base_resp.get("status_code", 0)

            if vectors is not None:
                if isinstance(vectors, dict):
                    vectors = [vectors]
                norm = []
                for v in vectors:
                    if isinstance(v, dict):
                        emb = v.get("embedding") or v.get("vector") or v.get("data")
                    else:
                        emb = v
                    norm.append(list(emb))
                if len(norm) != len(texts):
                    raise RuntimeError(
                        f"Embedding count mismatch: got {len(norm)} for {len(texts)} inputs"
                    )
                return norm

            if status_code in (1002, 1001, 2013):
                wait = backoff
                sys.stderr.write(
                    f"[embed] retry status={status_code} msg={base_resp.get('status_msg')}; sleep {wait:.1f}s ({attempt+1}/{max_retries})\n"
                )
                sys.stderr.flush()
                time.sleep(wait)
                backoff = min(backoff * 1.5, 30.0)
                continue

            raise RuntimeError(f"Unexpected embeddings response: {body[:500]}")
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8", errors="replace")
            sys.stderr.write(f"[embed] HTTP {e.code}: {body[:300]}; sleep {backoff:.1f}s\n")
            sys.stderr.flush()
            time.sleep(backoff)
            backoff = min(backoff * 1.5, 30.0)
        except Exception as e:
            sys.stderr.write(f"[embed] error: {e}; sleep {backoff:.1f}s\n")
            sys.stderr.flush()
            time.sleep(backoff)
            backoff = min(backoff * 1.5, 30.0)

    raise RuntimeError("Exceeded max retries for embeddings")


def read_csv_rows(csv_path):
    rows = []
    with open(csv_path, "r", encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            rows.append(dict(row))
    return rows


def cmd_ingest(args):
    csv_path = args.csv
    table_name = args.table
    text_col = args.text_col
    batch_size = args.batch_size

    if not os.path.exists(csv_path):
        sys.stderr.write(f"CSV not found: {csv_path}\n")
        return 1

    sys.stderr.write(f"[ingest] reading {csv_path}\n")
    rows = read_csv_rows(csv_path)
    sys.stderr.write(f"[ingest] {len(rows)} rows loaded\n")

    if rows and text_col not in rows[0]:
        sys.stderr.write(f"[ingest] column '{text_col}' not in CSV; have: {list(rows[0].keys())}\n")
        return 1

    os.makedirs(DB_DIR, exist_ok=True)
    db = lancedb.connect(DB_DIR)

    all_records = []
    n = len(rows)
    for start in range(0, n, batch_size):
        end = min(start + batch_size, n)
        batch = rows[start:end]
        texts = [str(r.get(text_col, "") or "") for r in batch]
        sys.stderr.write(f"[ingest] embedding rows {start}..{end-1} ({len(batch)} items)\n")
        sys.stderr.flush()
        embeddings = embed_texts(texts)
        for r, emb in zip(batch, embeddings):
            try:
                rid = int(r.get("id"))
            except Exception:
                rid = 0
            rec = {
                "id": rid,
                "title": r.get("title", "") or "",
                "body": r.get("body", "") or "",
                "category": r.get("category", "") or "",
                "published": r.get("published", "") or "",
                "text": str(r.get(text_col, "") or ""),
                "vector": emb,
            }
            all_records.append(rec)

    sys.stderr.write(f"[ingest] writing {len(all_records)} records to LanceDB table '{table_name}'\n")

    try:
        db.drop_table(table_name)
    except Exception:
        pass

    schema = pa.schema([
        ("id", pa.int64()),
        ("title", pa.string()),
        ("body", pa.string()),
        ("category", pa.string()),
        ("published", pa.string()),
        ("text", pa.string()),
        ("vector", pa.list_(pa.float32(), VECTOR_DIM)),
    ])

    table = db.create_table(table_name, data=all_records, schema=schema, mode="overwrite")
    sys.stderr.write(f"[ingest] table '{table_name}' created with {table.count_rows()} rows\n")
    return 0


def cmd_search(args):
    table_name = args.table
    query = args.query
    k = args.k

    db = lancedb.connect(DB_DIR)
    if table_name not in db.table_names():
        sys.stderr.write(f"Table '{table_name}' not found\n")
        return 1
    table = db.open_table(table_name)

    qvec = embed_texts([query])[0]

    rows = table.search(qvec).limit(k).to_list()

    results = []
    for r in rows:
        score = None
        for key in ("_distance", "_score", "score", "distance", "similarity"):
            if key in r:
                score = r[key]
                break
        if score is None:
            score = 0.0
        try:
            score_f = float(score)
            if score_f != score_f:  # NaN
                score_f = 0.0
            if score_f == float("inf") or score_f == float("-inf"):
                score_f = 0.0
        except Exception:
            score_f = 0.0
        results.append({
            "id": int(r.get("id", 0) or 0),
            "title": str(r.get("title", "") or ""),
            "category": str(r.get("category", "") or ""),
            "published": str(r.get("published", "") or ""),
            "score": score_f,
        })

    out = {"query": query, "k": k, "results": results}
    sys.stdout.write(json.dumps(out, ensure_ascii=False))
    sys.stdout.write("\n")
    sys.stdout.flush()
    return 0


def main():
    parser = argparse.ArgumentParser(prog="loader")
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_ing = sub.add_parser("ingest")
    p_ing.add_argument("--csv", required=True)
    p_ing.add_argument("--table", required=True)
    p_ing.add_argument("--text-col", required=True)
    p_ing.add_argument("--batch-size", type=int, required=True)
    p_ing.set_defaults(func=cmd_ingest)

    p_search = sub.add_parser("search")
    p_search.add_argument("--table", required=True)
    p_search.add_argument("--query", required=True)
    p_search.add_argument("--k", type=int, required=True)
    p_search.set_defaults(func=cmd_search)

    args = parser.parse_args()
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
