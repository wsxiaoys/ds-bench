import os
import shutil
import subprocess

PROJECT_DIR = "/home/user/project"


def test_node_available():
    assert shutil.which("node") is not None, "node binary not found in PATH."


def test_npm_available():
    assert shutil.which("npm") is not None, "npm binary not found in PATH."


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."


def test_package_json_exists():
    pkg = os.path.join(PROJECT_DIR, "package.json")
    assert os.path.isfile(pkg), f"package.json not found at {pkg}."


def test_sequelize_installed_and_importable():
    result = subprocess.run(
        ["node", "-e", "const s=require('sequelize'); if(!s.Sequelize){process.exit(2)} console.log(s.version||'ok')"],
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, (
        f"sequelize is not importable in {PROJECT_DIR}. "
        f"stdout={result.stdout!r} stderr={result.stderr!r}"
    )


def test_sequelize_major_version_is_6():
    result = subprocess.run(
        ["node", "-e", "process.stdout.write(require('sequelize').version||'')"],
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, (
        f"Unable to read sequelize version. stderr={result.stderr!r}"
    )
    version = result.stdout.strip()
    assert version.startswith("6."), f"Expected Sequelize v6.x, found {version!r}."


def test_sqlite3_driver_installed():
    result = subprocess.run(
        ["node", "-e", "require('sqlite3'); console.log('ok')"],
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, (
        f"sqlite3 driver is not importable in {PROJECT_DIR}. stderr={result.stderr!r}"
    )
