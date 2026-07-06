"""Prefect flow that uses a SERIALIZABLE transaction with a FileSystemLockManager
to safely increment a counter stored in a file.

The lock guarantees that only one flow run at a time can read-modify-write the
counter file, preventing race conditions and lost updates when multiple flows
execute concurrently.
"""

from __future__ import annotations

from pathlib import Path

from prefect import flow, get_run_logger
from prefect.filesystems import LocalFileSystem
from prefect.locking.filesystem import FileSystemLockManager
from prefect.results import ResultStore
from prefect.transactions import IsolationLevel, transaction


# ---------------------------------------------------------------------------
# Project paths (kept here so the flow is self-contained and reproducible).
# ---------------------------------------------------------------------------
PROJECT_DIR: Path = Path("/home/user/prefect-project")
LOCKS_DIR: Path = PROJECT_DIR / "locks"
COUNTER_FILE: Path = PROJECT_DIR / "counter.txt"
TRANSACTION_KEY: str = "counter-file"


# ---------------------------------------------------------------------------
# Result store wired up with a FileSystemLockManager.
#
# The SERIALIZABLE isolation level of a Prefect transaction acquires a lock
# through the store's lock_manager. By providing a FileSystemLockManager whose
# lock files live in /home/user/prefect-project/locks, we ensure that all
# concurrent flow runs serialize on the same file-based lock before reading
# or writing the counter.
# ---------------------------------------------------------------------------
_file_system_lock_manager = FileSystemLockManager(lock_files_directory=LOCKS_DIR)

_result_storage = LocalFileSystem(basepath=str(LOCKS_DIR))

_result_store = ResultStore(
    result_storage=_result_storage,
    lock_manager=_file_system_lock_manager,
)


def _read_counter() -> int:
    """Read the integer value currently stored in the counter file."""
    with COUNTER_FILE.open("r") as f:
        contents = f.read().strip()
    if not contents:
        return 0
    return int(contents)


def _write_counter(value: int) -> None:
    """Write an integer value back to the counter file."""
    with COUNTER_FILE.open("w") as f:
        f.write(f"{value}\n")


def _increment_counter_under_transaction() -> int:
    """Perform the read-modify-write inside a SERIALIZABLE transaction.

    Returns the new value that was just written to the counter file.
    """
    logger = get_run_logger()

    with transaction(
        key=TRANSACTION_KEY,
        store=_result_store,
        isolation_level=IsolationLevel.SERIALIZABLE,
    ) as txn:
        # The SERIALIZABLE isolation level guarantees that only one flow run
        # at a time is executing the body of this `with` block. The lock is
        # held by FileSystemLockManager until the transaction commits (i.e.
        # the `with` block exits without an exception).
        current = _read_counter()
        new_value = current + 1
        logger.info(
            "Read counter=%s, writing new value=%s inside SERIALIZABLE transaction",
            current,
            new_value,
        )
        _write_counter(new_value)

        # Stage the new value so the transaction records it on commit.
        txn.stage(new_value)

    return new_value


@flow(name="concurrent_file_modifier")
def concurrent_file_modifier() -> int:
    """Increment the counter in counter.txt atomically.

    Uses a SERIALIZABLE Prefect transaction backed by a FileSystemLockManager
    so that multiple concurrent flow runs do not lose updates.
    """
    logger = get_run_logger()
    logger.info("Starting concurrent_file_modifier flow run")

    new_value = _increment_counter_under_transaction()

    logger.info("Finished concurrent_file_modifier; counter is now %s", new_value)
    return new_value


if __name__ == "__main__":
    # Allow `python flow.py` to invoke a single run for quick smoke tests.
    print(concurrent_file_modifier())