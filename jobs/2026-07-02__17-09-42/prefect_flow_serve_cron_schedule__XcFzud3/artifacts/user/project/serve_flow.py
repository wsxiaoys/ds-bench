from prefect import flow
from prefect.blocks.system import Secret


@flow
def my_flow():
    """Flow that loads the my-api-key Secret block and prints its value."""
    secret = Secret.load("my-api-key")
    value = secret.get()
    print(value)
    return value


if __name__ == "__main__":
    my_flow.serve(name="my-deployment", cron="0 9 * * *")
