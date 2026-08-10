from prefect import flow

@flow(log_prints=True)
def pulse():
    print("Pulse flow running")

if __name__ == "__main__":
    pulse()
