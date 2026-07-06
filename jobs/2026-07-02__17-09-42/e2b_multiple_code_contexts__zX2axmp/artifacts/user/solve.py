"""Run two independent code contexts in a single E2B sandbox.

This script:
1. Creates a single E2B sandbox.
2. Creates two separate code contexts (`ctx1`, `ctx2`) inside that sandbox.
3. Runs code in each context that sets a `magic_number` variable
   (different values, to prove the contexts are isolated).
4. Runs code in each context that writes `magic_number` to a file inside
   the sandbox.
5. Downloads those sandbox files back to the local working directory.
6. Closes the sandbox via the context manager.
"""

from e2b_code_interpreter import Sandbox


REMOTE_OUT_1 = "/home/user/out1.txt"
REMOTE_OUT_2 = "/home/user/out2.txt"

LOCAL_OUT_1 = "/home/user/host_out1.txt"
LOCAL_OUT_2 = "/home/user/host_out2.txt"


def _run(sandbox: Sandbox, context, code: str, label: str):
    """Execute `code` in the given context and surface any error."""
    execution = sandbox.run_code(code, context=context)
    if execution.error:
        raise RuntimeError(f"[{label}] execution failed: {execution.error}")
    if execution.logs.stdout:
        print(f"[{label}] stdout:", "".join(execution.logs.stdout))
    if execution.logs.stderr:
        print(f"[{label}] stderr:", "".join(execution.logs.stderr))


def main() -> None:
    # `Sandbox.create()` as a context manager guarantees `.close()` is called
    # even if an exception is raised while the sandbox is running.
    with Sandbox.create() as sandbox:
        # Two independent execution contexts share the sandbox process but
        # keep their variables separate.
        ctx1 = sandbox.create_code_context()
        ctx2 = sandbox.create_code_context()

        # 1. Set a different `magic_number` in each context.
        _run(
            sandbox,
            ctx1,
            "magic_number = 42",
            "ctx1",
        )
        _run(
            sandbox,
            ctx2,
            "magic_number = 99",
            "ctx2",
        )

        # 2. Each context reads its own `magic_number` and writes it to a file
        # inside the sandbox.
        write_code_1 = (
            "with open('/home/user/out1.txt', 'w') as f:\n"
            "    f.write(str(magic_number))\n"
        )
        write_code_2 = (
            "with open('/home/user/out2.txt', 'w') as f:\n"
            "    f.write(str(magic_number))\n"
        )

        _run(sandbox, ctx1, write_code_1, "ctx1")
        _run(sandbox, ctx2, write_code_2, "ctx2")

        # 3. Download both files from the sandbox into the local workspace.
        content1 = sandbox.files.read(REMOTE_OUT_1, format="text")
        content2 = sandbox.files.read(REMOTE_OUT_2, format="text")

        with open(LOCAL_OUT_1, "w") as f:
            f.write(content1)
        with open(LOCAL_OUT_2, "w") as f:
            f.write(content2)

        print(f"[main] wrote {LOCAL_OUT_1} = {content1!r}")
        print(f"[main] wrote {LOCAL_OUT_2} = {content2!r}")


if __name__ == "__main__":
    main()