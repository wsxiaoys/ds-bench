import os
import sys
import time
import uuid
import json
import hashlib
import logging
import asyncio
import tempfile
import io
from datetime import datetime, timezone
from typing import Any, Dict

from fastapi import FastAPI, UploadFile, File, Form, Header, Response
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException

from docling.document_converter import DocumentConverter
from docling.datamodel.base_models import DocumentStream
from docling_core.transforms.chunker.hierarchical_chunker import HierarchicalChunker

# Setup basic logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

# Environment Variables
GATEWAY_PORT = int(os.environ.get("GATEWAY_PORT", 8077))
GATEWAY_STATE_DIR = os.environ.get("GATEWAY_STATE_DIR", "/home/user/project/state")
GATEWAY_JOB_TIMEOUT_SECONDS = float(os.environ.get("GATEWAY_JOB_TIMEOUT_SECONDS", 120))

# Ensure state directory exists
os.makedirs(GATEWAY_STATE_DIR, exist_ok=True)

# Global State
uptime_start = time.time()
rejected_queue_full_count = 0
idempotent_hits_count = 0

active_jobs = {}          # job_id -> job_dict (queued or running)
active_cancel_events = {} # job_id -> asyncio.Event
job_queue = asyncio.Queue()
seq_lock = asyncio.Lock()
next_seq = 1
converter = None

# Pub/Sub for job progress events
class JobEventRegistry:
    def __init__(self):
        self.subscribers = {}  # job_id -> list of asyncio.Queue

    def subscribe(self, job_id: str, queue: asyncio.Queue):
        if job_id not in self.subscribers:
            self.subscribers[job_id] = []
        self.subscribers[job_id].append(queue)

    def unsubscribe(self, job_id: str, queue: asyncio.Queue):
        if job_id in self.subscribers:
            self.subscribers[job_id].remove(queue)
            if not self.subscribers[job_id]:
                del self.subscribers[job_id]

    def notify(self, job_id: str, job_data: dict):
        if job_id in self.subscribers:
            for queue in self.subscribers[job_id]:
                queue.put_nowait(job_data)

registry = JobEventRegistry()

# Atomic File Writing Helpers
def write_json_atomic(filepath: str, data: dict):
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    dir_name = os.path.dirname(filepath)
    with tempfile.NamedTemporaryFile("w", dir=dir_name, delete=False, encoding="utf-8") as f:
        json.dump(data, f, indent=2)
        temp_name = f.name
    os.replace(temp_name, filepath)

def write_text_atomic(filepath: str, text: str):
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    dir_name = os.path.dirname(filepath)
    with tempfile.NamedTemporaryFile("w", dir=dir_name, delete=False, encoding="utf-8") as f:
        f.write(text)
        temp_name = f.name
    os.replace(temp_name, filepath)

# Date/Time formatting
def get_utc_now_str() -> str:
    s = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")
    return s[:-3] + "Z"

# Input Validation
def validate_pace_seconds(val: Any) -> float:
    if val is None or val == "":
        return 0.0
    if isinstance(val, bool):
        raise ValueError("pace_seconds must be numeric")
    try:
        f_val = float(val)
    except (ValueError, TypeError):
        raise ValueError("pace_seconds must be numeric")
    if not (0 <= f_val <= 30):
        raise ValueError("pace_seconds must be between 0 and 30")
    return f_val

