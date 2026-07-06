from prefect import flow


@flow
def hello_docker_flow() -> None:
    """A simple flow that prints a greeting message."""
    print("Hello from a Prefect flow running in Docker!")
    print("This flow is running in a Docker container via the my-docker-pool work pool.")


if __name__ == "__main__":
    hello_docker_flow()
