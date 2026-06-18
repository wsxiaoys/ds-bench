import os
import shutil
import pytest

PROJECT_DIR = "/home/user/project"

def test_node_available():
    assert shutil.which("node") is not None, "node binary not found in PATH."
    assert shutil.which("npm") is not None, "npm binary not found in PATH."

def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."

def test_package_json_exists():
    package_json_path = os.path.join(PROJECT_DIR, "package.json")
    assert os.path.isfile(package_json_path), f"package.json not found at {package_json_path}."

def test_user_router_exists():
    user_router_path = os.path.join(PROJECT_DIR, "src", "server", "routers", "user.ts")
    assert os.path.isfile(user_router_path), f"user.ts not found at {user_router_path}."

def test_post_router_exists():
    post_router_path = os.path.join(PROJECT_DIR, "src", "server", "routers", "post.ts")
    assert os.path.isfile(post_router_path), f"post.ts not found at {post_router_path}."

def test_trpc_setup_exists():
    trpc_path = os.path.join(PROJECT_DIR, "src", "server", "trpc.ts")
    assert os.path.isfile(trpc_path), f"trpc.ts not found at {trpc_path}."

def test_app_router_file_exists():
    app_router_path = os.path.join(PROJECT_DIR, "src", "server", "routers", "_app.ts")
    assert os.path.isfile(app_router_path), f"_app.ts not found at {app_router_path}."

def test_api_route_exists():
    api_route_path = os.path.join(PROJECT_DIR, "src", "app", "api", "trpc", "[trpc]", "route.ts")
    assert os.path.isfile(api_route_path), f"API route not found at {api_route_path}."
