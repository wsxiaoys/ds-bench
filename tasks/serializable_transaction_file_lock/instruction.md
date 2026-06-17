# Prefect Serializable Transaction File Lock

## Background
Prefect 3.0 introduced transactional semantics for atomic units of work. In this task, you will implement a flow that uses a `SERIALIZABLE` transaction with a `FileSystemLockManager` to prevent race conditions when multiple concurrent runs of the flow attempt to access or modify the same local resource.

## Requirements
- Create a Prefect flow named `concurrent_file_modifier` in a script named `flow.py`.
- The flow must use a `SERIALIZABLE` transaction.
- The transaction must use a `FileSystemLockManager` to lock a specific file during the transaction to prevent race conditions.
- The flow should read an integer from a file, increment it, and write it back.
- Write a script named `run_concurrent.py` that executes multiple instances of this flow concurrently (e.g., using `asyncio.gather` or multiple subprocesses) to demonstrate that the lock works and no updates are lost.

## Constraints
- Project path: `/home/user/prefect-project`
- Lock directory/path for FileSystemLockManager: `/home/user/prefect-project/locks`
- Data file path: `/home/user/prefect-project/counter.txt`
- The initial value in `counter.txt` will be 0.
- Running `python run_concurrent.py` should execute the flow concurrently 5 times.
- After running 5 concurrent flows, the value in `counter.txt` must be exactly 5.