def compute_fingerprint(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest().lower()

def check_path_allowed(source_path: str) -> bool:
    base_dir = os.path.abspath("/home/user/project/assets")
    target_path = os.path.abspath(source_path)
    prefix = base_dir + os.sep
    return target_path.startswith(prefix) or target_path == base_dir

# State Persistence & Recovery Helpers
async def save_job(job: dict):
    filepath = os.path.join(GATEWAY_STATE_DIR, "jobs", f"{job['job_id']}.json")
    await asyncio.to_thread(write_json_atomic, filepath, job)

async def load_job(job_id: str) -> dict:
    if job_id in active_jobs:
        return active_jobs[job_id]
    filepath = os.path.join(GATEWAY_STATE_DIR, "jobs", f"{job_id}.json")
    if not os.path.exists(filepath):
        return None
    try:
        def read_json(path):
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        return await asyncio.to_thread(read_json, filepath)
    except Exception as e:
        logging.error(f"Error loading job {job_id}: {e}")
        return None

async def load_all_jobs() -> list:
    jobs_dir = os.path.join(GATEWAY_STATE_DIR, "jobs")
    if not os.path.exists(jobs_dir):
        return []
    def read_all():
        loaded = []
        for filename in os.listdir(jobs_dir):
            if filename.endswith(".json"):
                try:
                    with open(os.path.join(jobs_dir, filename), "r", encoding="utf-8") as f:
                        loaded.append(json.load(f))
                except Exception:
                    pass
        return loaded
    disk_jobs = await asyncio.to_thread(read_all)
    for job in disk_jobs:
        jid = job["job_id"]
        if jid in active_jobs:
            job.update(active_jobs[jid])
    return disk_jobs

async def repair_interrupted_jobs():
    jobs_dir = os.path.join(GATEWAY_STATE_DIR, "jobs")
    if not os.path.exists(jobs_dir):
        return
    for filename in os.listdir(jobs_dir):
        if filename.endswith(".json"):
            filepath = os.path.join(jobs_dir, filename)
            try:
                with open(filepath, "r", encoding="utf-8") as f:
                    job = json.load(f)
                if job.get("state") in ("queued", "running"):
                    job["state"] = "failed"
                    job["finished_at"] = get_utc_now_str()
                    job["error"] = {
                        "code": "INTERRUPTED",
                        "message": "Job was interrupted by a gateway restart"
                    }
                    if job.get("started_at"):
                        try:
                            started_dt = datetime.fromisoformat(job["started_at"].replace("Z", "+00:00"))
                            finished_dt = datetime.fromisoformat(job["finished_at"].replace("Z", "+00:00"))
                            job["duration_seconds"] = round((finished_dt - started_dt).total_seconds(), 3)
                        except Exception:
                            job["duration_seconds"] = None
                    else:
                        job["duration_seconds"] = None
                    write_json_atomic(filepath, job)
            except Exception as e:
                logging.error(f"Failed to repair job file {filepath}: {e}")

async def init_state():
    global next_seq
    jobs_dir = os.path.join(GATEWAY_STATE_DIR, "jobs")
    max_seq = 0
    if os.path.exists(jobs_dir):
        for filename in os.listdir(jobs_dir):
            if filename.endswith(".json"):
                try:
                    with open(os.path.join(jobs_dir, filename), "r", encoding="utf-8") as f:
                        job = json.load(f)
                        if job.get("seq", 0) > max_seq:
                            max_seq = job["seq"]
                except Exception:
                    pass
    next_seq = max_seq + 1

async def get_next_seq() -> int:
    global next_seq
    async with seq_lock:
        seq = next_seq
        next_seq += 1
        return seq

async def get_durable_counts():
    jobs_dir = os.path.join(GATEWAY_STATE_DIR, "jobs")
    submitted = 0
    succeeded = 0
    failed = 0
    cancelled = 0
    if os.path.exists(jobs_dir):
        for filename in os.listdir(jobs_dir):
            if filename.endswith(".json"):
                submitted += 1
                try:
                    with open(os.path.join(jobs_dir, filename), "r", encoding="utf-8") as f:
                        job_data = json.load(f)
                        state = job_data.get("state")
                        if state == "succeeded":
                            succeeded += 1
                        elif state == "failed":
                            failed += 1
                        elif state == "cancelled":
                            cancelled += 1
                except Exception:
                    pass
    return submitted, succeeded, failed, cancelled

async def is_queue_full() -> bool:
    queued_count = sum(1 for j in active_jobs.values() if j["state"] == "queued")
    return queued_count >= 4

async def handle_idempotency(key: str, fingerprint: str):
    key_hash = hashlib.sha256(key.encode("utf-8")).hexdigest()
    filepath = os.path.join(GATEWAY_STATE_DIR, "idempotency", f"{key_hash}.json")
    if os.path.exists(filepath):
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                record = json.load(f)
            if record.get("fingerprint") != fingerprint:
                return JSONResponse(
                    status_code=409,
                    content={"error": {"code": "IDEMPOTENCY_KEY_CONFLICT", "message": "Idempotency key conflict"}}
                )
            job = await load_job(record.get("job_id"))
            if job:
                global idempotent_hits_count
                idempotent_hits_count += 1
                return JSONResponse(status_code=200, content=job)
        except Exception as e:
            logging.error(f"Error reading idempotency record: {e}")
    return None

async def create_new_job(
    source_kind: str,
    source_name: str,
    fingerprint: str,
    pace_seconds: float,
    idempotency_key: str = None
) -> dict:
    job_id = str(uuid.uuid4())
    seq = await get_next_seq()
    job = {
        "job_id": job_id,
        "seq": seq,
        "state": "queued",
        "source_kind": source_kind,
        "source_name": source_name,
        "fingerprint": fingerprint,
        "pace_seconds": pace_seconds,
        "progress": 0.0,
        "created_at": get_utc_now_str(),
        "started_at": None,
        "finished_at": None,
        "duration_seconds": None,
        "cancel_requested": False,
        "error": None
    }
    await save_job(job)
    if idempotency_key:
        key_hash = hashlib.sha256(idempotency_key.encode("utf-8")).hexdigest()
        idemp_dir = os.path.join(GATEWAY_STATE_DIR, "idempotency")
        os.makedirs(idemp_dir, exist_ok=True)
        record = {
            "key": idempotency_key,
            "job_id": job_id,
            "fingerprint": fingerprint
        }
        write_json_atomic(os.path.join(idemp_dir, f"{key_hash}.json"), record)
    active_jobs[job_id] = job
    registry.notify(job_id, job)
    return job

# Conversion & Chunking Logic
def init_converter():
    global converter
    converter = DocumentConverter()

def generate_chunks(doc) -> list:
    chunker = HierarchicalChunker()
    chunks = list(chunker.chunk(doc))
    serialized_chunks = []
    idx = 0
    for chunk in chunks:
        text = chunk.text or ""
        if not text:
            continue
        headings = chunk.meta.headings if chunk.meta and chunk.meta.headings else []
        serialized_chunks.append({
            "index": idx,
            "text": text,
            "headings": list(headings),
            "char_len": len(text)
        })
        idx += 1
    return serialized_chunks

def perform_conversion(job: dict, source_data: Any):
    if job["source_kind"] == "upload":
        stream = io.BytesIO(source_data)
        doc_stream = DocumentStream(name=job["source_name"], stream=stream)
        return converter.convert(doc_stream)
    else:
        return converter.convert(source_data)

def process_conversion_result(result) -> tuple:
    markdown_str = result.document.export_to_markdown()
    doc_dict = result.document.export_to_dict()
    chunks_list = generate_chunks(result.document)
    return markdown_str, doc_dict, chunks_list

def save_job_results(job_id: str, markdown_str: str, doc_dict: dict, chunks_list: list):
    results_dir = os.path.join(GATEWAY_STATE_DIR, "results", job_id)
    os.makedirs(results_dir, exist_ok=True)
    write_text_atomic(os.path.join(results_dir, "markdown.md"), markdown_str)
    write_json_atomic(os.path.join(results_dir, "document.json"), doc_dict)
    write_json_atomic(os.path.join(results_dir, "chunks.json"), chunks_list)

# Background Worker Implementation
async def progress_updater(job: dict, start_time: float, stop_event: asyncio.Event):
    while not stop_event.is_set():
        try:
            await asyncio.sleep(0.5)
            if stop_event.is_set():
                break
            if job["state"] != "running":
                break
            elapsed = time.time() - start_time
            new_progress = min(0.95, 0.05 + 0.9 * (elapsed / 10.0))
            job["progress"] = round(new_progress, 2)
            await save_job(job)
            registry.notify(job["job_id"], job)
        except asyncio.CancelledError:
            break
        except Exception as e:
            logging.error(f"Error in progress updater: {e}")

async def run_job(job: dict, source_data: Any, cancel_event: asyncio.Event):
    start_time = time.time()
    job["started_at"] = get_utc_now_str()
    job["state"] = "running"
    job["progress"] = 0.05
    await save_job(job)
    registry.notify(job["job_id"], job)

    # 1. Pace Seconds Delay
    pace_seconds = job["pace_seconds"]
    if pace_seconds > 0:
        pace_start = time.time()
        cancelled_during_pace = False
        while time.time() - pace_start < pace_seconds:
            if job["cancel_requested"] or cancel_event.is_set():
                cancelled_during_pace = True
                break
            if time.time() - start_time >= GATEWAY_JOB_TIMEOUT_SECONDS:
                break
            await asyncio.sleep(0.1)
        if cancelled_during_pace or job["cancel_requested"]:
            job["state"] = "cancelled"
            job["finished_at"] = get_utc_now_str()
            job["duration_seconds"] = round(time.time() - start_time, 3)
            await save_job(job)
            active_jobs.pop(job["job_id"], None)
            registry.notify(job["job_id"], job)
            return

    # Check timeout after pace
    elapsed = time.time() - start_time
    if elapsed >= GATEWAY_JOB_TIMEOUT_SECONDS:
        job["state"] = "failed"
        job["error"] = {"code": "JOB_TIMEOUT", "message": "Job exceeded timeout budget"}
        job["finished_at"] = get_utc_now_str()
        job["duration_seconds"] = round(elapsed, 3)
        await save_job(job)
        active_jobs.pop(job["job_id"], None)
        registry.notify(job["job_id"], job)
        return

    # 2. Conversion
    stop_progress_event = asyncio.Event()
    progress_task = asyncio.create_task(progress_updater(job, start_time, stop_progress_event))
    remaining_timeout = GATEWAY_JOB_TIMEOUT_SECONDS - elapsed

    def convert_and_process():
        res = perform_conversion(job, source_data)
        return process_conversion_result(res)

    conversion_task = asyncio.create_task(asyncio.to_thread(convert_and_process))
    cancel_wait_task = asyncio.create_task(cancel_event.wait())

    done, pending = await asyncio.wait(
        {conversion_task, cancel_wait_task},
        timeout=remaining_timeout,
        return_when=asyncio.FIRST_COMPLETED
    )

    stop_progress_event.set()
    await progress_task

    for task in pending:
        task.cancel()

    elapsed_total = time.time() - start_time

    if cancel_wait_task in done or job["cancel_requested"]:
        job["state"] = "cancelled"
        job["finished_at"] = get_utc_now_str()
        job["duration_seconds"] = round(elapsed_total, 3)
        await save_job(job)
        active_jobs.pop(job["job_id"], None)
        registry.notify(job["job_id"], job)
    elif conversion_task in done:
        try:
            markdown_str, doc_dict, chunks_list = conversion_task.result()
            await asyncio.to_thread(save_job_results, job["job_id"], markdown_str, doc_dict, chunks_list)
            job["state"] = "succeeded"
            job["progress"] = 1.0
            job["finished_at"] = get_utc_now_str()
            job["duration_seconds"] = round(elapsed_total, 3)
            await save_job(job)
            active_jobs.pop(job["job_id"], None)
            registry.notify(job["job_id"], job)
        except Exception as e:
            job["state"] = "failed"
            job["error"] = {"code": "CONVERSION_FAILED", "message": str(e)}
            job["finished_at"] = get_utc_now_str()
            job["duration_seconds"] = round(elapsed_total, 3)
            await save_job(job)
            active_jobs.pop(job["job_id"], None)
            registry.notify(job["job_id"], job)
    else:
        job["state"] = "failed"
        job["error"] = {"code": "JOB_TIMEOUT", "message": "Job exceeded timeout budget"}
        job["finished_at"] = get_utc_now_str()
        job["duration_seconds"] = round(elapsed_total, 3)
        await save_job(job)
        active_jobs.pop(job["job_id"], None)
        registry.notify(job["job_id"], job)

async def worker_loop(worker_id: int):
    while True:
        try:
            job_id, source_kind, source_data = await job_queue.get()
        except asyncio.CancelledError:
            break
        try:
            job = await load_job(job_id)
            if not job:
                continue
            if job["state"] == "cancelled":
                continue
            cancel_event = asyncio.Event()
            active_cancel_events[job_id] = cancel_event
            await run_job(job, source_data, cancel_event)
            active_cancel_events.pop(job_id, None)
        except Exception as e:
            logging.exception(f"Error in worker {worker_id}: {e}")
        finally:
            job_queue.task_done()

# Lifespan Context Manager
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    os.makedirs(GATEWAY_STATE_DIR, exist_ok=True)
    await repair_interrupted_jobs()
    await init_state()
    init_converter()
    workers = [asyncio.create_task(worker_loop(i)) for i in range(2)]
    yield
    for worker in workers:
        worker.cancel()
    await asyncio.gather(*workers, return_exceptions=True)

# FastAPI Application
app = FastAPI(lifespan=lifespan)

# Custom Exception Handlers
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc):
    messages = []
    for err in exc.errors():
        loc = " -> ".join(str(x) for x in err.get("loc", []))
        msg = err.get("msg", "Validation error")
        messages.append(f"{loc}: {msg}")
    message = "; ".join(messages) or "Validation error"
    return JSONResponse(
        status_code=400,
        content={"error": {"code": "VALIDATION_ERROR", "message": message}}
    )

