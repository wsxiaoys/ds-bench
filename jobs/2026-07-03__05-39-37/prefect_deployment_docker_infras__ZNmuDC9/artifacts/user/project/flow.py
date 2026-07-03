"""A simple Prefect flow to be deployed in a Docker container."""

from prefect import flow


@flow(name="hello-docker-flow")
def hello_docker_flow() -> None:
    """Print a greeting message from inside a Docker container."""
    print("Hello from Docker! This flow is running inside a Docker container.")


if __name__ == "__main__":
    hello_docker_flow()