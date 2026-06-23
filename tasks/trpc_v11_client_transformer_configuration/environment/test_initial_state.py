import os
import shutil

PROJECT_DIR = "/home/user/project"

def test_npm_available():
    assert shutil.which("npm") is not None, "npm binary not found in PATH."

def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."

def test_package_json_exists():
    package_json_path = os.path.join(PROJECT_DIR, "package.json")
    assert os.path.isfile(package_json_path), f"File {package_json_path} does not exist."

def test_server_router_exists():
    server_router_path = os.path.join(PROJECT_DIR, "server", "router.ts")
    assert os.path.isfile(server_router_path), f"File {server_router_path} does not exist."

def test_client_trpc_exists():
    client_trpc_path = os.path.join(PROJECT_DIR, "client", "trpc.ts")
    assert os.path.isfile(client_trpc_path), f"File {client_trpc_path} does not exist."

def test_initial_transformer_configuration():
    client_trpc_path = os.path.join(PROJECT_DIR, "client", "trpc.ts")
    with open(client_trpc_path) as f:
        content = f.read()
    # It should have the transformer in the root configuration (v10 style)
    assert "transformer: superjson" in content, "Expected initial client/trpc.ts to contain transformer: superjson in the root config."
