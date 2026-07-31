"""FastAPI application: routes, request validation, and error handling for
the local asynchronous document-conversion gateway.
"""
from __future__ import annotations

import asyncio
import json
import os
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, File, Form, Header, Request, UploadFile
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, PlainTextResponse, Response, StreamingResponse
from pydantic import BaseModel

import config
from errors import ApiError, err
from gateway import Gateway
from util import now_iso, sha256_bytes, sha256_file, utcnow


app = FastAPI()


def get_gateway(request: Request) -> Gateway:
    return request.app.state.gateway


# ----------------------------------------------------------------------
# Lifecycle
# ----------------------------------------------------------------------
@app.on_event("startup")
async def _startup() -> None:
    gw = Gateway()
    app.state.gateway = gw
    gw.start_workers()


@app.on_event("shutdown")
async def _shutdown() -> None:
    gw: Optional[Gateway] = getattr(app.state, "gateway", None)
    if gw is not None:
        await gw.shutdown()


# ----------------------------------------------------------------------
# Error handling
# ----------------------------------------------------------------------
@app.exception_handler(ApiError)
async def api_error_handler(request: Request, exc: ApiError):
    headers = {}
    if exc.retry_after is not None:
        headers["Retry-After"] = str(exc.retry_after)
    return JSONResponse(status_code=exc.status_code, content=exc.body(), headers=headers)


@app.exception_handler(RequestValidationError)
async def validation_error_handler(request: Request, exc: RequestValidationError):
    msg = "; ".join(
        f"{'.'.join(str(p) for p in e.get('loc', []))}: {e.get('msg', 'invalid')}"
        for e in exc.errors()
    ) or "invalid request"
    return JSONResponse(
        status_code=400,
        content={"error": {"code": "VALIDATION_ERROR", "message": msg}},
    )


# ----------------------------------------------------------------------
# Path validation for /v1/jobs/path
# ----------------------------------------------------------------------
def _validate_source_path(raw_path: str) -> Path:
    if raw_path is None or not raw_path.strip():
        raise err("VALIDATION_ERROR", "source_path is required and must not be blank")

    p = Path(raw_path)
    if not p.is_absolute():
        raise err(
            "PATH_NOT_ALLOWED",
            "source_path must be an absolute path inside the permitted assets directory",
        )

    resolved = os.path.realpath(str(p))
    assets_real = os.path.realpath(str(config.ASSETS_DIR))
    if resolved != assets_real and not resolved.startswith(assets_real + os.sep):
        raise err(
            "PATH_NOT_ALLOWED",
            "source_path is outside the permitted assets directory",
        )

    if not os.path.isfile(resolved):
        raise err("SOURCE_NOT_FOUND", f"source_path does not point to an existing regular file")

    return Path(resolved)


def _validate_pace_seconds(value) -> float:
    if value is None:
        return 0.0
    try:
        pace = float(value)
    except (TypeError, ValueError):
        raise err("VALIDATION_ERROR", "pace_seconds must be numeric")
    if pace != pace or pace < 0 or pace > 30:  # NaN check via pace != pace
        raise err("VALIDATION_ERROR", "pace_seconds must be within [0, 30]")
    return pace


def _idem_key(idempotency_key: Optional[str]) -> Optional[str]:
    if idempotency_key is None:
        return None
    idempotency_key = idempotency_key.strip()
    return idempotency_key or None


# ----------------------------------------------------------------------
# Submission endpoints
# ----------------------------------------------------------------------
@app.post("/v1/jobs/upload")
async def submit_upload(
    request: Request,
    file: UploadFile = File(...),
    pace_seconds: Optional[str] = Form(None),
    idempotency_key: Optional[str] = Header(default=None, alias="Idempotency-Key"),
):
    gw = get_gateway(request)

    if file is None or not file.filename:
        raise err("VALIDATION_ERROR", "a 'file' part with a filename is required")

    pace = _validate_pace_seconds(pace_seconds)
    key = _idem_key(idempotency_key)

    data = await file.read()
    fingerprint = sha256_bytes(data)
    source_name = os.path.basename(file.filename)

    # Persist bytes up front so the (possibly delayed) worker can read them,
    # and so uploaded content survives a restart while queued/running.
    upload_dir = config.GATEWAY_STATE_DIR / "uploads" / f"pending-{os.urandom(8).hex()}"
    upload_dir.mkdir(parents=True, exist_ok=True)
    internal_path = upload_dir / source_name
    internal_path.write_bytes(data)

    status, job = await gw.submit(
        source_kind="upload",
        source_name=source_name,
        fingerprint=fingerprint,
        internal_path=str(internal_path),
        pace_seconds=pace,
        idempotency_key=key,
    )
    return JSONResponse(status_code=status, content=job)


class PathJobRequest(BaseModel):
    source_path: str
    pace_seconds: Optional[float] = 0.0


@app.post("/v1/jobs/path")
async def submit_path(
    request: Request,
    body: PathJobRequest,
    idempotency_key: Optional[str] = Header(default=None, alias="Idempotency-Key"),
):
    gw = get_gateway(request)

    resolved_path = _validate_source_path(body.source_path)
    pace = _validate_pace_seconds(body.pace_seconds)
    key = _idem_key(idempotency_key)

    fingerprint = sha256_file(resolved_path)
    source_name = os.path.basename(str(resolved_path))

    status, job = await gw.submit(
        source_kind="path",
        source_name=source_name,
        fingerprint=fingerprint,
        internal_path=str(resolved_path),
        pace_seconds=pace,
        idempotency_key=key,
    )
    return JSONResponse(status_code=status, content=job)


