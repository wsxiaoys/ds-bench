import os
from daytona import Daytona

PROJECT_DIR = "/home/user/myproject"
INPUT_PATH = os.path.join(PROJECT_DIR, "input.txt")
OUTPUT_PATH = os.path.join(PROJECT_DIR, "output.txt")
LOG_PATH = os.path.join(PROJECT_DIR, "output.log")

REMOTE_INPUT = "/tmp/input.txt"
REMOTE_OUTPUT = "/tmp/output.txt"


def main() -> None:
    run_id = os.environ["ZEALT_RUN_ID"]
    label = f"fs-py-{run_id}"

    input_content = f"Hello Daytona {run_id}".encode("utf-8")
    with open(INPUT_PATH, "wb") as handle:
        handle.write(input_content)

    sandbox = None
    try:
        client = Daytona()
        sandbox = client.create(label=label)

        sandbox.fs.upload_file(input_content, REMOTE_INPUT)
        sandbox.process.exec(
            [
                "/bin/sh",
                "-c",
                f"tr '[:lower:]' '[:upper:]' < {REMOTE_INPUT} > {REMOTE_OUTPUT}",
            ]
        )

        output_bytes = sandbox.fs.download_file(REMOTE_OUTPUT)
        with open(OUTPUT_PATH, "wb") as handle:
            handle.write(output_bytes)

        with open(LOG_PATH, "a", encoding="utf-8") as handle:
            handle.write("Upload+Download OK\n")
    finally:
        if sandbox is not None:
            sandbox.delete()


if __name__ == "__main__":
    main()
