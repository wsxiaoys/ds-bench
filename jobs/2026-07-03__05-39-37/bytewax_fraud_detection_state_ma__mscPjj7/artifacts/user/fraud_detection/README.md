# Bytewax Fraud Detection State Machine

A stateful stream-processing dataflow built with the
[Bytewax](https://bytewax.io) framework that detects fraudulent
transaction patterns per `user_id` using a finite state machine.

## How it works

```
input.jsonl ─► read lines ─► parse JSON ─► key by user_id ─► stateful_map (state machine) ─► filter None ─► map_value to JSON ─► output.jsonl
```

The per-user state machine (`state_machine.py`) implements the following
logic:

| State        | Event                         | Result                                            |
|--------------|-------------------------------|---------------------------------------------------|
| `LOGGED_OUT` | `login`                       | → `LOGGED_IN`, record `login_ts`                   |
| `LOGGED_OUT` | `transaction`                 | ignored (stay `LOGGED_OUT`)                        |
| any          | `logout`                      | → `LOGGED_OUT` (state discarded)                  |
| `LOGGED_IN` / `SUSPICIOUS` | `transaction` amount ≥ 1000, within 300s of login | increment large-tx counter → `SUSPICIOUS` |
| `SUSPICIOUS` | 3rd large tx within 300s of login | emit **`FRAUD_ALERT`** → `LOGGED_OUT`         |
| `LOGGED_IN` / `SUSPICIOUS` | `transaction` more than 300s after login | reset → `LOGGED_OUT` (tx ignored)        |

* `LOGGED_OUT` is represented by `None`, so Bytewax drops the key from
  its state store (freeing memory) — the default starting state.
* State is **immutable** (`@dataclass(frozen=True)`); every transition
  returns a brand-new `UserState`.
* The 300s window is inclusive at the boundary (`ts - login_ts <= 300`).

## Usage

```bash
pip install -r requirements.txt

python run.py --input input.jsonl --output output.jsonl
```

### Input JSONlines schema

Each line is a JSON object:

| Field        | Type    | Required | Notes                                              |
|--------------|---------|----------|----------------------------------------------------|
| `user_id`    | string  | yes      | State key.                                          |
| `event_type` | string  | yes      | `"login"`, `"transaction"`, or `"logout"`.         |
| `timestamp`  | integer | yes      | Event time in seconds.                             |
| `amount`     | number  | no       | Transaction amount (only for `transaction`).       |

### Output JSONlines schema

Each emitted line is a JSON object:

```json
{"user_id": "u1", "alert": "FRAUD_ALERT"}
```

## Project layout

```
fraud_detection/
├── run.py                 # Dataflow definition + CLI entry point
├── state_machine.py       # Framework-agnostic state machine logic
├── test_state_machine.py # Unit tests for the state machine
├── input.jsonl           # Sample input exercising all paths
├── requirements.txt
└── README.md
```

## Testing

```bash
# Unit tests for the state machine logic
python -m pytest test_state_machine.py -v

# End-to-end run on the sample data
python run.py --input input.jsonl --output output.jsonl
cat output.jsonl
```

The sample `input.jsonl` produces these alerts:

```
{"user_id":"u1","alert":"FRAUD_ALERT"}
{"user_id":"u5","alert":"FRAUD_ALERT"}
{"user_id":"u7","alert":"FRAUD_ALERT"}
{"user_id":"u7","alert":"FRAUD_ALERT"}
```

Users `u2` (logout before 3rd tx), `u3` (tx outside window), `u4` (tx
while logged out / only 2 large tx) and `u6` (3rd tx outside window)
correctly produce **no** alert.

## Notes on Bytewax specifics

* `op.stateful_map` is the stateful operator: its `mapper` receives
  `(prev_state, value)` and returns `(new_state, emit_value)`. Returning
  `None` as the new state discards it from the store.
* The stream is keyed with `op.key_on` before `stateful_map` so state is
  tracked independently per `user_id`.
* `FileSink` routes items by their key, so the alert stream stays keyed
  (`op.map_value`) and is only serialized to a JSON string as the
  *value*.
* The dataflow is executed synchronously in-process via
  `bytewax.testing.run_main`, which blocks until the finite file source
  is exhausted.