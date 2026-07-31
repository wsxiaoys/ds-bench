# Local Asynchronous Document-Conversion Gateway

An internal, fully offline HTTP gateway that turns document conversion into *managed asynchronous jobs* using the pinned `docling` library. Clients can submit documents, poll or stream progress, cancel work, and fetch results in multiple representations (Markdown, structured JSON, and semantic chunks) long after the conversion has finished.

## Design & Architecture

```mermaid
graph TD
    Client[Client] -->|POST /v1/jobs/upload| API[FastAPI Gateway]
    Client -->|POST /v1/jobs/path| API
    API -->|Validate & Check Idempotency| DB[(Durable Store)]
    API -->|Enqueue| Queue[asyncio.Queue max=4]
    Queue -->|FIFO Dequeue| Worker1[Worker Thread 1]
    Queue -->|FIFO Dequeue| Worker2[Worker Thread 2]
    Worker1 -->|Docling Convert| DB
    Worker2 -->|Docling Convert| DB
    Client -->|GET /v1/jobs/{id}/events| API
    API -->|Pub/Sub| Client
```

### 1. Bounded Worker/Queue Model & Backpressure
- **Capacity**: At most **2** jobs may be in the `running` state at any moment (processed by 2 background worker tasks). At most **4** jobs may wait in the queue in the `queued` state.
- **Backpressure**: When a client submits a new job, the gateway checks the current queue depth (number of active jobs in `queued` state). If the queue is saturated (i.e., `queued_now >= 4`), the submission is rejected with **HTTP 429 Too Many Requests**, the custom error code `QUEUE_FULL`, and a `Retry-After: 5` response header.
- **Idempotency Exception**: An idempotent replay of a known key bypasses the backpressure check and always returns the original job object with **HTTP 200 OK**, even if the queue is full.

### 2. Idempotency Contract
- Submission endpoints support an optional `Idempotency-Key` header.
- Replaying a submission with an existing key returns **HTTP 200 OK** with the original job object.
- If the replayed submission carries a document whose SHA-256 fingerprint differs from the originally stored one, the gateway returns **HTTP 409 Conflict** with the error code `IDEMPOTENCY_KEY_CONFLICT`.

### 3. Graceful Shutdown & Durability
- **Startup Repair**: On gateway startup, any job found in the durable store in a `queued` or `running` state is repaired into the `failed` state with the error code `INTERRUPTED` and a non-null `finished_at` timestamp.
- **Atomic Writes**: All job records, idempotency keys, and finished results are written atomically using temporary files to prevent state corruption during sudden restarts or crashes.
- **Graceful Exit**: The gateway process responds to `SIGTERM` and shuts down cleanly, stopping workers and closing active connections.

### 4. Streaming Progress Feed
- The `GET /v1/jobs/{job_id}/events` endpoint serves a newline-delimited JSON (`application/x-ndjson`) stream.
- The stream emits the initial state immediately, updates whenever the job state or progress changes, and ends by itself once the job reaches a terminal state.

---

## API Reference

### Submission Endpoints
- `POST /v1/jobs/upload` — Submit a document via `multipart/form-data` with a required `file` part and an optional `pace_seconds` part.
- `POST /v1/jobs/path` — Submit a document by path with a JSON body `{"source_path": "<absolute path>", "pace_seconds": <number>}`. Only paths inside `/home/user/project/assets` are permitted.

### Job Management & Retrieval
- `GET /v1/jobs/{job_id}` — Get the full job object.
- `GET /v1/jobs?state=<state>&limit=<n>` — List jobs filtered by state, ordered by sequence number descending.
- `POST /v1/jobs/{job_id}/cancel` — Cancel a queued or running job.
- `GET /v1/jobs/{job_id}/events` — Stream real-time progress events.

### Results
- `GET /v1/jobs/{job_id}/result?format=<markdown|json|chunks>` — Retrieve finished conversion results.
  - `markdown`: Rendered Markdown representation.
  - `json`: Structured dictionary representation of the document.
  - `chunks`: Structure-aware semantic chunks with section-heading trails.

### Health & Metrics
- `GET /healthz` — Liveness and capacity status.
- `GET /metrics` — Operational counters and queue depth.
