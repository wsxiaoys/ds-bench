import os

from daytona import CreateSandboxFromSnapshotParams, Daytona


def main() -> None:
    run_id = os.getenv("ZEALT_RUN_ID")
    if not run_id:
        raise ValueError("ZEALT_RUN_ID environment variable is not set")

    sandbox_name = f"git-py-{run_id}"
    log_path = "/home/user/myproject/output.log"
    sandbox = None

    try:
        daytona = Daytona()
        sandbox = daytona.create(CreateSandboxFromSnapshotParams(name=sandbox_name))
        repo_path = "/home/daytona/hello-world"

        sandbox.git.clone(
            url="https://github.com/octocat/Hello-World",
            path=repo_path,
        )

        status = sandbox.git.status(repo_path)
        branch_line = f"Branch: {status.current_branch}"

        readme_path = f"{repo_path}/README"
        readme_bytes = sandbox.fs.download_file(readme_path)
        readme_text = readme_bytes.decode("utf-8", errors="replace")
        readme_first_line = readme_text.splitlines()[0] if readme_text else ""
        readme_line = f"README: {readme_first_line}"

        with open(log_path, "w", encoding="utf-8") as log_file:
            log_file.write(f"{branch_line}\n{readme_line}\n")
    finally:
        if sandbox is not None:
            sandbox.delete()


if __name__ == "__main__":
    main()