@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request, exc):
    code = "VALIDATION_ERROR"
    if exc.status_code == 404:
        code = "SOURCE_NOT_FOUND"
    elif exc.status_code == 403:
        code = "PATH_NOT_ALLOWED"
    elif exc.status_code == 429:
        code = "QUEUE_FULL"
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": {"code": code, "message": exc.detail}}
    )

# Routes
@app.get("/healthz")
async def healthz():
    queue_depth = sum(1 for j in active_jobs.values() if j["state"] == "queued")
    running = sum(1 for j in active_jobs.values() if j["state"] == "running")
    uptime = time.time() - uptime_start
    return {
        "status": "ok",
        "workers": 2,
        "queue_capacity": 4,
        "queue_depth": queue_depth,
        "running": running,
        "uptime_seconds": round(uptime, 3)
    }

@app.get("/metrics")
async def metrics():
    submitted, succeeded, failed, cancelled = await get_durable_counts()
    queued_now = sum(1 for j in active_jobs.values() if j["state"] == "queued")
    running_now = sum(1 for j in active_jobs.values() if j["state"] == "running")
    return {
        "submitted": submitted,
        "succeeded": succeeded,
        "failed": failed,
        "cancelled": cancelled,
        "rejected_queue_full": rejected_queue_full_count,
        "idempotent_hits": idempotent_hits_count,
        "queued_now": queued_now,
        "running_now": running_now
    }

