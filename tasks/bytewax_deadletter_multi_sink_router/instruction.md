# Validating ETL Router with Dead-Letter Sink (Bytewax)

## Background
You are building a streaming ETL router with **Bytewax** (a Python-native stateful stream-processing framework). The pipeline ingests a file of heterogeneous, possibly-corrupt JSON-line records, validates and normalizes the good ones, routes them into per-category output files, and diverts every bad record into a dead-letter file annotated with a precise, machine-readable failure reason. It also emits a run summary of counts.

## Requirements
- Implement a Bytewax dataflow that reads the input file line by line (in file order), classifies each line, normalizes valid records, routes valid records to the correct per-category sink, sends invalid/malformed records to a dead-letter sink, and writes an aggregate metrics summary.
- The pipeline must be runnable repeatedly and must be fully deterministic for a given input file.

## Implementation Hints
- Project path: `/home/user/etl_router`
- Use `bytewax==0.21.1`. The dataflow object must be a `bytewax.dataflow.Dataflow` bound to a module-level variable named `flow` in the file `/home/user/etl_router/pipeline.py`.
- Run command (executed from the project path, single worker / default): `python -m bytewax.run pipeline:flow`
- Input file: `/home/user/etl_router/data/input.jsonl`. Treat every physical line of this file as one input record, in order, with the first line numbered `1`. Do not skip blank lines: a blank or whitespace-only line is an input record that fails validation.
- Output files (all under `/home/user/etl_router/out/`, created by running the pipeline):
  - `orders.jsonl`, `payments.jsonl`, `refunds.jsonl` — valid normalized records for each category, one compact JSON object per line, in input order.
  - `dead_letter.jsonl` — one compact JSON object per rejected record, in input order.
  - `metrics.json` — a single JSON object (one line) summarizing the whole run.

### Category and value domains
- Allowed categories: exactly `orders`, `payments`, `refunds`.
- Allowed currencies: exactly `USD`, `EUR`, `GBP`.
- Required fields on every record: `id`, `category`, `amount`, `currency`.

### Classification rules (evaluated in this exact precedence order; the FIRST failing rule determines the outcome)
1. If the raw line does not parse as JSON, or parses to something other than a JSON object, the record fails with reason `malformed_json`.
2. If a required field is absent, the record fails with reason `missing_field:<field>`, where `<field>` is the first absent field checked in the order `id`, `category`, `amount`, `currency`.
3. If a present field has the wrong type, the record fails with reason `invalid_type:<field>`, checking fields in the order `id`, `category`, `amount`, `currency`. Type rules: `id` must be a JSON string or a JSON integer; `category` must be a string; `amount` must be a JSON number (integer or float); `currency` must be a string. A JSON boolean is NOT an acceptable `id` or `amount`.
4. If `category` is not one of the allowed categories, the record fails with reason `unknown_category:<value>` (where `<value>` is the offending category string).
5. If `amount` is less than or equal to zero, the record fails with reason `invalid_amount:non_positive`.
6. If `currency` is not one of the allowed currencies, the record fails with reason `invalid_currency:<value>` (where `<value>` is the offending currency string).
A record that passes all six rules is valid.

### Normalized valid record shape (written to the category file matching its `category`)
Each valid record is a JSON object with EXACTLY these keys:
- `id`: the original id converted to a string.
- `category`: the original category string.
- `amount_cents`: an integer equal to the amount in cents, i.e. the amount multiplied by 100 and rounded to the nearest integer.
- `currency`: the original currency string.

### Dead-letter record shape (written to `dead_letter.jsonl`)
Each rejected record is a JSON object with EXACTLY these keys:
- `raw`: the exact original line text as read from the input file, with any trailing newline removed.
- `error`: the exact failure-reason string defined by the classification rules above.
- `line`: the 1-based line number of that record in the input file (integer).

### Metrics summary shape (`metrics.json`, a single JSON object)
- `total`: total number of input lines processed (integer). It must equal `valid + dead_letter`.
- `valid`: number of valid records (integer).
- `dead_letter`: number of rejected records (integer).
- `by_category`: an object with a key for EACH of the three allowed categories (`orders`, `payments`, `refunds`), each mapping to the count of valid records routed to that category. All three keys must be present even when the count is `0`.
- `by_error`: an object mapping each failure-reason string that actually occurred to the number of times it occurred. Reasons that did not occur must NOT appear.

