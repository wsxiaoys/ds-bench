import os
import sys
from daytona import Daytona


def main() -> int:
    run_id = os.getenv("ZEALT_RUN_ID")
    if not run_id:
        raise RuntimeError("ZEALT_RUN_ID environment variable is required")

    sandbox_name = f"exec-py-{run_id}"
    daytona = Daytona()
    sandbox = None

    try:
        sandbox = daytona.create(sandbox_name)

        uname_result = sandbox.process.exec("uname -a").result
        pwd_result = sandbox.process.exec("pwd").result
        echo_result = sandbox.process.exec(f"echo {run_id}").result

        log_path = "/home/user/myproject/output.log"
        with open(log_path, "w", encoding="utf-8") as log_file:
            log_file.write(f"UNAME: {uname_result}\n")
            log_file.write(f"PWD: {pwd_result}\n")
            log_file.write(f"ECHO: {echo_result}\n")

        return 0
    finally:
        if sandbox is not None:
            daytona.delete(sandbox)


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:
        print(f"Error: {exc}", file=sys.stderr)
        sys.exit(1)
