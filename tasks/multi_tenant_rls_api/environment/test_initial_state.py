import os
import shutil

PROJECT_DIR = "/home/user/myproject"


def test_node_available():
    assert shutil.which("node") is not None, "node must be in PATH"


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project dir must exist at {PROJECT_DIR}"


def test_express_installed():
    assert os.path.isdir(os.path.join(PROJECT_DIR, "node_modules", "express")), \
        "express must be installed"


def test_prisma_installed():
    assert os.path.isdir(os.path.join(PROJECT_DIR, "node_modules", "prisma")), \
        "prisma must be installed"


def test_server_does_not_exist():
    assert not os.path.isfile(os.path.join(PROJECT_DIR, "server.js")), \
        "server.js must not exist yet"
