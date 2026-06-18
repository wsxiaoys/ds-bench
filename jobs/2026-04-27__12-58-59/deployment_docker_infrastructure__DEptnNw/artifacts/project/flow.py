from prefect import flow

@flow
def hello_docker_flow():
    print("Hello from Docker!")

if __name__ == "__main__":
    hello_docker_flow()
