import os
import shutil
import pytest
import json

PROJECT_DIR = "/home/user/app"

def test_project_directory_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."

def test_trpc_router_exists():
    trpc_file = os.path.join(PROJECT_DIR, "src", "server", "trpc.ts")
    assert os.path.isfile(trpc_file), f"File {trpc_file} does not exist."

def test_caller_file_exists():
    caller_file = os.path.join(PROJECT_DIR, "src", "server", "caller.ts")
    assert os.path.isfile(caller_file), f"File {caller_file} does not exist."

def test_page_file_exists():
    page_file = os.path.join(PROJECT_DIR, "src", "app", "page.tsx")
    assert os.path.isfile(page_file), f"File {page_file} does not exist."

def test_client_component_exists():
    client_file = os.path.join(PROJECT_DIR, "src", "app", "ClientComponent.tsx")
    assert os.path.isfile(client_file), f"File {client_file} does not exist."
