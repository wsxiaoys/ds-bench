# Waspleau-style Metrics Rollup Pipeline

## Background
An on-call team needs a self-hosted operations dashboard: raw measurements are pushed into the app by external collectors, a background worker periodically condenses them into per-metric statistics, and the dashboard only ever displays the condensed results. Build this app with Wasp `0.25.0`. A scaffolded Wasp project and a local PostgreSQL installation are already present in the container; the running app must depend only on services inside the container.

## Requirements
- A sample-ingestion HTTP endpoint that validates input and is safely repeatable (retrying collectors must never create duplicates).
- A background worker named `rollupMetrics` that condenses raw samples into per-metric statistics and persists them.
- A recurring schedule for that worker, plus an endpoint that enqueues it on demand.
- A dashboard HTTP endpoint and a dashboard web page, both showing only the persisted results of the latest rollup.

## Implementation Hints
- Project path: `/home/user/waspmetrics`
- Wasp version: `0.25.0`. The app's data must live in the local PostgreSQL database reachable through the `DATABASE_URL` environment variable that is already exported in the container.
- Start command: `bash /home/user/waspmetrics/start.sh`. This script must be created by you, must run in the foreground, must be non-interactive, and must bring the whole system up from a cold container (database server included, schema applied) so that the app is reachable afterwards. It must also work when re-run later on an already-populated database without destroying stored data.
- Server (HTTP API) port: `3001`. Web client port: `3000`.
- The only metric names the app accepts (the "registered metrics") are exactly `error_rate`, `latency_ms` and `queue_depth`.

### HTTP API (port 3001)

`POST /api/samples` — ingest one raw sample. Request body:

```json
{
  "metric": string,
  "value": number,
  "recordedAt": string
}
```

`recordedAt` is an ISO-8601 UTC timestamp. Every request must carry an `Idempotency-Key` request header. Responses:

- First request for a given `Idempotency-Key`: status `201` with body `{"id": number, "duplicate": false}`, where `id` is the identifier the app assigned to the stored sample.
- Any later request reusing an already-seen `Idempotency-Key`: status `200` with body `{"id": number, "duplicate": true}` where `id` is the identifier returned by the first request, and no additional sample is stored.
- Status `400` with body `{"error": string}` when the `Idempotency-Key` header is missing or empty, when `metric` is not a registered metric, when `value` is missing or is not a finite number, or when `recordedAt` is missing or is not a parsable ISO-8601 timestamp. Rejected requests must not store anything.
- Any `id` or `ingestedAt` field supplied in the request body is untrusted and must never be used as the stored sample's identifier or ingestion timestamp.
- Concurrency invariant: when N requests carrying the same `Idempotency-Key` and the same body are issued simultaneously, exactly one of them returns `201`, all others return `200`, all of them return the same `id`, and exactly one sample ends up stored.

`POST /api/rollup` — enqueue one rollup run. It must return status `202` with body `{"jobId": string, "jobName": "rollupMetrics"}` immediately, without waiting for the rollup to finish. The enqueued work item must carry the argument `{"reason": "manual"}`.

`GET /api/dashboard` — status `200` with a JSON array holding exactly one object per registered metric, ordered by `metric` ascending, each object having exactly the keys `metric`, `count`, `p95`, `avg`, `delta` and `updatedAt`. The returned numbers must be exactly the values persisted by the most recent rollup of that metric; ingesting samples must never change this endpoint's output until a rollup has run. `updatedAt` is the UTC instant at which the rollup persisted that metric's result, formatted as an ISO-8601 string ending in `Z`. For a metric that has never been rolled up, return `count` `0` and `null` for `p95`, `avg`, `delta` and `updatedAt`.

### Rollup semantics

One rollup run processes every registered metric. For a metric with at least one stored sample, let `T` be the greatest `recordedAt` among that metric's stored samples, and define:

- current window: samples with `T - 3600s < recordedAt <= T`
- previous window: samples with `T - 7200s < recordedAt <= T - 3600s`

and persist:

- `count`: the number of samples in the current window.
- `avg`: the arithmetic mean of the current-window values, rounded to 3 decimal places, half away from zero.
- `p95`: the nearest-rank 95th percentile of the current-window values, i.e. sort the current-window values ascending and take the value whose 1-based position is `ceil(0.95 * count)`.
- `delta`: `p95(current window) - p95(previous window)`, rounded to 3 decimal places, half away from zero, or `null` when the previous window contains no samples.

For a registered metric with no stored samples at all, persist `count` `0` and `null` for `p95`, `avg` and `delta`. Every processed metric gets a fresh persisted timestamp on every run. Rollups must never delete or mutate raw samples.

### Background processing

The rollup work item is queued under the exact name `rollupMetrics`, so a work item with that name enqueued by any producer that talks to the app's queue — including one enqueued directly in the database by an external process while the app is running — must be picked up and executed by the running app. In addition, `rollupMetrics` must be registered as a recurring job with the cron expression `23 3 * * *` and the argument `{"reason": "cron"}`.

### Dashboard page (port 3000)

The route `/` must render the dashboard, fetching its data from the server rather than embedding constants. For each registered metric it must render an element carrying the attribute `data-metric="<metric name>"`, and inside that element five descendant elements carrying `data-field="count"`, `data-field="p95"`, `data-field="avg"`, `data-field="delta"` and `data-field="updatedAt"`. Each of those five elements must contain the current value of that field as text, using exactly `-` as the text when the value is `null`.