@app.post("/v1/jobs/upload", status_code=201)
async def upload_job(
    file: UploadFile = File(None),
    pace_seconds: str = Form(None),
    idempotency_key: str = Header(None, alias="Idempotency-Key")
):
    if file is None or not file.filename:
        return JSONResponse(
            status_code=400,
            content={"error": {"code": "VALIDATION_ERROR", "message": "Missing file part or filename"}}
        )
    try:
        parsed_pace = validate_pace_seconds(pace_seconds)
    except ValueError as e:
        return JSONResponse(
            status_code=400,
            content={"error": {"code": "VALIDATION_ERROR", "message": str(e)}}
        )
    content = await file.read()
    fingerprint = compute_fingerprint(content)
    if idempotency_key is not None:
        res = await handle_idempotency(idempotency_key, fingerprint)
        if res is not None:
            return res
    if await is_queue_full():
        global rejected_queue_full_count
        rejected_queue_full_count += 1
        return JSONResponse(
            status_code=429,
            content={"error": {"code": "QUEUE_FULL", "message": "Queue is full"}},
            headers={"Retry-After": "5"}
        )
    job = await create_new_job(
        source_kind="upload",
        source_name=os.path.basename(file.filename),
        fingerprint=fingerprint,
        pace_seconds=parsed_pace,
        idempotency_key=idempotency_key
    )
    await job_queue.put((job["job_id"], "upload", content))
    return JSONResponse(status_code=201, content=job)

