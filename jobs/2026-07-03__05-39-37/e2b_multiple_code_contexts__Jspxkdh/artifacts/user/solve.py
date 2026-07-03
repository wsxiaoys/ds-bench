"""
Concurrent code execution in isolated contexts within a single E2B Sandbox.

This script demonstrates how to run multiple independent tasks concurrently in
one E2B Sandbox without variable clashes, by using separate code execution
contexts (each context has its own isolated global namespace).

It:
  1. Creates a single E2B Sandbox.
  2. Creates two separate code execution contexts (`ctx1` and `ctx2`).
  3. Sets `magic_number = 42` in `ctx1` and `magic_number = 99` in `ctx2`.
  4. Reads each context's `magic_number` and writes it to a file inside the
     sandbox (`/home/user/out1.txt` and `/home/user/out2.txt`).
  5. Downloads both files to the local workspace
     (`/home/user/host_out1.txt` and `/home/user/host_out2.txt`).
  6. Ensures the sandbox is closed at the end via a context manager.
"""

from e2b_code_interpreter import Sandbox

# Paths inside the sandbox
SANDBOX_OUT1 = "/home/user/out1.txt"
SANDBOX_OUT2 = "/home/user/out2.txt"

# Local (host) output paths
HOST_OUT1 = "/home/user/host_out1.txt"
HOST_OUT2 = "/home/user/host_out2.txt"


def main() -> None:
    # `Sandbox.create()` returns a sandbox usable as a context manager.
    # Using `with` guarantees the sandbox is closed/killed at the end even if
    # an error occurs, so it is never left running indefinitely.
    with Sandbox.create() as sandbox:
        # Create two independent code execution contexts. Each context has its
        # own isolated global namespace, so variables set in one context do not
        # clash with variables in the other.
        ctx1 = sandbox.create_code_context(cwd="/home/user", language="python")
        ctx2 = sandbox.create_code_context(cwd="/home/user", language="python")

        # --- ctx1: set magic_number = 42 ---
        sandbox.run_code("magic_number = 42", context=ctx1)

        # --- ctx2: set magic_number = 99 ---
        sandbox.run_code("magic_number = 99", context=ctx2)

        # --- ctx1: read magic_number and write it to /home/user/out1.txt ---
        sandbox.run_code(
            "with open('/home/user/out1.txt', 'w') as f:\n"
            "    f.write(str(magic_number))",
            context=ctx1,
        )

        # --- ctx2: read magic_number and write it to /home/user/out2.txt ---
        sandbox.run_code(
            "with open('/home/user/out2.txt', 'w') as f:\n"
            "    f.write(str(magic_number))",
            context=ctx2,
        )

        # --- Download both files from the sandbox to the local workspace ---
        # `sandbox.files.read()` retrieves file content from the sandbox.
        content1 = sandbox.files.read(SANDBOX_OUT1, format="text")
        content2 = sandbox.files.read(SANDBOX_OUT2, format="text")

        with open(HOST_OUT1, "w") as f:
            f.write(content1)
        with open(HOST_OUT2, "w") as f:
            f.write(content2)

        print(f"Downloaded {SANDBOX_OUT1} -> {HOST_OUT1} (content: {content1!r})")
        print(f"Downloaded {SANDBOX_OUT2} -> {HOST_OUT2} (content: {content2!r})")

    # The sandbox is REDACTEDmatically closed when the `with` block exits.
    print("Sandbox closed.")


if __name__ == "__main__":
    main()