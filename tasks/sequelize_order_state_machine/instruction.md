# Order Lifecycle State Machine with Sequelize

## Background
You are building the order-lifecycle core of an e-commerce backend. An order's `status` must behave as a strict finite state machine (FSM): only a fixed set of transitions is ever allowed, illegal transitions must be rejected without side effects, and every accepted transition must be permanently recorded in an append-only audit trail. Correctness must hold even when many processes try to advance the same order at the same time.

Use **Sequelize v6** with a file-based **SQLite** database. Everything runs locally and offline.

## Requirements
- Model an `Order` whose `status` is one of exactly: `pending`, `paid`, `shipped`, `delivered`, `cancelled`. A newly created order starts in `pending`.
- The only legal transitions are:
  - `pending` -> `paid`
  - `pending` -> `cancelled`
  - `paid` -> `shipped`
  - `paid` -> `cancelled`
  - `shipped` -> `delivered`
  - `delivered` and `cancelled` are terminal (no transition out of them is ever allowed).
  - Every other transition (including a no-op transition to the same status, and any transition out of `shipped` other than to `delivered`) is illegal.
- The set of legal transitions MUST be enforced from a single data-driven transition table that the model logic consults; legality MUST NOT be decided by ad-hoc per-call conditionals.
- Maintain an append-only `OrderStatusHistory` audit table. Each accepted transition appends exactly one history row capturing the order it belongs to, the `fromStatus`, the `toStatus`, and the time it occurred.
- Performing a transition and recording its history row MUST be atomic: either both the status update and the history insert happen, or neither does.
- An illegal transition MUST leave the order's status unchanged and MUST NOT append any history row.
- Under concurrent or repeated attempts, the order's status and its history MUST remain consistent: the ordered sequence of history rows must form a valid transition chain starting from `pending`, no state may be skipped, and no accepted transition may be recorded that was not legal from the status immediately preceding it.

## Implementation Hints
- Project path: /home/user/project
- Provide a rerunnable CLI entrypoint invoked as `node cli.js <subcommand> [options]`, run from the project path.
- Every subcommand takes `--db <path>` giving the SQLite database file to operate on. Any subcommand must ensure the required schema exists on the given database file (creating it if absent) before doing its work.
- All successful command output described below MUST be written to stdout as a single JSON value (one line). Diagnostic/error text may go to stderr.
- Subcommands:
  - `init --db <path>`: ensure the schema exists. Print `{"ok": true}`. Exit code 0.
  - `create --db <path>`: create a new order in status `pending`. Print `{"id": <number>, "status": "pending"}`. Exit code 0.
  - `transition --db <path> --id <number> --to <status>`: attempt to move order `<number>` to `<status>`.
    - On a legal transition: print `{"ok": true, "id": <number>, "from": "<previous_status>", "to": "<status>"}` and exit 0.
    - On an illegal transition (including terminal-state and same-status attempts): make no change to the order and no history row, print `{"ok": false, "error": "ILLEGAL_TRANSITION", "id": <number>, "from": "<current_status>", "to": "<status>"}`, and exit with code 3.
    - If the order id does not exist: print `{"ok": false, "error": "NOT_FOUND", "id": <number>}` and exit with code 4.
  - `show --db <path> --id <number>`: print `{"id": <number>, "status": "<status>", "history": [ {"fromStatus": "<from>", "toStatus": "<to>", "at": "<ISO-8601 timestamp>"}, ... ]}` where the `history` array is ordered chronologically from the earliest transition to the latest. If the order id does not exist, print `{"ok": false, "error": "NOT_FOUND", "id": <number>}` and exit 4.
  - `transitions --db <path>`: print the data-driven transition table as a JSON object mapping each of the five statuses to the array of statuses it may legally transition to. Each array MUST be sorted in ascending alphabetical order (terminal states map to an empty array). Exit 0.
- The database schema must be created programmatically by the CLI (no external migration tooling required).