@app.post("/v1/jobs/path", status_code=201)
async def path_job(
    req: dict = None,
    idempotency_key: str = Header(None, alias="Idempotency-Key")
):
    if req is None:
        return JSONResponse(
            status_code=400,
            content={"error": {"code": "VALIDATION_ERROR", "message": "Missing request body"}}
        )
    source_path = req.get("source_path")
    pace_seconds = req.get("pace_seconds")
    if source_path is None or not isinstance(source_path, str) or not source_path.strip():
        return JSONResponse(
            status_code=400,
            content={"error": {"code": "VALIDATION_ERROR", "message": "source_path must be a non-empty string"}}
        )
    try:
        parsed_pace = validate_pace_seconds(pace_seconds)
    except ValueError as e:
        return JSONResponse(
            status_code=400,
            content={"error": {"code": "VALIDATION_ERROR", "message": str(e)}}
        )
    if not os.path.isabs(source_path):
        return JSONResponse(
            status_code=400,
            content={"error": {"code": "VALIDATION_ERROR", "message": "source_path must be an absolute path"}}
        )
    if not check_path_allowed(source_path):
        return JSONResponse(
            status_code=403,
            content={"error": {"code": "PATH_NOT_ALLOWED", "message": "Path is not allowed"}}
        )
    if not os.path.isfile(source_path):
        return JSONResponse(
            status_code=404,
            content={"error": {"code": "SOURCE_NOT_FOUND", "message": "Source file not found"}}
        )
    try:
        with open(source_path, "rb") as f:
            content = f.read()
    except Exception as e:
        return JSONResponse(
            status_code=400,
            content={"error": {"code": "VALIDATION_ERROR", "message": f"Could not read source file: {e}"}}
        )
    fingerprint = compute_fingerprint(content)
    if idempotency_key is not None:
        res = await handle_idempotency(idempotency_key, fingerprint)
        if res is not None:
            return res
    if await is_queue_full():
        global rejected_queue_full_count
        rejected_queue_full_count += 1
        return JSONResponse(
            status_code=429,
            content={"error": {"code": "QUEUE_FULL", "message": "Queue is full"}},
            headers={"Retry-After": "5"}
        )
    job = await create_new_job(
        source_kind="path",
        source_name=os.path.basename(source_path),
        fingerprint=fingerprint,
        pace_seconds=parsed_pace,
        idempotency_key=idempotency_key
    )
    await job_queue.put((job["job_id"], "path", source_path))
    return JSONResponse(status_code=201, content=job)