# ----------------------------------------------------------------------
# Job read / list / cancel
# ----------------------------------------------------------------------
@app.get("/v1/jobs/{job_id}")
async def get_job(request: Request, job_id: str):
    gw = get_gateway(request)
    job = gw.store.get_public(job_id)
    if job is None:
        raise err("JOB_NOT_FOUND", f"no job with id {job_id}")
    return job


@app.get("/v1/jobs")
async def list_jobs(request: Request, state: Optional[str] = None, limit: Optional[str] = None):
    gw = get_gateway(request)

    if state is not None and state not in config.STATES:
        raise err("VALIDATION_ERROR", f"state must be one of {config.STATES}")

    limit_val = 50
    if limit is not None:
        try:
            limit_val = int(limit)
        except ValueError:
            raise err("VALIDATION_ERROR", "limit must be an integer")
        if limit_val < 1 or limit_val > 100:
            raise err("VALIDATION_ERROR", "limit must be within [1, 100]")

    jobs = gw.store.list_jobs(state, limit_val)
    public_jobs = [gw.store.to_public(j) for j in jobs]
    return {"count": len(public_jobs), "jobs": public_jobs}


@app.post("/v1/jobs/{job_id}/cancel")
async def cancel_job(request: Request, job_id: str):
    gw = get_gateway(request)
    status, job = await gw.cancel(job_id)
    return JSONResponse(status_code=status, content=job)


# ----------------------------------------------------------------------
# Result retrieval
# ----------------------------------------------------------------------
@app.get("/v1/jobs/{job_id}/result")
async def get_result(request: Request, job_id: str, format: str = "markdown"):
    gw = get_gateway(request)

    if format not in config.RESULT_FORMATS:
        raise err("INVALID_FORMAT", f"format must be one of {config.RESULT_FORMATS}")

    job = gw.store.get_public(job_id)
    if job is None:
        raise err("JOB_NOT_FOUND", f"no job with id {job_id}")

    if job["state"] in ("queued", "running"):
        raise err("JOB_NOT_FINISHED", f"job {job_id} has not finished yet")
    if job["state"] in ("failed", "cancelled"):
        raise err("RESULT_UNAVAILABLE", f"job {job_id} has no result (state={job['state']})")

    result_dir = config.GATEWAY_STATE_DIR / "results" / job_id
    headers = {"X-Job-Id": job_id}

    if format == "markdown":
        path = result_dir / "markdown.md"
        text = path.read_text(encoding="utf-8")
        return PlainTextResponse(content=text, media_type="text/markdown; charset=utf-8", headers=headers)
    elif format == "json":
        path = result_dir / "document.json"
        text = path.read_text(encoding="utf-8")
        return Response(content=text, media_type="application/json", headers=headers)
    else:
        path = result_dir / "chunks.json"
        text = path.read_text(encoding="utf-8")
        return Response(content=text, media_type="application/json", headers=headers)


# ----------------------------------------------------------------------
# Events (ndjson progress stream)
# ----------------------------------------------------------------------
@app.get("/v1/jobs/{job_id}/events")
async def job_events(request: Request, job_id: str):
    gw = get_gateway(request)
    job = gw.store.get_public(job_id)
    if job is None:
        raise err("JOB_NOT_FOUND", f"no job with id {job_id}")

    async def gen():
        seq = 0
        last_state = None
        last_progress = None
        while True:
            job = gw.store.get_public(job_id)
            if job is None:
                return
            if seq == 0 or job["state"] != last_state or job["progress"] != last_progress:
                line = {
                    "seq": seq,
                    "job_id": job_id,
                    "state": job["state"],
                    "progress": job["progress"],
                    "ts": now_iso(),
                }
                yield (json.dumps(line) + "\n").encode("utf-8")
                seq += 1
                last_state = job["state"]
                last_progress = job["progress"]
                if job["state"] in config.TERMINAL_STATES:
                    return
            await gw.store.wait_for_change(job_id, timeout=1.0)

    return StreamingResponse(gen(), media_type="application/x-ndjson")


# ----------------------------------------------------------------------
# Health & metrics
# ----------------------------------------------------------------------
@app.get("/healthz")
async def healthz(request: Request):
    gw: Optional[Gateway] = getattr(request.app.state, "gateway", None)
    if gw is None:
        return JSONResponse(
            status_code=200,
            content={
                "status": "ok",
                "workers": config.MAX_RUNNING,
                "queue_capacity": config.MAX_QUEUE_WAITING,
                "queue_depth": 0,
                "running": 0,
                "uptime_seconds": 0.0,
            },
        )
    return {
        "status": "ok",
        "workers": config.MAX_RUNNING,
        "queue_capacity": config.MAX_QUEUE_WAITING,
        "queue_depth": gw.store.count_state("queued"),
        "running": gw.store.count_state("running"),
        "uptime_seconds": round(gw.uptime_seconds(), 3),
    }


@app.get("/metrics")
async def metrics(request: Request):
    gw = get_gateway(request)
    terminal = gw.store.counts_terminal()
    return {
        "submitted": gw.store.total_submitted(),
        "succeeded": terminal["succeeded"],
        "failed": terminal["failed"],
        "cancelled": terminal["cancelled"],
        "rejected_queue_full": gw.metrics.rejected_queue_full,
        "idempotent_hits": gw.metrics.idempotent_hits,
        "queued_now": gw.store.count_state("queued"),
        "running_now": gw.store.count_state("running"),
    }
