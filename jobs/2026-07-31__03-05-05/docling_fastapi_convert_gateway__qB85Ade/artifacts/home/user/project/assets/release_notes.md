# Release Notes 4.2

The 4.2 maintenance release focuses on ingestion throughput and on the reliability of the
overnight batch window.

## Highlights

- Reduced cold-start latency of the ingestion pool.
- Reworked retry accounting so partial batches are no longer double counted.
- Added a durable audit trail for every rejected document.

## Compatibility

| Component | Previous | Current |
| --- | --- | --- |
| Ingestion schema | 3.9 | 4.2 |
| Audit trail | none | v1 |
| Export bundle | 2.0 | 2.1 |

## Known Issues

Very large spreadsheets may still be split across two audit records when the batch window
closes mid-document. A fix is scheduled for the next maintenance release.
