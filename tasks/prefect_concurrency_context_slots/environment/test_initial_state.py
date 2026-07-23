import importlib.util
import os
import shutil

PROJECT_DIR = "/home/user/project"


def test_prefect_importable():
    assert importlib.util.find_spec("prefect") is not None, (
        "The 'prefect' package must be importable in the environment."
    )


def test_prefect_cli_available():
    assert shutil.which("prefect") is not None, (
        "The 'prefect' CLI must be available in PATH."
    )


def test_project_directory_exists():
    assert os.path.isdir(PROJECT_DIR), (
        f"Project directory {PROJECT_DIR} must exist before the task begins."
    )


def test_proof_artifact_absent_initially():
    proof_path = os.path.join(PROJECT_DIR, "occupancy_proof.json")
    assert not os.path.exists(proof_path), (
        f"{proof_path} must not exist before the task begins; the executor creates it."
    )
