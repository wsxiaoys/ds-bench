from pathlib import Path
from prefect import flow, get_run_logger
from prefect.locking.filesystem import FileSystemLockManager
from prefect.results import ResultStore
from prefect.transactions import transaction, IsolationLevel


LOCK_DIR = Path("/home/user/prefect-project/locks")
DATA_FILE = Path("/home/user/prefect-project/counter.txt")
LOCK_KEY = "counter-file-lock"


def _get_store() -> ResultStore:
    """Build a ResultStore configured with a FileSystemLockManager."""
    lock_manager = FileSystemLockManager(lock_files_directory=LOCK_DIR)
    return ResultStore(lock_manager=lock_manager)


@flow(name="concurrent_file_modifier")
def concurrent_file_modifier() -> int:
    logger = get_run_logger()
    store = _get_store()

    with transaction(
        key=LOCK_KEY,
        store=store,
        isolation_level=IsolationLevel.SERIALIZABLE,
        overwrite=True,
    ) as txn:
        # Read current value
        if DATA_FILE.exists():
            current = int(DATA_FILE.read_text().strip() or "0")
        else:
            current = 0
        logger.info(f"Read current value: {current}")

        # Increment
        new_value = current + 1
        logger.info(f"Writing new value: {new_value}")

        # Write back
        DATA_FILE.write_text(str(new_value))

    return new_value


if __name__ == "__main__":
    concurrent_file_modifier()