@app.get("/v1/jobs/{job_id}")
async def get_job(job_id: str):
    job = await load_job(job_id)
    if not job:
        return JSONResponse(
            status_code=404,
            content={"error": {"code": "JOB_NOT_FOUND", "message": "Job not found"}}
        )
    return job

@app.get("/v1/jobs")
async def list_jobs(state: str = None, limit: str = "50"):
    if state is not None and state not in ("queued", "running", "succeeded", "failed", "cancelled"):
        return JSONResponse(
            status_code=400,
            content={"error": {"code": "VALIDATION_ERROR", "message": "Invalid state filter"}}
        )
    try:
        limit_val = int(limit)
    except ValueError:
        return JSONResponse(
            status_code=400,
            content={"error": {"code": "VALIDATION_ERROR", "message": "Limit must be an integer"}}
        )
    if not (1 <= limit_val <= 100):
        return JSONResponse(
            status_code=400,
            content={"error": {"code": "VALIDATION_ERROR", "message": "Limit must be between 1 and 100"}}
        )
    jobs = await load_all_jobs()
    if state is not None:
        jobs = [j for j in jobs if j["state"] == state]
    jobs.sort(key=lambda j: j["seq"], reverse=True)
    jobs = jobs[:limit_val]
    return {"count": len(jobs), "jobs": jobs}

