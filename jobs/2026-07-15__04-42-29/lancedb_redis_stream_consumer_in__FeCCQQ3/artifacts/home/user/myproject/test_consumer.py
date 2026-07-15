"""
Integration test for run_consumer.py.

Tests (all run against a real local Redis + LanceDB on-disk):

1. basic_ingest       — produce N messages, run consumer, verify rows in LanceDB.
2. idempotent_upsert  — re-deliver the same IDs; row count must not grow.
3. crash_recovery     — simulate a mid-batch crash (XACK withheld), restart
                        the consumer, verify every message lands exactly once.
4. empty_stream       — consumer exits cleanly on an empty stream (DONE line).
"""

from __future__ import annotations

import os
import subprocess
import sys
import tempfile
import time
import unittest

import lancedb
import numpy as np
import redis

REDIS_HOST = "127.0.0.1"
REDIS_PORT = 6379

VECTOR_DIM = 8
BATCH_SIZE = 5

SCRIPT = os.path.join(os.path.dirname(__file__), "run_consumer.py")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_env(stream_key: str, group_name: str, lancedb_dir: str, table_name: str) -> dict:
    return {
        **os.environ,
        "REDIS_HOST":    REDIS_HOST,
        "REDIS_PORT":    str(REDIS_PORT),
        "STREAM_KEY":    stream_key,
        "GROUP_NAME":    group_name,
        "CONSUMER_NAME": "test-consumer",
        "LANCEDB_DIR":   lancedb_dir,
        "TABLE_NAME":    table_name,
        "BATCH_SIZE":    str(BATCH_SIZE),
        "VECTOR_DIM":    str(VECTOR_DIM),
    }


def _push_messages(r: redis.Redis, stream_key: str, n: int, id_prefix: str = "msg") -> list[str]:
    """Push *n* synthetic embedding messages; return their business IDs."""
    ids = []
    for i in range(n):
        bid    = f"{id_prefix}-{i}"
        vec    = np.random.rand(VECTOR_DIM).astype("<f4")
        r.xadd(stream_key, {"id": bid, "vector": vec.tobytes(), "text": f"text-{i}"})
        ids.append(bid)
    return ids


def _run_consumer(env: dict, timeout: int = 30) -> subprocess.CompletedProcess:
    return subprocess.run(
        [sys.executable, SCRIPT],
        env=env,
        capture_output=True,
        text=True,
        timeout=timeout,
    )


def _table_ids(lancedb_dir: str, table_name: str) -> set[str]:
    db  = lancedb.connect(lancedb_dir)
    tbl = db.open_table(table_name)
    return set(tbl.to_arrow().column("id").to_pylist())


def _parse_done(stdout: str) -> tuple[int, int]:
    """Return (ingested, reclaimed) from the DONE line."""
    for line in stdout.strip().splitlines():
        if line.startswith("DONE"):
            parts = dict(p.split("=") for p in line.split()[1:])
            return int(parts["ingested"]), int(parts["reclaimed"])
    raise AssertionError(f"No DONE line found in stdout:\n{stdout}")


# ---------------------------------------------------------------------------
# Test cases
# ---------------------------------------------------------------------------

