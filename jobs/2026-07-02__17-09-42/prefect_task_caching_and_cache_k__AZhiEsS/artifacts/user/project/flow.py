from prefect import task, flow


def cache_key_for_fetch(context, parameters):
    return "fetch-" + parameters["url"]


@task(cache_key_fn=cache_key_for_fetch)
def fetch_data(url: str) -> str:
    return "Data from " + url


@flow
def process_data():
    result_1 = fetch_data("http://example.com")
    result_2 = fetch_data("http://example.com")
    print(result_1)
    print(result_2)


if __name__ == "__main__":
    process_data()