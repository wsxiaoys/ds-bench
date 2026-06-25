import os
import socket
import pytest
import requests
from xprocess import ProcessStarter

PROJECT_DIR = "/home/user/myproject"

@pytest.fixture(scope="session")
def app_port():
    """Finds and yields a free port on localhost."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(('', 0))  # Bind to any available port
        port = s.getsockname()[1]  # Get the assigned port
        yield port

@pytest.fixture(scope="session")
def start_server(xprocess, app_port):
    """
    Starts the node service using xprocess. Confirms readiness via port check.
    """
    class Starter(ProcessStarter):
        name = "api_server"
        args = ["node", "index.js", "--port", str(app_port)]
        env = os.environ.copy()
        popen_kwargs = {
            "cwd": PROJECT_DIR,
            "text": True,
        }
        timeout = 180
        terminate_on_interrupt = True

        def startup_check(self):
            """
            Custom check: returns True if the target port is accepting connections.
            xprocess calls this repeatedly until it returns True or times out.
            """
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                return s.connect_ex(("localhost", app_port)) == 0

    # ensure() starts the process and blocks until startup_check is True
    pid, logpath = xprocess.ensure(Starter.name, Starter)

    # print the logs after the service has started
    with open(logpath, "r") as f:
        logs = f.read()
        print("=== Begin: Captured xprocess logfile after started =============================")
        print(logs)
        print("===== End: Captured xprocess logfile after started =============================")

    yield

    # teardown: print the logs and terminate the service
    with open(logpath, "r") as f:
        logs = f.read()
        print("=== Begin: Captured xprocess logfile when teardown =============================")
        print(logs)
        print("===== End: Captured xprocess logfile when teardown =============================")

    info = xprocess.getinfo(Starter.name)
    info.terminate()

@pytest.fixture(scope="session")
def test_data():
    return {}

def test_create_user(start_server, app_port, test_data):
    response = requests.post(f"http://localhost:{app_port}/users", json={"name": "Alice"})
    assert response.status_code == 201, f"Expected status 201, got {response.status_code}"
    data = response.json()
    assert "id" in data, "Response missing 'id'"
    assert data.get("name") == "Alice", f"Expected name 'Alice', got {data.get('name')}"
    test_data["user_id"] = data["id"]

def test_create_product(start_server, app_port, test_data):
    response = requests.post(f"http://localhost:{app_port}/products", json={"title": "Laptop"})
    assert response.status_code == 201, f"Expected status 201, got {response.status_code}"
    data = response.json()
    assert "id" in data, "Response missing 'id'"
    assert data.get("title") == "Laptop", f"Expected title 'Laptop', got {data.get('title')}"
    test_data["product_id"] = data["id"]

def test_create_image_for_user(start_server, app_port, test_data):
    user_id = test_data["user_id"]
    payload = {
        "url": "http://example.com/alice.jpg",
        "imageableId": user_id,
        "imageableType": "user"
    }
    response = requests.post(f"http://localhost:{app_port}/images", json=payload)
    assert response.status_code == 201, f"Expected status 201, got {response.status_code}"
    data = response.json()
    assert "id" in data, "Response missing 'id'"
    assert data.get("url") == "http://example.com/alice.jpg", "Incorrect url"
    assert data.get("imageableId") == user_id, "Incorrect imageableId"
    assert data.get("imageableType") == "user", "Incorrect imageableType"
    test_data["user_image_id"] = data["id"]

def test_create_image_for_product(start_server, app_port, test_data):
    product_id = test_data["product_id"]
    payload = {
        "url": "http://example.com/laptop.jpg",
        "imageableId": product_id,
        "imageableType": "product"
    }
    response = requests.post(f"http://localhost:{app_port}/images", json=payload)
    assert response.status_code == 201, f"Expected status 201, got {response.status_code}"
    data = response.json()
    assert "id" in data, "Response missing 'id'"
    assert data.get("url") == "http://example.com/laptop.jpg", "Incorrect url"
    assert data.get("imageableId") == product_id, "Incorrect imageableId"
    assert data.get("imageableType") == "product", "Incorrect imageableType"
    test_data["product_image_id"] = data["id"]

def test_get_user_with_images(start_server, app_port, test_data):
    user_id = test_data["user_id"]
    response = requests.get(f"http://localhost:{app_port}/users/{user_id}")
    assert response.status_code == 200, f"Expected status 200, got {response.status_code}"
    data = response.json()
    assert "profilePictures" in data, "Response missing 'profilePictures' array"
    assert isinstance(data["profilePictures"], list), "'profilePictures' should be an array"
    assert len(data["profilePictures"]) > 0, "'profilePictures' array is empty"
    urls = [img.get("url") for img in data["profilePictures"]]
    assert "http://example.com/alice.jpg" in urls, f"Expected image URL not found in {urls}"

def test_get_product_with_images(start_server, app_port, test_data):
    product_id = test_data["product_id"]
    response = requests.get(f"http://localhost:{app_port}/products/{product_id}")
    assert response.status_code == 200, f"Expected status 200, got {response.status_code}"
    data = response.json()
    assert "productPhotos" in data, "Response missing 'productPhotos' array"
    assert isinstance(data["productPhotos"], list), "'productPhotos' should be an array"
    assert len(data["productPhotos"]) > 0, "'productPhotos' array is empty"
    urls = [img.get("url") for img in data["productPhotos"]]
    assert "http://example.com/laptop.jpg" in urls, f"Expected image URL not found in {urls}"

def test_get_user_image_with_polymorphic_association(start_server, app_port, test_data):
    user_image_id = test_data["user_image_id"]
    response = requests.get(f"http://localhost:{app_port}/images/{user_image_id}")
    assert response.status_code == 200, f"Expected status 200, got {response.status_code}"
    data = response.json()
    assert "imageable" in data, "Response missing 'imageable' object"
    imageable = data["imageable"]
    assert imageable is not None, "'imageable' object is null"
    assert imageable.get("name") == "Alice", f"Expected imageable.name 'Alice', got {imageable.get('name')}"

def test_get_product_image_with_polymorphic_association(start_server, app_port, test_data):
    product_image_id = test_data["product_image_id"]
    response = requests.get(f"http://localhost:{app_port}/images/{product_image_id}")
    assert response.status_code == 200, f"Expected status 200, got {response.status_code}"
    data = response.json()
    assert "imageable" in data, "Response missing 'imageable' object"
    imageable = data["imageable"]
    assert imageable is not None, "'imageable' object is null"
    assert imageable.get("title") == "Laptop", f"Expected imageable.title 'Laptop', got {imageable.get('title')}"
