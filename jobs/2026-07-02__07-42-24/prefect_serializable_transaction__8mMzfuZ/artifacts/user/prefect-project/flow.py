import pathlib
import time
from prefect import flow
from prefect.locking.filesystem import FileSystemLockManager
from prefect.transactions import transaction, IsolationLevel
from prefect.results import ResultStore

LOCKS_DIR = pathlib.Path("/home/user/prefect-project/locks")
DATA_FILE = pathlib.Path("/home/user/prefect-project/counter.txt")

@flow(name="concurrent_file_modifier")
def concurrent_file_modifier():
    # Ensure the locks directory exists
    LOCKS_DIR.mkdir(parents=True, exist_ok=True)
    
    # Initialize FileSystemLockManager and ResultStore
    lock_manager = FileSystemLockManager(lock_files_directory=LOCKS_DIR)
    store = ResultStore(lock_manager=lock_manager)
    
    # Use a SERIALIZABLE transaction with a lock manager to prevent race conditions
    with transaction(key="counter_lock", store=store, isolation_level=IsolationLevel.SERIALIZABLE) as txn:
        if DATA_FILE.exists():
            val = int(DATA_FILE.read_text().strip())
        else:
            val = 0
            
        print(f"Read value: {val}, incrementing to {val + 1}")
        
        # Simulate some processing time to allow race conditions to occur if locking is not working
        time.sleep(0.5)
        
        new_val = val + 1
        DATA_FILE.write_text(f"{new_val}\n")
        print(f"Wrote value: {new_val}")

if __name__ == "__main__":
    concurrent_file_modifier()
