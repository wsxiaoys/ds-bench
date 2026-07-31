"""The Gateway ties together the durable Store, the bounded worker/queue
model, submission (incl. idempotency + backpressure) and cancellation.
"""
from __future__ import annotations

import asyncio
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any, Optional

import config
import conversion
from errors import err
from store import Store
from util import now_iso, utcnow


class Metrics:
    """Per-process counters that intentionally reset on restart."""

    def __init__(self) -> None:
        self.rejected_queue_full = 0
        self.idempotent_hits = 0


class Gateway:
    def __init__(self) -> None:
        config.ensure_dirs()
        self.store = Store(config.GATEWAY_STATE_DIR)
        repaired = self.store.repair_interrupted()
        if repaired:
            print(f"[startup] repaired {repaired} interrupted job(s) -> failed/INTERRUPTED")

        self.metrics = Metrics()
        self.start_time = time.monotonic()

        self._queue: asyncio.Queue[str] = asyncio.Queue()
        self._executor = ThreadPoolExecutor(max_workers=config.MAX_RUNNING + 2)
        self._submission_lock = asyncio.Lock()
        self._worker_tasks: list[asyncio.Task] = []
        self._shutting_down = False

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------
    def start_workers(self) -> None:
        for i in range(config.MAX_RUNNING):
            task = asyncio.create_task(self._worker_loop(i))
            self._worker_tasks.append(task)

    async def shutdown(self) -> None:
        self._shutting_down = True
        for t in self._worker_tasks:
            t.cancel()
        for t in self._worker_tasks:
            try:
                await t
            except (asyncio.CancelledError, Exception):
                pass
        self._executor.shutdown(wait=False, cancel_futures=True)
        self.store.close()

    def uptime_seconds(self) -> float:
        return time.monotonic() - self.start_time

    # ------------------------------------------------------------------
    # Submission (shared by upload + path endpoints)
    # ------------------------------------------------------------------
    async def submit(
        self,
        *,
        source_kind: str,
        source_name: str,
        fingerprint: str,
        internal_path: str,
        pace_seconds: float,
        idempotency_key: Optional[str],
    ) -> tuple[int, dict[str, Any]]:
        """Returns (http_status, public_job_dict)."""
        async with self._submission_lock:
            if idempotency_key:
                existing_id = self.store.idempotency_lookup(idempotency_key)
                if existing_id:
                    self.metrics.idempotent_hits += 1
                    existing = self.store.get_public(existing_id)
                    if existing is None:
                        # Shouldn't happen, but guard anyway.
                        raise err("VALIDATION_ERROR", "idempotency key references a missing job")
                    if existing["fingerprint"] != fingerprint:
                        raise err(
                            "IDEMPOTENCY_KEY_CONFLICT",
                            "Idempotency-Key was already used with different document content.",
                        )
                    return 200, existing

            if self.store.count_state("queued") >= config.MAX_QUEUE_WAITING:
                self.metrics.rejected_queue_full += 1
                raise err(
                    "QUEUE_FULL",
                    "The submission queue is full; retry later.",
                    retry_after=2,
                )

            job_id = str(uuid.uuid4())
            seq = self.store.next_seq()
            job = self.store.create_job(
                job_id=job_id,
                seq=seq,
                source_kind=source_kind,
                source_name=source_name,
                internal_path=internal_path,
                fingerprint=fingerprint,
                pace_seconds=pace_seconds,
                idempotency_key=idempotency_key,
            )
            self._queue.put_nowait(job_id)
            return 201, self.store.to_public(job)

    # ------------------------------------------------------------------
    # Cancellation
    # ------------------------------------------------------------------
    async def cancel(self, job_id: str) -> tuple[int, dict[str, Any]]:
        job = self.store.get_internal(job_id)
        if job is None:
            raise err("JOB_NOT_FOUND", f"no job with id {job_id}")

        if job["state"] == "queued":
            self.store.update_job(
                job_id,
                state="cancelled",
                cancel_requested=1,
                finished_at=now_iso(),
            )
            return 200, self.store.get_public(job_id)

        if job["state"] == "running":
            self.store.update_job(job_id, cancel_requested=1)
            return 202, self.store.get_public(job_id)

        raise err("JOB_ALREADY_TERMINAL", f"job {job_id} is already in terminal state {job['state']}")

    # ------------------------------------------------------------------
    # Worker loop
    # ------------------------------------------------------------------
    async def _worker_loop(self, worker_id: int) -> None:
        while True:
            job_id = await self._queue.get()
            try:
                await self._process_job(job_id)
            except asyncio.CancelledError:
                raise
            except Exception as exc:  # pragma: no cover - defensive
                job = self.store.get_internal(job_id)
                if job is not None and job["state"] not in config.TERMINAL_STATES:
                    self.store.update_job(
                        job_id,
                        state="failed",
                        error_code="CONVERSION_FAILED",
                        error_message=str(exc) or "unexpected worker error",
                        finished_at=now_iso(),
                    )

    async def _process_job(self, job_id: str) -> None:
        job = self.store.get_internal(job_id)
        if job is None or job["state"] != "queued":
            # Already cancelled (or otherwise not runnable) before we got to it.
            return

        loop = asyncio.get_running_loop()
        pace = float(job["pace_seconds"])
        timeout_budget = config.GATEWAY_JOB_TIMEOUT_SECONDS

        run_start_mono = time.monotonic()
        deadline_mono = run_start_mono + timeout_budget

        self.store.update_job(
            job_id,
            state="running",
            started_at=now_iso(),
            progress=0.02,
        )

        # ---- pace_seconds wait phase (counts toward the job timeout) ----
        if pace > 0:
            step = 0.1
            while True:
                elapsed = time.monotonic() - run_start_mono
                cur = self.store.get_internal(job_id)
                if cur["cancel_requested"]:
                    self.store.update_job(
                        job_id, state="cancelled", finished_at=now_iso()
                    )
                    return
                if time.monotonic() >= deadline_mono:
                    self.store.update_job(
                        job_id,
                        state="failed",
                        error_code="JOB_TIMEOUT",
                        error_message="Job exceeded GATEWAY_JOB_TIMEOUT_SECONDS during pace wait.",
                        finished_at=now_iso(),
                    )
                    return
                if elapsed >= pace:
                    break
                remaining_pace = pace - elapsed
                await asyncio.sleep(min(step, remaining_pace))
                progress = 0.02 + 0.28 * min(1.0, (time.monotonic() - run_start_mono) / pace)
                self.store.update_job(job_id, progress=progress)

        # Re-check cancellation right before starting the actual conversion.
        cur = self.store.get_internal(job_id)
        if cur["cancel_requested"]:
            self.store.update_job(job_id, state="cancelled", finished_at=now_iso())
            return
        if time.monotonic() >= deadline_mono:
            self.store.update_job(
                job_id,
                state="failed",
                error_code="JOB_TIMEOUT",
                error_message="Job exceeded GATEWAY_JOB_TIMEOUT_SECONDS before conversion started.",
                finished_at=now_iso(),
            )
            return

        self.store.update_job(job_id, progress=0.3)

        heartbeat = asyncio.create_task(
            self._heartbeat(job_id, run_start_mono, deadline_mono)
        )

        result_dir = config.GATEWAY_STATE_DIR / "results" / job_id
        remaining = max(0.05, deadline_mono - time.monotonic())
        try:
            future = loop.run_in_executor(
                self._executor,
                conversion.convert_and_persist,
                job["internal_path"],
                result_dir,
                job_id,
            )
            await asyncio.wait_for(future, timeout=remaining)
        except asyncio.TimeoutError:
            heartbeat.cancel()
            self.store.update_job(
                job_id,
                state="failed",
                error_code="JOB_TIMEOUT",
                error_message="Job exceeded GATEWAY_JOB_TIMEOUT_SECONDS during conversion.",
                finished_at=now_iso(),
            )
            return
        except Exception as exc:
            heartbeat.cancel()
            self.store.update_job(
                job_id,
                state="failed",
                error_code="CONVERSION_FAILED",
                error_message=str(exc) or "conversion failed",
                finished_at=now_iso(),
            )
            return
        finally:
            heartbeat.cancel()

        cur = self.store.get_internal(job_id)
        if cur["cancel_requested"]:
            self.store.update_job(job_id, state="cancelled", finished_at=now_iso())
            return

        self.store.update_job(
            job_id,
            state="succeeded",
            progress=1.0,
            finished_at=now_iso(),
        )

    async def _heartbeat(self, job_id: str, run_start_mono: float, deadline_mono: float) -> None:
        """Synthesize monotonically increasing progress while conversion runs
        in the background thread pool (docling has no native progress API)."""
        try:
            while True:
                await asyncio.sleep(0.25)
                total_budget = max(0.001, deadline_mono - run_start_mono)
                elapsed = time.monotonic() - run_start_mono
                frac = min(1.0, elapsed / total_budget)
                progress = 0.3 + 0.65 * frac
                progress = min(progress, 0.97)
                self.store.update_job(job_id, progress=progress)
        except asyncio.CancelledError:
            return
