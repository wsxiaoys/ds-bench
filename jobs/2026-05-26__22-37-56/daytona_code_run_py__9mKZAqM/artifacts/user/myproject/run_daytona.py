import os
from daytona import Daytona, DaytonaConfig, CreateSandboxFromSnapshotParams


def main() -> None:
    run_id = os.environ["ZEALT_RUN_ID"]
    api_key = os.environ["DAYTONA_API_KEY"]

    client = Daytona(DaytonaConfig(api_key=api_key))
    params = CreateSandboxFromSnapshotParams(
        name=f"code-run-py-{run_id}",
        language="python",
    )
    sandbox = client.create(params)

    try:
        response = sandbox.process.code_run(
            "print(sum(range(1, 101)))"
        )
        result = response.result.strip()
    finally:
        sandbox.delete()

    output_path = "/home/user/myproject/output.log"
    with open(output_path, "w", encoding="utf-8") as handle:
        handle.write(f"Result: {result}\n")


if __name__ == "__main__":
    main()
