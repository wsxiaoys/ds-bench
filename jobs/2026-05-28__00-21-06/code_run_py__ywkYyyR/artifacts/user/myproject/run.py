import os
from daytona import Daytona, DaytonaConfig, CreateSandboxFromSnapshotParams

def main():
    api_key = os.environ["DAYTONA_API_KEY"]
    run_id = os.environ["ZEALT_RUN_ID"]
    sandbox_name = f"code-run-py-{run_id}"

    config = DaytonaConfig(api_key=api_key)
    client = Daytona(config)

    params = CreateSandboxFromSnapshotParams(name=sandbox_name)
    sandbox = client.create(params)

    result_value = None
    try:
        code = """
total = sum(range(1, 101))
print(total)
"""
        response = sandbox.process.code_run(code)
        result_value = response.result.strip()
    finally:
        sandbox.delete()

    output_path = "/home/user/myproject/output.log"
    with open(output_path, "w") as f:
        f.write(f"Result: {result_value}\n")

    print(f"Result: {result_value}")
    print(f"Written to {output_path}")

if __name__ == "__main__":
    main()
