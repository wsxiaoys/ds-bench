import os
import shutil
import subprocess

PROJECT_DIR = "/home/user/myproject"


def test_node_available():
    assert shutil.which("node") is not None, "node must be in PATH"


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project dir must exist at {PROJECT_DIR}"


def test_npm_packages_installed():
    assert os.path.isdir(os.path.join(PROJECT_DIR, "node_modules")), \
        "node_modules must exist — express and prisma must be installed"


def test_express_installed():
    express_path = os.path.join(PROJECT_DIR, "node_modules", "express")
    assert os.path.isdir(express_path), "express must be installed in node_modules"


def test_prisma_installed():
    prisma_path = os.path.join(PROJECT_DIR, "node_modules", "prisma")
    assert os.path.isdir(prisma_path), "prisma must be installed in node_modules"


def test_server_script_does_not_exist():
    assert not os.path.isfile(os.path.join(PROJECT_DIR, "server.js")), \
        "server.js must not exist yet — agent must create it"
