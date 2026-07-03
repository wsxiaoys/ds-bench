from prefect import flow, task


def cache_key(context, parameters):
    return "fetch-" + parameters["url"]


@task(cache_key_fn=cache_key)
def fetch_data(url: str):
    return "Data from " + url


@flow
def process_data():
    result1 = fetch_data("http://example.com")
    result2 = fetch_data("http://example.com")
    print(result1)
    print(result2)


if __name__ == "__main__":
    process_data()