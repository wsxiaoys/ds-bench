"""Run multiple instances of the ``concurrent_file_modifier`` flow concurrently.

This script demonstrates that the SERIALIZABLE Prefect transaction backed by a
``FileSystemLockManager`` correctly serializes the read-modify-write of the
counter file. After 5 concurrent flow runs, the value in ``counter.txt`` must
be exactly 5 (i.e. no updates are lost).

Implementation notes
--------------------
Each concurrent run is launched as a separate OS process via ``subprocess.Popen``
and the whole batch is driven from a single ``asyncio.gather`` call. Using
subprocesses (rather than threads) gives every flow its own Python interpreter
and its own Prefect ephemeral API server, which avoids the port collisions
that would otherwise occur when several flows start their temporary servers
from the same process. The subprocess approach is also a strong test of the
*cross-process* locking guarantees provided by ``FileSystemLockManager``.
"""

from __future__ import annotations

import asyncio
import os
import subprocess
import sys
from pathlib import Path
from typing import Awaitable, List, Tuple


PROJECT_DIR: Path = Path("/home/user/prefect-project")
COUNTER_FILE: Path = PROJECT_DIR / "counter.txt"
LOCKS_DIR: Path = PROJECT_DIR / "locks"
FLOW_SCRIPT: Path = PROJECT_DIR / "flow.py"

CONCURRENT_RUNS: int = 5
EXPECTED_FINAL_COUNTER: int = CONCURRENT_RUNS


def _reset_state() -> None:
    """Reset the counter file and clear any leftover lock/result files.

    This restores the initial conditions described in the task: ``counter.txt``
    holds ``0`` and ``locks/`` is empty before the concurrent run begins.
    """
    COUNTER_FILE.parent.mkdir(parents=True, exist_ok=True)
    LOCKS_DIR.mkdir(parents=True, exist_ok=True)

    COUNTER_FILE.write_text("0\n")

    for stale in LOCKS_DIR.iterdir():
        try:
            stale.unlink()
        except IsADirectoryError:
            # Defensive: ``LOCKS_DIR`` should contain only files.
            continue


def _read_counter() -> int:
    """Return the integer currently stored in the counter file."""
    return int(COUNTER_FILE.read_text().strip() or "0")


async def _run_one_subprocess(index: int) -> Tuple[int, str, str]:
    """Spawn one ``flow.py`` subprocess and wait for it to finish.

    Returns a tuple ``(return_code, stdout, stderr)``. Running the subprocesses
    with ``asyncio.create_subprocess_exec`` lets us launch them in parallel
    from a single ``asyncio.gather`` call.
    """

    def _suppress_prefect_chrome() -> str:
        """Quiet down Prefect's chatty startup logs in subprocess output."""
        return "WARNING"

    env = {**os.environ, "PREFECT_LOGGING_LEVEL": _suppress_prefect_chrome()}

    process = await asyncio.create_subprocess_exec(
        sys.executable,
        str(FLOW_SCRIPT),
        cwd=str(PROJECT_DIR),
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        env=env,
    )
    stdout_bytes, stderr_bytes = await process.communicate()
    return (
        process.returncode if process.returncode is not None else -1,
        stdout_bytes.decode(errors="replace"),
        stderr_bytes.decode(errors="replace"),
    )


async def _launch_concurrent_flows() -> List[Tuple[int, str, str]]:
    """Launch ``CONCURRENT_RUNS`` flow runs concurrently and gather results."""
    tasks = [_run_one_subprocess(i) for i in range(CONCURRENT_RUNS)]
    return await asyncio.gather(*tasks)


def _report_failure(index: int, rc: int, stdout: str, stderr: str) -> None:
    print(f"  [run {index}] FAILED (exit code={rc})")
    if stdout.strip():
        print(f"  [run {index}] stdout:\n{stdout.strip()}")
    if stderr.strip():
        print(f"  [run {index}] stderr:\n{stderr.strip()}")


async def main() -> None:
    print(f"Project directory: {PROJECT_DIR}")
    print(f"Concurrent flow runs to perform: {CONCURRENT_RUNS}")

    # ----- Reset to the initial state described in the task ---------------
    print("\nResetting state...")
    _reset_state()
    assert _read_counter() == 0, "counter.txt should start at 0"
    print(f"  counter.txt = {_read_counter()}")

    # ----- Launch the concurrent flow runs --------------------------------
    print(f"\nLaunching {CONCURRENT_RUNS} concurrent flow runs "
          "via asyncio.gather + subprocesses...")
    results = await _launch_concurrent_flows()

    # ----- Report on each individual run -----------------------------------
    success_count = 0
    for i, (rc, stdout, stderr) in enumerate(results):
        if rc == 0:
            success_count += 1
            print(f"  [run {i}] OK")
        else:
            _report_failure(i, rc, stdout, stderr)

    print(f"\nSuccessful runs: {success_count}/{CONCURRENT_RUNS}")
    if success_count != CONCURRENT_RUNS:
        raise RuntimeError(
            f"Expected {CONCURRENT_RUNS} successful flow runs, got "
            f"{success_count}"
        )

    # ----- Verify the final counter value ---------------------------------
    final_counter = _read_counter()
    print(f"Final value of counter.txt: {final_counter}")
    if final_counter != EXPECTED_FINAL_COUNTER:
        raise AssertionError(
            f"Expected counter.txt to be {EXPECTED_FINAL_COUNTER} after "
            f"{CONCURRENT_RUNS} concurrent flow runs, but it is "
            f"{final_counter}. Updates were lost - the FileSystemLockManager "
            "is not serializing access correctly."
        )

    print(
        "\nSUCCESS: the SERIALIZABLE transaction with FileSystemLockManager "
        "prevented lost updates - every concurrent increment was applied "
        "exactly once."
    )


if __name__ == "__main__":
    asyncio.run(main())