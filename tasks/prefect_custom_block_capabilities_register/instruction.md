# Custom Prefect Block: Register a Reusable Capability and Use It Inside a Flow

## Background
Prefect 3 lets you package reusable configuration and behavior as a custom **Block** (a subclass of `prefect.blocks.core.Block`). A block type must be **registered** with a Prefect server, and named block **documents** (instances) can then be saved to and loaded from that server. In this task you will build a custom block that encapsulates a tiny append-only text ledger capability, register it against a local Prefect server, save a named instance, and then drive a Prefect flow that loads the instance back and exercises its methods to produce deterministic files on the local filesystem.

Everything runs fully locally: a local Prefect server backed by the on-disk SQLite database under `PREFECT_HOME`, the local filesystem, and a local Python process. No Prefect Cloud, no network services, and no external storage are involved.

The exact version of Prefect installed in the environment is **3.7.8**; your solution must be correct for that version.

## Requirements
Implement, register, and run the following, so that all state below exists after your solution completes.

### 1. The custom block class
Define a class named `TextLedgerBlock` that subclasses `prefect.blocks.core.Block`. It must:
- Have its human-readable block type name set to `Text Ledger` (so that its registered block-type slug is `text-ledger`).
- Declare exactly these three typed fields:
  - `storage_dir` (string) — the directory that holds the ledger file.
  - `ledger_name` (string) — the base name of the ledger file.
  - `hash_algorithm` (string) with a default value of `sha256`.
- Implement at least these two instance methods with exactly this behavior:
  - `append_entry(self, text: str) -> str`: append the string `text` followed by a single newline character (`\n`) to the UTF-8 text file located at `<storage_dir>/<ledger_name>.log` (creating the directory and file if they do not yet exist), and return the lowercase hexadecimal digest of the UTF-8 encoded bytes of `text`, computed with the hashing algorithm named by the block's `hash_algorithm` field.
  - `entry_count(self) -> int`: return the number of non-empty lines currently present in `<storage_dir>/<ledger_name>.log`, or `0` if that file does not exist.

### 2. Register the block type and save a named instance
- Register the `TextLedgerBlock` block type on the local Prefect server so that the block type with slug `text-ledger` exists on the server and its current schema exposes exactly the three fields `storage_dir`, `ledger_name`, and `hash_algorithm`.
- Save an instance as a block document named `primary` (i.e. it is loadable as `text-ledger/primary`) with these exact field values:
  - `storage_dir` = `/home/user/project/ledger_store`
  - `ledger_name` = `events`
  - `hash_algorithm` = `sha256`

### 3. A flow that loads the block and uses its methods
Define a Prefect flow named `build_ledger` (a function decorated with `@flow`) that, when run:
- Loads the saved block document back from the server (it must be retrieved by its saved name, not constructed inline).
- Appends exactly these three entries, in this order: `alpha`, then `beta`, then `gamma`, using the block's `append_entry` method.
- Writes a JSON summary file to `/home/user/project/ledger_store/summary.json` containing an object with exactly these keys:
  - `ledger_name`: the `ledger_name` value read from the loaded block.
  - `hash_algorithm`: the `hash_algorithm` value read from the loaded block.
  - `entry_count`: the integer returned by the block's `entry_count` method after all three entries have been appended.
  - `entries`: a JSON array with one object per appended entry, in the same order they were appended, where each object has exactly the keys `text` (the entry string) and `digest` (the hexadecimal digest string returned by `append_entry` for that entry).

You must actually run the flow so that the artifacts described below exist on disk.

## Implementation Hints
- Project path: /home/user/project
- A local Prefect server must be running/available and used as the API backend for registration, saving, and loading; the server data persists in the SQLite database under `PREFECT_HOME` (`/home/user/.prefect`).
- Ledger file path: `/home/user/project/ledger_store/events.log`. After the flow runs it must contain exactly the following three lines, each terminated by a newline, in this order:

  ```
  alpha
  beta
  gamma
  ```

- Summary file path: `/home/user/project/ledger_store/summary.json`. It must be valid JSON whose top-level object has exactly the keys `ledger_name`, `hash_algorithm`, `entry_count`, and `entries` as specified above; `entry_count` must equal `3`; and each `digest` must be the lowercase hex `sha256` digest of the UTF-8 bytes of the corresponding entry `text`.
- The registered block type on the server must have slug `text-ledger`, and the saved block document must be named `primary` with the exact field values listed in the Requirements.

