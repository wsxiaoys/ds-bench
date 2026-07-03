from prefect import flow


@flow
def hello_docker_flow():
    print("Hello from a Docker container!")


if __name__ == "__main__":
    hello_docker_flow()
