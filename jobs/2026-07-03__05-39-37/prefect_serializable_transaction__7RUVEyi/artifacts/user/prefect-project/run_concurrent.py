"""
Launch 5 concurrent instances of the ``concurrent_file_modifier`` flow
and verify that the FileSystemLockManager serializes their access to
``counter.txt`` so that no increments are lost.

Each instance runs in its own subprocess so that the file-based lock
provided by ``FileSystemLockManager`` is exercised across independent
processes (the most realistic concurrency scenario).  After all five
flows complete the value in ``counter.txt`` must be exactly 5.
"""

import asyncio
import sys
from pathlib import Path

PROJECT_DIR = Path("/home/user/prefect-project")
COUNTER_FILE = PROJECT_DIR / "counter.txt"
FLOW_SCRIPT = PROJECT_DIR / "flow.py"
NUM_CONCURRENT = 5


async def run_one_flow(idx: int) -> int:
    """
    Run a single ``flow.py`` subprocess and return its exit code.
    """
    proc = await asyncio.create_subprocess_exec(
        sys.executable,
        str(FLOW_SCRIPT),
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        cwd=str(PROJECT_DIR),
    )
    stdout, stderr = await proc.communicate()
    if proc.returncode != 0:
        sys.stderr.write(
            f"Flow #{idx} failed with exit code {proc.returncode}\n"
            f"stdout: {stdout.decode()}\n"
            f"stderr: {stderr.decode()}\n"
        )
    return proc.returncode


async def main() -> None:
    # Ensure the counter starts at 0 for a deterministic demonstration.
    COUNTER_FILE.write_text("0")

    print(f"Initial counter value: {COUNTER_FILE.read_text().strip()}")
    print(f"Launching {NUM_CONCURRENT} concurrent flows...\n")

    # Fire all 5 subprocesses concurrently -- they will contend for the
    # same FileSystemLockManager lock.
    results = await asyncio.gather(
        *(run_one_flow(i) for i in range(NUM_CONCURRENT))
    )

    failed = [i for i, rc in enumerate(results) if rc != 0]
    if failed:
        print(f"\n{len(failed)} flow(s) failed: indices {failed}")
        sys.exit(1)

    final_value = int(COUNTER_FILE.read_text().strip())
    print(f"\nAll {NUM_CONCURRENT} flows completed.")
    print(f"Final counter value: {final_value}")

    if final_value == NUM_CONCURRENT:
        print(
            f"SUCCESS: counter is exactly {NUM_CONCURRENT} -- "
            "no updates were lost!"
        )
    else:
        print(
            f"FAILURE: expected {NUM_CONCURRENT} but got {final_value} -- "
            "updates were lost!"
        )
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())