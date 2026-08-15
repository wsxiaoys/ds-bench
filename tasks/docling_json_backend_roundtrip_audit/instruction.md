# Docling JSON Round-Trip Audit CLI

## Background

A document-processing team stores `DoclingDocument` JSON files (Docling's own lossless JSON serialization) as the hand-off format between an extraction cluster and a downstream RAG indexer. The drops arrive corrupted in several different ways, and the indexer currently crashes on the first bad file. You must build an offline auditing CLI on top of the pre-installed Docling stack (`docling-slim` 2.115.0 with `docling-core` 2.87.1, Python 3.12) that ingests a whole drop directory, classifies every file, repairs what is repairable, re-emits canonical artifacts, and produces a deterministic machine-readable report. The container has **no network access**: everything must work with the locally installed libraries and the local files only.

## Requirements

- Implement a rerunnable command-line tool that audits a directory of candidate Docling JSON files.
- Every candidate must end up with exactly one classification, and files that only declare an incompatible document-schema version must be recovered instead of rejected.
- Every successfully ingested document must be re-emitted as a canonical JSON artifact and as a Markdown artifact, and both the path-vs-stream ingestion parity and the JSON round-trip stability of each ingested document must be recorded.
- The tool must produce a single JSON report and an exit code that summarizes the audit outcome, and repeated runs over unchanged inputs must produce byte-identical outputs.

## Implementation Hints

- Project path: `/home/user/project`. The audited drop directory that already exists in the project is `assets/inbox`.
- Command: `python -m docaudit.cli --input-dir <dir> --out-dir <dir>`, executed with `/home/user/project` as the working directory. Both options are required and their values may be relative to the working directory or absolute. Create `<out-dir>` (and any parents) if it does not exist.
- Candidates are exactly the files whose name ends with `.json` located directly inside `--input-dir`; sub-directories are not descended into and every other file is ignored.
- The drop directory is read-only input: a run must not modify, add or remove any file inside `--input-dir`.
- Classification statuses, evaluated per candidate in this order, are:
  - `malformed_json` — the file's bytes are not valid UTF-8 or do not parse as JSON.
  - `not_an_object` — the file parses as JSON but its top-level value is not a JSON object.
  - `version_mismatch` — the top-level JSON object cannot be ingested as a `DoclingDocument` because of a document-schema validation failure, and its top-level `version` member is a string whose major component (the text before its first `.`) differs from the major component of the schema version of the installed Docling document model.
  - `schema_invalid` — the top-level JSON object cannot be ingested as a `DoclingDocument` because of a document-schema validation failure that is not a `version_mismatch`.
  - `unreadable` — the top-level JSON object cannot be ingested as a `DoclingDocument` for any other reason.
  - `ok` — the file is ingested as a `DoclingDocument` without any change to its bytes.
- Recovery: a `version_mismatch` candidate must be retried once, with its top-level `version` member replaced by the schema version of the installed Docling document model and the rest of the JSON object left untouched. A candidate whose retry is ingested successfully keeps the status `version_mismatch`, is marked as recovered, and from then on is treated exactly like an `ok` candidate (artifacts, parity, round-trip, counts). Recovery must not modify the input file.
- Emitted artifacts, for each candidate that was ingested successfully (whether directly or after recovery), where `<stem>` is the candidate's file name without its `.json` suffix:
  - `<out-dir>/normalized/<stem>.json` whose content is the ingested document's exported dictionary serialized as JSON with 2-space indentation, with object keys sorted at every level, with non-ASCII characters kept verbatim (not escaped), and terminated by exactly one trailing newline.
  - `<out-dir>/markdown/<stem>.md` whose content is the ingested document's Markdown export with all trailing newlines stripped and then exactly one trailing newline appended.
- Report: `<out-dir>/audit_report.json`, a JSON object with exactly the keys `schema_version`, `input_dir`, `total`, `ok`, `recovered`, `failed`, `status_counts`, `documents`.
  - `schema_version` (string): the document-schema version that the installed Docling document model produces for documents it creates.
  - `input_dir` (string): the `--input-dir` value exactly as passed on the command line.
  - `total` (integer): number of audited candidates.
  - `ok` (integer): number of candidates with status `ok`.
  - `recovered` (integer): number of candidates marked as recovered.
  - `failed` (integer): `total` minus `ok`.
  - `status_counts` (object): exactly the keys `ok`, `malformed_json`, `not_an_object`, `version_mismatch`, `schema_invalid`, `unreadable`, each an integer that is present even when it is zero.
  - `documents` (array): one entry per candidate, ordered by the entry's `file` value in ascending Unicode code-point order.
- Each `documents` entry is a JSON object with exactly the keys `file`, `status`, `sha256`, `size_bytes`, `declared_version`, `document_version`, `name`, `counts`, `stream_parity`, `roundtrip_stable`, `recovered`, `normalized_path`, `markdown_path`, `error`:
  - `file` (string): the candidate's file name, without any directory component.
  - `status` (string): one of the classification statuses above.
  - `sha256` (string): lowercase hexadecimal SHA-256 digest of the candidate's bytes as they are on disk.
  - `size_bytes` (integer): the candidate's size on disk in bytes.
  - `declared_version` (string or null): the value of the top-level `version` member of the candidate's JSON as found in the file, if the file parses as a JSON object and that member is a string; otherwise `null`.
  - `document_version` (string or null): the schema version reported by the ingested document, or `null` when the candidate was never ingested successfully.
  - `name` (string or null): the ingested document's name, or `null` when the candidate was never ingested successfully.
  - `counts` (object or null): for an ingested candidate, an object with exactly the integer keys `texts`, `tables`, `pictures`, `groups`, `pages`, each the number of items of that kind held by the ingested document; otherwise `null`.
  - `stream_parity` (boolean): `true` when ingesting the very same JSON bytes from an in-memory byte stream instead of from a file path yields a document with an identical exported dictionary; `false` for candidates that were never ingested successfully.
  - `roundtrip_stable` (boolean): `true` when re-ingesting the emitted `normalized/<stem>.json` artifact yields a document with an exported dictionary identical to that of the ingested document; `false` for candidates that were never ingested successfully.
  - `recovered` (boolean): `true` only for candidates that were ingested after the version retry described above.
  - `normalized_path` (string or null): `normalized/<stem>.json` for ingested candidates, otherwise `null`.
  - `markdown_path` (string or null): `markdown/<stem>.md` for ingested candidates, otherwise `null`.
  - `error` (string or null): a non-empty diagnostic string for every candidate whose status is not `ok`, and `null` for candidates whose status is `ok`.
- Standard output: the last non-empty line printed on stdout must be exactly `AUDIT total=<total> ok=<ok> recovered=<recovered> failed=<failed>`, using the report's integer values.
- Exit codes:
  - `5` when `--input-dir` does not exist or holds no candidate; in that case no report and no artifacts are written and nothing is printed on stdout.
  - `4` when at least one ingested candidate has `stream_parity` or `roundtrip_stable` false.
  - `3` when neither of the above applies and `failed` is greater than zero.
  - `0` otherwise.
- Reruns must be self-consistent: auditing the same inputs into the same output directory twice in a row must leave byte-identical `audit_report.json`, `normalized/` and `markdown/` artifacts.

