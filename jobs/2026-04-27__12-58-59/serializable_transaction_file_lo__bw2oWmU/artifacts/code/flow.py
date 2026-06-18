from prefect import flow
from prefect.transactions import transaction, IsolationLevel
from prefect.locking.filesystem import FileSystemLockManager
from prefect.results import ResultStore
from pathlib import Path
import time
import os

PROJECT_DIR = Path("/home/user/prefect-project")
LOCK_DIR = PROJECT_DIR / "locks"
COUNTER_FILE = PROJECT_DIR / "counter.txt"

# Ensure lock directory exists
LOCK_DIR.mkdir(parents=True, exist_ok=True)

# Initialize Lock Manager and Result Store
# The FileSystemLockManager will manage lock files in the specified directory.
lock_manager = FileSystemLockManager(lock_files_directory=LOCK_DIR)
store = ResultStore(lock_manager=lock_manager)

@flow(name="concurrent_file_modifier")
def concurrent_file_modifier():
    pid = os.getpid()
    print(f"Flow run started (PID: {pid})")
    
    # SERIALIZABLE isolation level with a LockManager will acquire a lock on the key.
    # This ensures that only one transaction with this key can be active at a time
    # across any process using the same LockManager directory.
    with transaction(
        key="counter-transaction-lock",
        store=store,
        isolation_level=IsolationLevel.SERIALIZABLE
    ):
        # Read current value
        if COUNTER_FILE.exists():
            content = COUNTER_FILE.read_text().strip()
            val = int(content) if content else 0
        else:
            val = 0
        
        print(f"Transaction acquired. Current value: {val} (PID: {pid})")
        
        # Increment
        new_val = val + 1
        
        # Simulate processing time to demonstrate that other flows are waiting
        time.sleep(1)
        
        # Write back
        COUNTER_FILE.write_text(str(new_val))
        print(f"Updated value to: {new_val} (PID: {pid})")

if __name__ == "__main__":
    concurrent_file_modifier()
