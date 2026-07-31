"""Durable, SQLite-backed job store with an in-memory cache for fast reads
and asyncio-friendly change notification (used by the events endpoint).

All durable state lives under GATEWAY_STATE_DIR:
  <state>/gateway.db      -- sqlite database (jobs + idempotency keys)
  <state>/uploads/<id>/   -- saved bytes for `upload` submissions
  <state>/results/<id>/   -- persisted result representations
"""
from __future__ import annotations

import asyncio
import sqlite3
import threading
from pathlib import Path
from typing import Any, Optional

from util import now_iso, parse_iso


JOB_COLUMNS = [
    "job_id",
    "seq",
    "state",
    "source_kind",
    "source_name",
    "internal_path",
    "fingerprint",
    "pace_seconds",
    "created_at",
    "started_at",
    "finished_at",
    "cancel_requested",
    "progress",
    "error_code",
    "error_message",
    "idempotency_key",
]


class Store:
    def __init__(self, state_dir: Path):
        self.state_dir = state_dir
        self.db_path = state_dir / "gateway.db"
        self._conn = sqlite3.connect(str(self.db_path), check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        self._db_lock = threading.Lock()
        self._jobs: dict[str, dict[str, Any]] = {}
        self._idempotency: dict[str, str] = {}
        self._seq_counter = 0
        self._events: dict[str, asyncio.Event] = {}
        self._init_schema()
        self._load_cache()

    # ------------------------------------------------------------------
    # Schema / load / repair
    # ------------------------------------------------------------------
    def _init_schema(self) -> None:
        with self._db_lock:
            c = self._conn
            c.execute(
                """
                CREATE TABLE IF NOT EXISTS jobs (
                    job_id TEXT PRIMARY KEY,
                    seq INTEGER UNIQUE NOT NULL,
                    state TEXT NOT NULL,
                    source_kind TEXT NOT NULL,
                    source_name TEXT NOT NULL,
                    internal_path TEXT NOT NULL,
                    fingerprint TEXT NOT NULL,
                    pace_seconds REAL NOT NULL,
                    created_at TEXT NOT NULL,
                    started_at TEXT,
                    finished_at TEXT,
                    cancel_requested INTEGER NOT NULL DEFAULT 0,
                    progress REAL NOT NULL DEFAULT 0,
                    error_code TEXT,
                    error_message TEXT,
                    idempotency_key TEXT
                )
                """
            )
            c.execute(
                """
                CREATE TABLE IF NOT EXISTS idempotency (
                    key TEXT PRIMARY KEY,
                    job_id TEXT NOT NULL
                )
                """
            )
            c.execute("PRAGMA journal_mode=WAL")
            c.commit()

    def _load_cache(self) -> None:
        with self._db_lock:
            rows = self._conn.execute("SELECT * FROM jobs").fetchall()
            for row in rows:
                job = {k: row[k] for k in JOB_COLUMNS}
                self._jobs[job["job_id"]] = job
                if job["seq"] > self._seq_counter:
                    self._seq_counter = job["seq"]
            idem_rows = self._conn.execute("SELECT key, job_id FROM idempotency").fetchall()
            for r in idem_rows:
                self._idempotency[r["key"]] = r["job_id"]

    def repair_interrupted(self) -> int:
        """Mark any job left in queued/running (from a prior process) as
        failed/INTERRUPTED. Returns the number of jobs repaired."""
        repaired = 0
        now = now_iso()
        for job_id, job in list(self._jobs.items()):
            if job["state"] in ("queued", "running"):
                job["state"] = "failed"
                job["error_code"] = "INTERRUPTED"
                job["error_message"] = "Job was still in progress when the gateway process stopped."
                job["finished_at"] = now
                self._persist(job)
                repaired += 1
        return repaired

    # ------------------------------------------------------------------
    # Persistence helpers
    # ------------------------------------------------------------------
    def _persist(self, job: dict[str, Any]) -> None:
        with self._db_lock:
            self._conn.execute(
                """
                UPDATE jobs SET state=?, started_at=?, finished_at=?, cancel_requested=?,
                    progress=?, error_code=?, error_message=?
                WHERE job_id=?
                """,
                (
                    job["state"],
                    job["started_at"],
                    job["finished_at"],
                    1 if job["cancel_requested"] else 0,
                    job["progress"],
                    job["error_code"],
                    job["error_message"],
                    job["job_id"],
                ),
            )
            self._conn.commit()

    def next_seq(self) -> int:
        self._seq_counter += 1
        return self._seq_counter

    def create_job(
        self,
        *,
        job_id: str,
        seq: int,
        source_kind: str,
        source_name: str,
        internal_path: str,
        fingerprint: str,
        pace_seconds: float,
        idempotency_key: Optional[str],
    ) -> dict[str, Any]:
        created_at = now_iso()
        job = {
            "job_id": job_id,
            "seq": seq,
            "state": "queued",
            "source_kind": source_kind,
            "source_name": source_name,
            "internal_path": internal_path,
            "fingerprint": fingerprint,
            "pace_seconds": pace_seconds,
            "created_at": created_at,
            "started_at": None,
            "finished_at": None,
            "cancel_requested": 0,
            "progress": 0.0,
            "error_code": None,
            "error_message": None,
            "idempotency_key": idempotency_key,
        }
        with self._db_lock:
            self._conn.execute(
                """
                INSERT INTO jobs (job_id, seq, state, source_kind, source_name, internal_path,
                    fingerprint, pace_seconds, created_at, started_at, finished_at,
                    cancel_requested, progress, error_code, error_message, idempotency_key)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                """,
                (
                    job["job_id"], job["seq"], job["state"], job["source_kind"],
                    job["source_name"], job["internal_path"], job["fingerprint"],
                    job["pace_seconds"], job["created_at"], job["started_at"],
                    job["finished_at"], job["cancel_requested"], job["progress"],
                    job["error_code"], job["error_message"], job["idempotency_key"],
                ),
            )
            if idempotency_key:
                self._conn.execute(
                    "INSERT INTO idempotency (key, job_id) VALUES (?, ?)",
                    (idempotency_key, job_id),
                )
            self._conn.commit()
        self._jobs[job_id] = job
        if idempotency_key:
            self._idempotency[idempotency_key] = job_id
        return job

    def update_job(self, job_id: str, **fields) -> None:
        job = self._jobs.get(job_id)
        if job is None:
            return
        job.update(fields)
        self._persist(job)
        self._notify(job_id)

    # ------------------------------------------------------------------
    # Reads
    # ------------------------------------------------------------------
    def get_internal(self, job_id: str) -> Optional[dict[str, Any]]:
        return self._jobs.get(job_id)

    def idempotency_lookup(self, key: str) -> Optional[str]:
        return self._idempotency.get(key)

    def count_state(self, state: str) -> int:
        return sum(1 for j in self._jobs.values() if j["state"] == state)

    def counts_terminal(self) -> dict[str, int]:
        out = {"succeeded": 0, "failed": 0, "cancelled": 0}
        for j in self._jobs.values():
            if j["state"] in out:
                out[j["state"]] += 1
        return out

    def total_submitted(self) -> int:
        return len(self._jobs)

    def list_jobs(self, state: Optional[str], limit: int) -> list[dict[str, Any]]:
        jobs = list(self._jobs.values())
        if state:
            jobs = [j for j in jobs if j["state"] == state]
        jobs.sort(key=lambda j: j["seq"], reverse=True)
        return jobs[:limit]

    def to_public(self, job: dict[str, Any]) -> dict[str, Any]:
        error = None
        if job["error_code"]:
            error = {"code": job["error_code"], "message": job["error_message"]}
        duration = None
        if job["started_at"] and job["finished_at"]:
            duration = round(
                (parse_iso(job["finished_at"]) - parse_iso(job["started_at"])).total_seconds(), 3
            )
        return {
            "job_id": job["job_id"],
            "seq": job["seq"],
            "state": job["state"],
            "source_kind": job["source_kind"],
            "source_name": job["source_name"],
            "fingerprint": job["fingerprint"],
            "pace_seconds": job["pace_seconds"],
            "progress": round(job["progress"], 2),
            "created_at": job["created_at"],
            "started_at": job["started_at"],
            "finished_at": job["finished_at"],
            "duration_seconds": duration,
            "cancel_requested": bool(job["cancel_requested"]),
            "error": error,
        }

    def get_public(self, job_id: str) -> Optional[dict[str, Any]]:
        job = self._jobs.get(job_id)
        if job is None:
            return None
        return self.to_public(job)

    # ------------------------------------------------------------------
    # Change notification (for the events/SSE-ish stream)
    # ------------------------------------------------------------------
    def _notify(self, job_id: str) -> None:
        ev = self._events.get(job_id)
        if ev is not None:
            ev.set()
        self._events[job_id] = asyncio.Event()

    async def wait_for_change(self, job_id: str, timeout: float) -> None:
        ev = self._events.setdefault(job_id, asyncio.Event())
        try:
            await asyncio.wait_for(ev.wait(), timeout=timeout)
        except asyncio.TimeoutError:
            pass

    def close(self) -> None:
        with self._db_lock:
            self._conn.close()
