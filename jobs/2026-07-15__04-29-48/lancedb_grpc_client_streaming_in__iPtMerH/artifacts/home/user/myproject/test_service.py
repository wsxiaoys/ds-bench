#!/usr/bin/env python3
"""End-to-end test for the vector ingestion + search microservice."""
import sys
import os
import random
import math

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from client import ingest_vectors, search

ADDRESS = "127.0.0.1:50051"
DIM = 16

def make_records(n, start_id=0):
    return [
        {"id": start_id + i, "vector": [random.random() for _ in range(DIM)], "metadata": "rec-{}".format(start_id + i)}
        for i in range(n)
    ]

def approx_eq(a, b, eps=1e-5):
    return abs(a - b) < eps

# ---------------------------------------------------------------------------
# Test 1: basic ingestion with < 1 batch (50 records -> 1 batch, no full flush)
# ---------------------------------------------------------------------------
print("=" * 60)
print("Test 1: small ingestion (50 records)")
recs = make_records(50)
summary = ingest_vectors(recs, address=ADDRESS)
print("  summary:", summary)
assert summary["received"] == 50, "received mismatch"
assert summary["written"] == 50, "written mismatch"
assert summary["batches"] == 1, "batches mismatch (remainder flush)"
print("  PASS")

# ---------------------------------------------------------------------------
# Test 2: ingestion with multiple full batches (250 records -> 3 batches)
# ---------------------------------------------------------------------------
print("=" * 60)
print("Test 2: multi-batch ingestion (250 records)")
recs = make_records(250, start_id=1000)
summary = ingest_vectors(recs, address=ADDRESS)
print("  summary:", summary)
assert summary["received"] == 250
assert summary["written"] == 250
assert summary["batches"] == 3, "expected 3 batches (2 full + 1 remainder)"
print("  PASS")

# ---------------------------------------------------------------------------
# Test 3: exact batch boundary (200 records -> 2 batches, no remainder)
# ---------------------------------------------------------------------------
print("=" * 60)
print("Test 3: exact batch boundary (200 records)")
recs = make_records(200, start_id=2000)
summary = ingest_vectors(recs, address=ADDRESS)
print("  summary:", summary)
assert summary["received"] == 200
assert summary["written"] == 200
assert summary["batches"] == 2
print("  PASS")

# ---------------------------------------------------------------------------
# Test 4: search returns nearest neighbor first
# ---------------------------------------------------------------------------
print("=" * 60)
print("Test 4: search correctness")
# Ingest a known record and search for its exact vector
known_id = 99999
known_vec = [float(i) * 0.1 for i in range(DIM)]
ingest_vectors([{"id": known_id, "vector": known_vec, "metadata": "known"}], address=ADDRESS)

hits = search(known_vec, 1, address=ADDRESS)
print("  top hit:", hits)
assert len(hits) == 1
assert hits[0]["id"] == known_id, "nearest should be the exact-match record"
assert approx_eq(hits[0]["distance"], 0.0), "distance to self should be ~0"
assert hits[0]["metadata"] == "known"
print("  PASS")

# ---------------------------------------------------------------------------
# Test 5: search ordering by ascending distance
# ---------------------------------------------------------------------------
print("=" * 60)
print("Test 5: search ordering")
# Use a query vector far from the random [0,1) data so only our test vectors
# are the nearest neighbours.
query = [100.0] * DIM
# Place test vectors at known squared-L2 distances from the query.
v1 = [101.0] + [100.0] * (DIM - 1)   # squared dist = 1
v2 = [102.0] + [100.0] * (DIM - 1)   # squared dist = 4
v3 = [103.0] + [100.0] * (DIM - 1)   # squared dist = 9
ingest_vectors([
    {"id": 100001, "vector": v3, "metadata": "far"},
    {"id": 100002, "vector": v1, "metadata": "near"},
    {"id": 100003, "vector": v2, "metadata": "mid"},
], address=ADDRESS)

hits = search(query, 3, address=ADDRESS)
print("  hits:", hits)
assert hits[0]["id"] == 100002, "nearest should be v1"
assert hits[1]["id"] == 100003, "second should be v2"
assert hits[2]["id"] == 100001, "third should be v3"
assert approx_eq(hits[0]["distance"], 1.0)
assert approx_eq(hits[1]["distance"], 4.0)
assert approx_eq(hits[2]["distance"], 9.0)
print("  PASS")

# ---------------------------------------------------------------------------
# Test 6: search with k larger than table size
# ---------------------------------------------------------------------------
print("=" * 60)
print("Test 6: k larger than available results")
hits = search(query, 100000, address=ADDRESS)
print("  num hits:", len(hits))
assert len(hits) <= 100000
assert len(hits) > 0
print("  PASS")

# ---------------------------------------------------------------------------
# Test 7: dimension mismatch aborts with INVALID_ARGUMENT and no partial write
# ---------------------------------------------------------------------------
print("=" * 60)
print("Test 7: dimension mismatch -> abort + no partial write")
import grpc

# Count rows before
hits_before = search(query, 100000, address=ADDRESS)
count_before = len(hits_before)

bad_records = make_records(150, start_id=500000)  # 150 good records (would flush 1 batch of 100)
# Append a bad-dimension record
bad_records.append({"id": 500200, "vector": [0.0] * 8, "metadata": "bad"})  # 8-dim, wrong

try:
    ingest_vectors(bad_records, address=ADDRESS)
    print("  FAIL: should have raised")
    sys.exit(1)
except grpc.RpcError as e:
    print("  caught RpcError as expected")
    print("  code:", e.code())
    assert e.code() == grpc.StatusCode.INVALID_ARGUMENT, "expected INVALID_ARGUMENT"
    print("  details:", e.details())

# Verify no partial write: row count should be unchanged
hits_after = search(query, 100000, address=ADDRESS)
count_after = len(hits_after)
print("  count before:", count_before, "count after:", count_after)
assert count_after == count_before, "partial write detected! table should be unchanged"
print("  PASS (no partial write)")

# ---------------------------------------------------------------------------
# Test 8: dimension mismatch in first batch (before any flush)
# ---------------------------------------------------------------------------
print("=" * 60)
print("Test 8: dimension mismatch before any flush")
bad_records_early = [
    {"id": 600000, "vector": [0.0] * 10, "metadata": "bad-early"},  # wrong dim immediately
]
try:
    ingest_vectors(bad_records_early, address=ADDRESS)
    print("  FAIL: should have raised")
    sys.exit(1)
except grpc.RpcError as e:
    assert e.code() == grpc.StatusCode.INVALID_ARGUMENT
    print("  caught INVALID_ARGUMENT as expected")

count_after2 = len(search(query, 100000, address=ADDRESS))
assert count_after2 == count_before, "table should still be unchanged"
print("  PASS")

# ---------------------------------------------------------------------------
# Test 9: good ingestion after a failed one still works (table not corrupted)
# ---------------------------------------------------------------------------
print("=" * 60)
print("Test 9: ingestion works after a failed RPC")
recs = make_records(5, start_id=700000)
summary = ingest_vectors(recs, address=ADDRESS)
print("  summary:", summary)
assert summary["written"] == 5
assert summary["batches"] == 1
hits = search(recs[0]["vector"], 1, address=ADDRESS)
assert hits[0]["id"] == 700000
print("  PASS")

print("=" * 60)
print("ALL TESTS PASSED")