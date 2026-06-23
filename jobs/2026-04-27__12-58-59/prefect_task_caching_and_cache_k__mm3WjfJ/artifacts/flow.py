from prefect import flow, task

def my_cache_key(context, parameters):
    return "fetch-" + parameters["url" ]

@task(cache_key_fn=my_cache_key)
def fetch_data(url: str):
    return "Data from " + url

@flow
def process_data():
    res1 = fetch_data("http://example.com")
    res2 = fetch_data("http://example.com")
    print(res1)
    print(res2)

if __name__ == "__main__":
    process_data()
