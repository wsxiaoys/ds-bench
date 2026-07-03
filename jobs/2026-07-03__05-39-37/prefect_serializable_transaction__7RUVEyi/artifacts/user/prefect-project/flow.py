"""
Prefect flow that atomically increments a counter file using a
SERIALIZABLE transaction backed by a FileSystemLockManager.

The SERIALIZABLE isolation level causes the transaction to acquire an
exclusive lock (via the FileSystemLockManager) on a shared key before
the transaction body executes.  The lock is only released when the
transaction commits or rolls back, guaranteeing that concurrent runs
cannot interleave their read-modify-write cycle on ``counter.txt``.
"""

from pathlib import Path

from prefect import flow
from prefect.locking.filesystem import FileSystemLockManager
from prefect.results import ResultStore
from prefect.transactions import IsolationLevel, transaction

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
PROJECT_DIR = Path("/home/user/prefect-project")
COUNTER_FILE = PROJECT_DIR / "counter.txt"
LOCK_DIR = PROJECT_DIR / "locks"

# A fixed transaction key so that every concurrent run competes for the
# *same* lock.  This is what turns the lock manager into a mutual-exclusion
# mechanism for the counter file.
TRANSACTION_KEY = "counter-file-transaction"


@flow(name="concurrent_file_modifier")
def concurrent_file_modifier() -> int:
    """
    Read the integer stored in ``counter.txt``, increment it by one, and
    write it back -- all inside a SERIALIZABLE transaction protected by a
    ``FileSystemLockManager``.

    Returns
    -------
    int
        The new value of the counter after the increment.
    """
    # Build a ResultStore whose only job (for our purposes) is to provide
    # the lock manager.  We disable result persistence with
    # ``write_on_commit=False`` and set ``overwrite=True`` so that the
    # transaction machinery never tries to read/write a cached result
    # record -- it only uses the store for lock acquisition/release.
    lock_manager = FileSystemLockManager(lock_files_directory=LOCK_DIR)
    store = ResultStore(lock_manager=lock_manager)

    with transaction(
        key=TRANSACTION_KEY,
        store=store,
        isolation_level=IsolationLevel.SERIALIZABLE,
        overwrite=True,
        write_on_commit=False,
    ) as txn:
        # ---- critical section (protected by the file lock) -----------
        current_value = int(COUNTER_FILE.read_text().strip())
        new_value = current_value + 1
        COUNTER_FILE.write_text(str(new_value))
        # ---- end of critical section --------------------------------

    return new_value


if __name__ == "__main__":
    result = concurrent_file_modifier()
    print(f"Counter updated to: {result}")