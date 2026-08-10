import os
import shutil

PROJECT_DIR = "/home/user/kanban"


def test_wasp_binary_available():
    assert shutil.which("wasp") is not None, "wasp CLI not found in PATH."


def test_node_binary_available():
    assert shutil.which("node") is not None, "node binary not found in PATH."


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."


def test_main_wasp_ts_exists():
    main_wasp = os.path.join(PROJECT_DIR, "main.wasp.ts")
    assert os.path.isfile(main_wasp), (
        f"Expected a scaffolded Wasp TypeScript spec at {main_wasp}."
    )


def test_src_dir_exists():
    src_dir = os.path.join(PROJECT_DIR, "src")
    assert os.path.isdir(src_dir), f"Expected project source directory at {src_dir}."
