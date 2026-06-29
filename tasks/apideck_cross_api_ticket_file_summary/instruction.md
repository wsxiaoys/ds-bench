# Cross-API Ticket / File Summary

Using Apideck Unify, perform these two side effects in the connected services for the current `/logs/artifacts/run-id`.

- **Project path**: `/home/user/apideck_task`
- **Execution**: The real Apideck side effects must be executed (no mocking).

1. Upload exactly three small text files at the OneDrive drive root (service id `onedrive`), named (case-sensitive):
   - `REPORT-<run-id>-A.txt`
   - `REPORT-<run-id>-B.txt`
   - `REPORT-<run-id>-C.txt`
2. Create exactly one Issue Tracking ticket (service id `github`, collection `APIDECK_ISSUE_TRACKING_COLLECTION_ID`) whose `subject` contains both `/logs/artifacts/run-id` and the literal marker `[FILE-INDEX]`, and whose `description` is the newline-joined list of those three uploaded files' Apideck file ids, sorted ascending. The description MUST contain only those three id lines and nothing else.