class TestConsumer(unittest.TestCase):

    def setUp(self):
        self.r       = redis.Redis(host=REDIS_HOST, port=REDIS_PORT)
        self.tmpdir  = tempfile.mkdtemp(prefix="lancedb_test_")
        ts           = str(int(time.time() * 1000))
        self.stream  = f"stream-{ts}"
        self.group   = f"group-{ts}"
        self.table   = f"table_{ts}"

    def tearDown(self):
        self.r.delete(self.stream)
        import shutil
        shutil.rmtree(self.tmpdir, ignore_errors=True)

    # ------------------------------------------------------------------
    def test_1_basic_ingest(self):
        """All pushed messages land in LanceDB; DONE line is correct."""
        n   = 12
        ids = _push_messages(self.r, self.stream, n)
        env = _make_env(self.stream, self.group, self.tmpdir, self.table)

        result = _run_consumer(env)
        self.assertEqual(result.returncode, 0, msg=result.stderr)

        ingested, reclaimed = _parse_done(result.stdout)
        self.assertEqual(ingested,  n)
        self.assertEqual(reclaimed, 0)
        self.assertEqual(_table_ids(self.tmpdir, self.table), set(ids))

    # ------------------------------------------------------------------
    def test_2_idempotent_upsert(self):
        """Re-running with the same messages does not duplicate rows."""
        n   = 6
        ids = _push_messages(self.r, self.stream, n)
        env = _make_env(self.stream, self.group, self.tmpdir, self.table)

        # First run — normal ingest
        r1 = _run_consumer(env)
        self.assertEqual(r1.returncode, 0, msg=r1.stderr)

        # Manually re-add the same IDs to the stream under a different group
        # to simulate a re-delivery: push same business IDs again.
        stream2 = self.stream + "-dup"
        group2  = self.group  + "-dup"
        for bid in ids:
            vec = np.random.rand(VECTOR_DIM).astype("<f4")
            self.r.xadd(stream2, {"id": bid, "vector": vec.tobytes(), "text": "dup"})

        env2 = {**env, "STREAM_KEY": stream2, "GROUP_NAME": group2}
        r2   = _run_consumer(env2)
        self.assertEqual(r2.returncode, 0, msg=r2.stderr)

        # Row count must still be n — upsert, not append
        db  = lancedb.connect(self.tmpdir)
        tbl = db.open_table(self.table)
        self.assertEqual(tbl.count_rows(), n)
        # Text column updated to "dup"
        texts = set(tbl.to_arrow().column("text").to_pylist())
        self.assertIn("dup", texts)

    # ------------------------------------------------------------------
    def test_3_crash_recovery(self):
        """
        Simulate a crash between LanceDB commit and XACK.

        Strategy: use a *different* consumer name to claim messages via
        XREADGROUP, then crash without calling XACK (leaving them in PEL).
        The real consumer (our script) must reclaim and reprocess them without
        creating duplicate rows.
        """
        n   = BATCH_SIZE * 2         # 10 messages
        ids = _push_messages(self.r, self.stream, n)
        env = _make_env(self.stream, self.group, self.tmpdir, self.table)

        # Ensure the group exists (consumer script normally does this).
        try:
            self.r.xgroup_create(self.stream, self.group, id="0", mkstream=True)
        except redis.exceptions.ResponseError:
            pass

        # "Crash consumer": claim one batch via XREADGROUP but never XACK it.
        crash_resp = self.r.xreadgroup(
            self.group, "crash-consumer",
            {self.stream: ">"},
            count=BATCH_SIZE,
        )
        crashed_messages = crash_resp[0][1] if crash_resp else []
        self.assertGreater(len(crashed_messages), 0, "Expected pending messages")

        # Run the real consumer — it should reclaim the PEL + consume the rest.
        result = _run_consumer(env)
        self.assertEqual(result.returncode, 0, msg=result.stderr)

        ingested, reclaimed = _parse_done(result.stdout)

        # All messages must be in LanceDB exactly once.
        self.assertEqual(_table_ids(self.tmpdir, self.table), set(ids))
        self.assertEqual(ingested, n)
        # The crashed batch must have been reclaimed.
        self.assertEqual(reclaimed, len(crashed_messages))

    # ------------------------------------------------------------------
    def test_4_empty_stream(self):
        """Consumer exits cleanly when there are no messages at all."""
        env    = _make_env(self.stream, self.group, self.tmpdir, self.table)
        result = _run_consumer(env)
        self.assertEqual(result.returncode, 0, msg=result.stderr)

        ingested, reclaimed = _parse_done(result.stdout)
        self.assertEqual(ingested,  0)
        self.assertEqual(reclaimed, 0)


# ---------------------------------------------------------------------------

if __name__ == "__main__":
    unittest.main(verbosity=2)
