import json
import os
import shutil
import subprocess

PROJECT_DIR = "/home/user/myapp"
ANDROID_DIR = os.path.join(PROJECT_DIR, "android")
ANDROID_APP_SRC = os.path.join(
    ANDROID_DIR, "app", "src", "main", "java", "com", "example", "myapp"
)


def test_node_available():
    assert shutil.which("node") is not None, "node binary not found in PATH."


def test_node_version_22_or_higher():
    result = subprocess.run(
        ["node", "--version"], capture_output=True, text=True, check=True
    )
    version = result.stdout.strip().lstrip("v")
    major = int(version.split(".")[0])
    assert major >= 22, f"Expected Node.js >= 22, got {version}."


def test_npm_available():
    assert shutil.which("npm") is not None, "npm binary not found in PATH."


def test_java_available():
    assert shutil.which("java") is not None, "java binary not found in PATH."


def test_unzip_available():
    assert shutil.which("unzip") is not None, "unzip binary not found in PATH."


def test_android_sdk_root_set():
    sdk_root = os.environ.get("ANDROID_SDK_ROOT") or os.environ.get("ANDROID_HOME")
    assert sdk_root, "ANDROID_SDK_ROOT/ANDROID_HOME environment variable is not set."
    assert os.path.isdir(sdk_root), f"Android SDK directory {sdk_root} does not exist."


def test_project_directory_exists():
    assert os.path.isdir(PROJECT_DIR), f"Project directory {PROJECT_DIR} does not exist."


def test_capacitor_config_file_exists():
    candidates = [
        os.path.join(PROJECT_DIR, "capacitor.config.ts"),
        os.path.join(PROJECT_DIR, "capacitor.config.json"),
    ]
    assert any(os.path.isfile(p) for p in candidates), (
        "Expected a capacitor.config.ts or capacitor.config.json file in the project root."
    )


def test_package_json_exists_and_has_required_capacitor_packages():
    pkg_path = os.path.join(PROJECT_DIR, "package.json")
    assert os.path.isfile(pkg_path), f"{pkg_path} does not exist."
    with open(pkg_path) as f:
        pkg = json.load(f)
    deps = pkg.get("dependencies", {})
    for required in [
        "@capacitor/core",
        "@capacitor/android",
        "@capacitor/status-bar",
        "@capacitor/app",
    ]:
        assert required in deps, (
            f"{required} is missing from package.json dependencies."
        )


def test_dist_directory_exists_with_index_html():
    dist_dir = os.path.join(PROJECT_DIR, "dist")
    assert os.path.isdir(dist_dir), f"Expected dist directory at {dist_dir}."
    index_html = os.path.join(dist_dir, "index.html")
    assert os.path.isfile(index_html), f"Expected {index_html} to exist."


def test_src_directory_exists():
    src_dir = os.path.join(PROJECT_DIR, "src")
    assert os.path.isdir(src_dir), f"Expected web source directory at {src_dir}."


def test_android_project_scaffolded():
    assert os.path.isdir(ANDROID_DIR), f"Android project directory {ANDROID_DIR} does not exist."
    gradlew = os.path.join(ANDROID_DIR, "gradlew")
    assert os.path.isfile(gradlew), f"Gradle wrapper script {gradlew} does not exist."
    assert os.access(gradlew, os.X_OK), f"Gradle wrapper {gradlew} is not executable."


def test_main_activity_exists():
    main_activity = os.path.join(ANDROID_APP_SRC, "MainActivity.java")
    assert os.path.isfile(main_activity), (
        f"MainActivity.java not found at {main_activity}."
    )
    with open(main_activity) as f:
        content = f.read()
    assert "package com.example.myapp;" in content, (
        "MainActivity.java does not declare package com.example.myapp."
    )
    assert "BridgeActivity" in content, (
        "MainActivity.java does not extend BridgeActivity."
    )


def test_main_activity_does_not_register_navbar_plugin_initially():
    main_activity = os.path.join(ANDROID_APP_SRC, "MainActivity.java")
    with open(main_activity) as f:
        content = f.read()
    assert "registerPlugin(NavBarPlugin.class)" not in content, (
        "MainActivity.java should not yet register NavBarPlugin before the task starts."
    )


def test_navbar_plugin_java_file_not_yet_present():
    plugin_path = os.path.join(ANDROID_APP_SRC, "NavBarPlugin.java")
    assert not os.path.exists(plugin_path), (
        f"{plugin_path} should not exist before the task starts."
    )


def test_no_custom_plugin_file_present_initially():
    if not os.path.isdir(ANDROID_APP_SRC):
        return
    java_files = [
        f for f in os.listdir(ANDROID_APP_SRC) if f.endswith(".java")
    ]
    # Only MainActivity.java should be present at start.
    assert java_files == ["MainActivity.java"], (
        f"Expected only MainActivity.java in {ANDROID_APP_SRC} initially, "
        f"found {java_files}."
    )


def test_theme_ts_module_not_yet_present():
    module = os.path.join(PROJECT_DIR, "src", "theme.ts")
    assert not os.path.exists(module), (
        f"{module} should not exist before the task starts."
    )


def test_node_modules_required_packages_installed():
    for pkg_subpath in [
        ("@capacitor", "core"),
        ("@capacitor", "status-bar"),
        ("@capacitor", "app"),
    ]:
        installed = os.path.join(PROJECT_DIR, "node_modules", *pkg_subpath)
        assert os.path.isdir(installed), (
            f"Expected {'/'.join(pkg_subpath)} to be installed under node_modules at {installed}."
        )
