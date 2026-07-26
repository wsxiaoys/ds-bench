import json
import os
import shutil
import socket

PROJECT_DIR = "/home/user/faceted-search"
SEED_FILE = os.path.join(PROJECT_DIR, "seed", "products.json")
APP_PORT = 47615

REQUIRED_KEYS = {"id", "name", "description", "category", "price", "inStock", "rating", "createdAt"}
VALID_CATEGORIES = {"electronics", "books", "clothing", "home", "toys"}


def test_node_available():
    assert shutil.which("node") is not None, "node binary not found in PATH."


def test_npm_available():
    assert shutil.which("npm") is not None, "npm binary not found in PATH."


def test_project_directory_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."


def test_seed_file_exists():
    assert os.path.isfile(SEED_FILE), f"Seed catalog file {SEED_FILE} does not exist."


def test_seed_file_has_twenty_valid_products():
    with open(SEED_FILE) as f:
        data = json.load(f)
    assert isinstance(data, list), "Seed catalog must be a JSON array."
    assert len(data) == 20, f"Seed catalog must contain exactly 20 products, found {len(data)}."
    names = set()
    for product in data:
        assert isinstance(product, dict), "Each seed product must be a JSON object."
        assert REQUIRED_KEYS.issubset(product.keys()), (
            f"Seed product missing required keys; expected {sorted(REQUIRED_KEYS)}, "
            f"got {sorted(product.keys())}."
        )
        assert product["category"] in VALID_CATEGORIES, (
            f"Seed product has invalid category {product['category']!r}; "
            f"must be one of {sorted(VALID_CATEGORIES)}."
        )
        names.add(product["name"])
    assert "Aurora Wireless Headphones" in names, (
        "Expected known seed product 'Aurora Wireless Headphones' to be present."
    )
    assert "Galactic Building Blocks" in names, (
        "Expected known seed product 'Galactic Building Blocks' to be present."
    )


def test_app_port_is_free():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        result = sock.connect_ex(("127.0.0.1", APP_PORT))
    assert result != 0, (
        f"Port {APP_PORT} is already in use; it must be free before the task starts."
    )
