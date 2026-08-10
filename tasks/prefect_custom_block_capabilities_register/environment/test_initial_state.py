import os
import shutil

PROJECT_DIR = "/home/user/project"


def test_prefect_cli_available():
    assert shutil.which("prefect") is not None, "prefect CLI not found in PATH."


def test_prefect_importable_and_version():
    import prefect

    assert prefect.__version__ == "3.7.8", (
        f"Expected Prefect version 3.7.8 but found {prefect.__version__}."
    )


def test_block_core_importable():
    from prefect.blocks.core import Block  # noqa: F401


def test_project_directory_exists():
    assert os.path.isdir(PROJECT_DIR), (
        f"Project directory {PROJECT_DIR} does not exist."
    )


def test_prefect_home_configured():
    assert os.environ.get("PREFECT_HOME") == "/home/user/.prefect", (
        "PREFECT_HOME is expected to be set to /home/user/.prefect."
    )
