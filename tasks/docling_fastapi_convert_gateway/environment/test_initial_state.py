import importlib
import os
import subprocess
import sys

PROJECT_DIR = "/home/user/project"
ASSETS_DIR = os.path.join(PROJECT_DIR, "assets")
HANDBOOK = os.path.join(ASSETS_DIR, "safety_handbook.html")
RELEASE_NOTES = os.path.join(ASSETS_DIR, "release_notes.md")
CORRUPT_INPUT = os.path.join(ASSETS_DIR, "corrupt_input.xyz")


def test_project_directory_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."


def test_project_directory_is_writable():
    probe = os.path.join(PROJECT_DIR, ".initial_state_probe")
    try:
        with open(probe, "w", encoding="utf-8") as handle:
            handle.write("ok")
    except OSError as exc:  # pragma: no cover - environment failure
        raise AssertionError(f"Project directory {PROJECT_DIR} is not writable: {exc}")
    finally:
        if os.path.exists(probe):
            os.remove(probe)


def test_docling_library_importable():
    try:
        importlib.import_module("docling")
    except Exception as exc:  # pragma: no cover - environment failure
        raise AssertionError(f"The docling library is not importable: {exc}")


def test_docling_core_importable():
    try:
        importlib.import_module("docling_core")
    except Exception as exc:  # pragma: no cover - environment failure
        raise AssertionError(f"The docling_core library is not importable: {exc}")


def test_web_server_dependencies_importable():
    for module_name in ("fastapi", "uvicorn", "httpx", "starlette"):
        try:
            importlib.import_module(module_name)
        except Exception as exc:  # pragma: no cover - environment failure
            raise AssertionError(
                f"Required preinstalled package '{module_name}' is not importable: {exc}"
            )


def test_pytest_available():
    result = subprocess.run(
        [sys.executable, "-m", "pytest", "--version"],
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, f"pytest is not usable: {result.stderr or result.stdout}"


def test_docling_artifacts_path_env_configured():
    artifacts_path = os.environ.get("DOCLING_ARTIFACTS_PATH")
    assert artifacts_path, "DOCLING_ARTIFACTS_PATH is not set in the environment."
    assert os.path.isdir(artifacts_path), (
        f"DOCLING_ARTIFACTS_PATH points at {artifacts_path}, which is not an existing directory."
    )


def test_assets_directory_exists():
    assert os.path.isdir(ASSETS_DIR), f"Assets directory {ASSETS_DIR} does not exist."


def test_handbook_fixture_present_with_expected_content():
    assert os.path.isfile(HANDBOOK), f"Fixture {HANDBOOK} does not exist."
    content = open(HANDBOOK, encoding="utf-8").read()
    for marker in ("Field Safety Handbook", "Incident Response", "Equipment Checklist"):
        assert marker in content, f"Fixture {HANDBOOK} is missing the expected text '{marker}'."
    assert "<table" in content, f"Fixture {HANDBOOK} is expected to contain a table."


def test_release_notes_fixture_present_with_expected_content():
    assert os.path.isfile(RELEASE_NOTES), f"Fixture {RELEASE_NOTES} does not exist."
    content = open(RELEASE_NOTES, encoding="utf-8").read()
    for marker in ("Release Notes 4.2", "Known Issues"):
        assert marker in content, (
            f"Fixture {RELEASE_NOTES} is missing the expected text '{marker}'."
        )


def test_corrupt_fixture_present():
    assert os.path.isfile(CORRUPT_INPUT), f"Fixture {CORRUPT_INPUT} does not exist."
    assert os.path.getsize(CORRUPT_INPUT) > 0, f"Fixture {CORRUPT_INPUT} is empty."


def test_service_entrypoint_not_yet_created():
    entrypoint = os.path.join(PROJECT_DIR, "service", "main.py")
    assert not os.path.exists(entrypoint), (
        f"{entrypoint} already exists before the task starts; the executor must create it."
    )


def test_gateway_port_is_free():
    import socket

    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(2)
        connected = sock.connect_ex(("127.0.0.1", 8077))
    assert connected != 0, "TCP port 8077 on 127.0.0.1 is already in use before the task starts."
