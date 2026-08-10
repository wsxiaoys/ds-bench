import pytest
import subprocess
import os
import socket
import requests
from xprocess import ProcessStarter
from pochi_verifier import PochiVerifier

PROJECT_DIR = "/home/user/app"
PORT = 3000
HOST = "127.0.0.1"
BASE_URL = f"http://{HOST}:{PORT}"

@pytest.fixture(scope="session")
def browser_verifier():
    return PochiVerifier()

@pytest.fixture(scope="session")
def start_app(xprocess):
    class Starter(ProcessStarter):
        name = "start_app"
        args = ["wasp", "start"]
        env = os.environ.copy()
        popen_kwargs = {
            "cwd": PROJECT_DIR,
            "text": True,
        }
        timeout = 180

        def startup_check(self):
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                if s.connect_ex((HOST, PORT)) != 0:
                    return False
            try:
                resp = requests.get(BASE_URL, timeout=20)
                return resp.status_code < 500
            except requests.RequestException:
                return False

    info = xprocess.getinfo(Starter.name)
    try:
        # Run db migration before starting the app
        subprocess.run(["wasp", "db", "migrate-dev", "--name", "init"], cwd=PROJECT_DIR, env=os.environ.copy(), check=True)
        xprocess.ensure(Starter.name, Starter)
    except Exception as e:
        print(f"Startup failed: {e}")
        # Print logs if migration or startup failed
        if os.path.exists(info.logpath):
            with open(info.logpath, "r") as f:
                print(f"App logs:\n{f.read()}")
        raise e
    yield
    info.terminate()

def test_task_verification(start_app, browser_verifier):
    reason = "Full-text search, multi-faceted filtering, sorting, and cursor-based pagination must be correctly implemented and verified."
    truth = (
        "Navigate to http://127.0.0.1:3000. Perform the following actions: "
        "1. Initial Load: Verify that the product list (container with data-testid=\"product-list\") contains all 6 seeded products. "
        "Verify that the facet categories container (data-testid=\"facet-categories\") and facet brands container (data-testid=\"facet-brands\") show correct initial counts: Electronics (2), Home & Kitchen (2), Furniture (2), VoltCharge (2), NutriBlend (2), ErgoComfort (2). "
        "2. Full-Text Search: Type 'chair' into the search input (data-testid=\"search-input\"). "
        "Verify that only the 2 chairs are displayed: 'Ergonomic Office Desk Chair' and 'Leather Executive Swivel Chair'. "
        "Verify that the facet counts update dynamically to: Furniture (2), ErgoComfort (2), and other categories/brands show 0. "
        "3. Multi-Faceted Filtering: With 'chair' still in the search input, check the 'In Stock' checkbox (data-testid=\"instock-checkbox\"). "
        "Verify that only 'Leather Executive Swivel Chair' is displayed (since the Ergonomic chair is out of stock). "
        "Verify that the facet counts update to: Furniture (1), ErgoComfort (1). "
        "4. Sorting: Clear the search input and uncheck 'In Stock'. Select 'price_asc' in the sort select (data-testid=\"sort-select\"). "
        "Verify that the products are listed in ascending order of price: 'SuperFast Wireless Charger' ($29.99), 'VoltCharge Portable Power Bank' ($39.99), 'NutriBlend Compact Juicer' ($49.99), etc. "
        "5. Pagination: Select 'price_asc' and verify pagination. (Note: if pagination limit is hardcoded to 2 in the test or UI, we verify that clicking the 'Load More' button with data-testid=\"load-more-button\" appends the next page of products successfully)."
    )
    result = browser_verifier.verify(
        reason=reason,
        truth=truth,
        use_browser_agent=True,
        trajectory_dir="/logs/verifier/pochi/test_task_verification"
    )
    assert result.status == "pass", f"Browser verification failed: {result.reason}"
