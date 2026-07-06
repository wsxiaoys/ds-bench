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
