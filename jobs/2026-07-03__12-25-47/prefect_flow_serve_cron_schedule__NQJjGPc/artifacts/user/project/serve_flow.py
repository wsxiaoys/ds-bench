from prefect import flow
from prefect.blocks.system import Secret


@flow(name="my_flow")
def my_flow():
    secret_block = Secret.load("my-api-key")
    print(secret_block.get())


if __name__ == "__main__":
    my_flow.serve(name="my-deployment", cron="0 9 * * *")