@app.get("/v1/jobs/{job_id}/result")
async def get_job_result(job_id: str, format: str = "markdown"):
    if format not in ("markdown", "json", "chunks"):
        return JSONResponse(
            status_code=400,
            content={"error": {"code": "INVALID_FORMAT", "message": "Invalid format requested"}}
        )
    job = await load_job(job_id)
    if not job:
        return JSONResponse(
            status_code=404,
            content={"error": {"code": "JOB_NOT_FOUND", "message": "Job not found"}}
        )
    if job["state"] in ("queued", "running"):
        return JSONResponse(
            status_code=409,
            content={"error": {"code": "JOB_NOT_FINISHED", "message": "Job has not finished yet"}}
        )
    if job["state"] in ("failed", "cancelled"):
        return JSONResponse(
            status_code=409,
            content={"error": {"code": "RESULT_UNAVAILABLE", "message": "Result is unavailable for failed or cancelled jobs"}}
        )
    results_dir = os.path.join(GATEWAY_STATE_DIR, "results", job_id)
    headers = {"X-Job-Id": job_id}
    if format == "markdown":
        filepath = os.path.join(results_dir, "markdown.md")
        if not os.path.exists(filepath):
            return JSONResponse(
                status_code=404,
                content={"error": {"code": "SOURCE_NOT_FOUND", "message": "Result file not found"}}
            )
        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()
        return Response(content=content, media_type="text/markdown; charset=utf-8", headers=headers)
    elif format == "json":
        filepath = os.path.join(results_dir, "document.json")
        if not os.path.exists(filepath):
            return JSONResponse(
                status_code=404,
                content={"error": {"code": "SOURCE_NOT_FOUND", "message": "Result file not found"}}
            )
        with open(filepath, "r", encoding="utf-8") as f:
            doc_data = json.load(f)
        return JSONResponse(
            content={"job_id": job_id, "format": "json", "document": doc_data},
            headers=headers
        )
    elif format == "chunks":
        filepath = os.path.join(results_dir, "chunks.json")
        if not os.path.exists(filepath):
            return JSONResponse(
                status_code=404,
                content={"error": {"code": "SOURCE_NOT_FOUND", "message": "Result file not found"}}
            )
        with open(filepath, "r", encoding="utf-8") as f:
            chunks_data = json.load(f)
        return JSONResponse(
            content={"job_id": job_id, "format": "chunks", "count": len(chunks_data), "chunks": chunks_data},
            headers=headers
        )

@app.post("/v1/jobs/{job_id}/cancel")
async def cancel_job(job_id: str):
    job = await load_job(job_id)
    if not job:
        return JSONResponse(
            status_code=404,
            content={"error": {"code": "JOB_NOT_FOUND", "message": "Job not found"}}
        )
    if job["state"] in ("succeeded", "failed", "cancelled"):
        return JSONResponse(
            status_code=409,
            content={"error": {"code": "JOB_ALREADY_TERMINAL", "message": "Job is already terminal"}}
        )
    if job["state"] == "queued":
        job["state"] = "cancelled"
        job["finished_at"] = get_utc_now_str()
        await save_job(job)
        active_jobs.pop(job_id, None)
        registry.notify(job_id, job)
        return JSONResponse(status_code=200, content=job)
    elif job["state"] == "running":
        job["cancel_requested"] = True
        await save_job(job)
        registry.notify(job_id, job)
        if job_id in active_cancel_events:
            active_cancel_events[job_id].set()
        return JSONResponse(status_code=202, content=job)

async def event_generator(job_id: str, initial_job_data: dict):
    queue = asyncio.Queue()
    registry.subscribe(job_id, queue)
    stream_seq = 0
    last_progress = initial_job_data["progress"]
    try:
        yield json.dumps({
            "seq": stream_seq,
            "job_id": job_id,
            "state": initial_job_data["state"],
            "progress": initial_job_data["progress"],
            "ts": get_utc_now_str()
        }) + "\n"
        stream_seq += 1
        if initial_job_data["state"] in ("succeeded", "failed", "cancelled"):
            return
        while True:
            job_data = await queue.get()
            progress = max(last_progress, job_data["progress"])
            last_progress = progress
            yield json.dumps({
                "seq": stream_seq,
                "job_id": job_id,
                "state": job_data["state"],
                "progress": progress,
                "ts": get_utc_now_str()
            }) + "\n"
            stream_seq += 1
            if job_data["state"] in ("succeeded", "failed", "cancelled"):
                break
    finally:
        registry.unsubscribe(job_id, queue)

@app.get("/v1/jobs/{job_id}/events")
async def get_job_events(job_id: str):
    job = await load_job(job_id)
    if not job:
        return JSONResponse(
            status_code=404,
            content={"error": {"code": "JOB_NOT_FOUND", "message": "Job not found"}}
        )
    return StreamingResponse(
        event_generator(job_id, job),
        media_type="application/x-ndjson"
    )

if __name__ == "__main__":
    import uvicorn
    # Add project root to sys.path to allow imports if main.py is run directly
    sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
    uvicorn.run("service.main:app", host="127.0.0.1", port=GATEWAY_PORT, log_level="info")
