from prefect import flow

@flow(name="hello-docker-flow")
def hello_docker_flow():
    print("Hello from Docker flow!")

if __name__ == "__main__":
    hello_docker_flow.deploy(
        name="docker-deployment",
        work_pool_name="my-docker-pool",
        image="my-prefect-image:latest",
        build=False
    )
