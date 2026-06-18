FROM ubuntu:24.04

RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl ca-certificates git python3 python3-pip python3-pytest bash && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN pip3 install --break-system-packages --ignore-installed "prefect>=3.0.0" pydantic

RUN mkdir -p /home/user && chmod 0755 /home/user

LABEL Author="any-task-builder"
LABEL Description="Prefect project with a pre-written flow script to generate a markdown artifact."

RUN mkdir -p /home/user/project && \
    cd /home/user/project && \
    cat >flow.py <<'EOF'
from prefect import flow, task
from prefect.artifacts import create_markdown_artifact

@task
def generate_report():
    create_markdown_artifact(
        key="my-markdown-artifact",
        markdown="# Monthly Report\nThis is a test artifact.",
        description="A simple markdown artifact"
    )

@flow
def main_flow():
    generate_report()

if __name__ == "__main__":
    main_flow()
EOF

# Container contents:
#   - prefect installed for Prefect project.
#   - /home/user/project  — Prefect project directory
#   - flow.py — Pre-written flow script that creates a markdown artifact

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]
