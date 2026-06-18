# Prefect Task Caching

## Background
Prefect provides caching to prevent re-execution of expensive tasks. You can use `cache_key_fn` to define custom caching logic.

## Requirements
- Create a Python script `/home/user/project/flow.py`.
- Define a Prefect task named `fetch_data(url: str)` that takes a string URL as input and returns the string `"Data from " + url`.
- The `fetch_data` task must use `cache_key_fn` to cache its output based on the `url` argument. The cache key function should accept `context` and `parameters` and return the string `"fetch-" + parameters["url"]`.
- Define a Prefect flow named `process_data()` that calls `fetch_data("http://example.com")` twice.
- The flow should print the result of both calls.
- The script must execute the `process_data()` flow when run directly.

## Implementation Guide
1. Ensure you are working in `/home/user/project`.
2. Write the script `flow.py` with the required task and flow.
3. Run the script using `python3 flow.py` to verify it works.

## Constraints
- Project path: /home/user/project
- The script must use Prefect 3.0 syntax (e.g., `@task`, `@flow`).