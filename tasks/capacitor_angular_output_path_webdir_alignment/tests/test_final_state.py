import json
import os
import re
import shutil
import subprocess

import pytest

PROJECT_DIR = "/home/user/mobileapp"
DIST_DIR = os.path.join(PROJECT_DIR, "dist")
CAP_CONFIG = os.path.join(PROJECT_DIR, "capacitor.config.ts")
ANGULAR_JSON = os.path.join(PROJECT_DIR, "angular.json")
CAP_BIN = os.path.join(PROJECT_DIR, "node_modules", ".bin", "cap")

WEB_ASSET_ERROR = "Could not find the web assets directory"
INDEX_ERROR = "must contain an index.html file"


def _find_built_index_dirs():
    """Return absolute realpaths of directories under dist/ that hold a genuine
    Angular-built index.html (contains <app-root and references a .js bundle)."""
    matches = []
    for root, _dirs, files in os.walk(DIST_DIR):
        if "index.html" in files:
            index_path = os.path.join(root, "index.html")
            with open(index_path, encoding="utf-8", errors="ignore") as f:
                content = f.read()
            if "<app-root" in content and re.search(r"\.js", content):
                matches.append(os.path.realpath(root))
    return matches


@pytest.fixture(scope="session")
def build_output():
    """Setup: wipe stale output and build the Angular app fresh, offline."""
    if os.path.isdir(DIST_DIR):
        shutil.rmtree(DIST_DIR)

    result = subprocess.run(
        ["npm", "run", "build"],
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True,
        timeout=900,
    )
    print("=== npm run build stdout ===")
    print(result.stdout)
    print("=== npm run build stderr ===")
    print(result.stderr)
    assert result.returncode == 0, (
        f"'npm run build' failed with code {result.returncode}. "
        f"stderr:\n{result.stderr}"
    )

    built_dirs = _find_built_index_dirs()
    assert len(built_dirs) >= 1, (
        f"No genuine Angular index.html found under {DIST_DIR} after building."
    )
    # Deduplicate while keeping determinism.
    built_dirs = sorted(set(built_dirs))
    return built_dirs


def _read_webdir():
    with open(CAP_CONFIG, encoding="utf-8") as f:
        content = f.read()
    match = re.search(r"webDir\s*:\s*['\"]([^'\"]+)['\"]", content)
    assert match is not None, "Could not read the webDir value from capacitor.config.ts."
    return match.group(1)


def test_build_produces_single_angular_site(build_output):
    """Truth step 1: exactly one genuine Angular index.html exists under dist/."""
    assert len(build_output) == 1, (
        f"Expected exactly one built Angular index.html under {DIST_DIR}, "
        f"found containing dirs: {build_output}"
    )


def test_webdir_matches_built_output(build_output):
    """Truth step 2: Capacitor webDir resolves to the folder holding the built index.html
    and is located inside the dist/ build output."""
    built_dir = build_output[0]
    web_dir = _read_webdir()

    resolved_webdir = os.path.realpath(os.path.join(PROJECT_DIR, web_dir))
    assert os.path.isdir(resolved_webdir), (
        f"webDir '{web_dir}' does not resolve to an existing directory ({resolved_webdir})."
    )
    assert os.path.isfile(os.path.join(resolved_webdir, "index.html")), (
        f"The webDir '{web_dir}' ({resolved_webdir}) does not contain an index.html file."
    )
    assert resolved_webdir == built_dir, (
        f"webDir '{web_dir}' resolves to {resolved_webdir}, but the freshly built "
        f"index.html lives in {built_dir}. They must be the same directory."
    )

    dist_real = os.path.realpath(DIST_DIR)
    assert resolved_webdir.startswith(dist_real + os.sep) or resolved_webdir == dist_real, (
        f"webDir must point inside the real build output ({dist_real}); "
        f"got {resolved_webdir}. Do not point webDir at a hand-populated folder."
    )


def test_angular_output_path_aligned(build_output):
    """Truth step 3: angular.json build outputPath is consistent with the built output dir."""
    built_dir = build_output[0]
    with open(ANGULAR_JSON, encoding="utf-8") as f:
        angular_cfg = json.load(f)

    output_path = None
    for _name, project in angular_cfg.get("projects", {}).items():
        targets = project.get("architect") or project.get("targets") or {}
        build_target = targets.get("build")
        if not build_target:
            continue
        options = build_target.get("options", {})
        if "outputPath" in options:
            output_path = options["outputPath"]
            break

    assert output_path is not None, (
        "Could not find a build target 'outputPath' in angular.json."
    )

    if isinstance(output_path, str):
        base = output_path
    elif isinstance(output_path, dict):
        base = output_path.get("base", "")
    else:
        pytest.fail(f"Unexpected outputPath type in angular.json: {type(output_path)}")

    base_dir = os.path.realpath(os.path.join(PROJECT_DIR, base))
    # The builder writes index.html either directly into the base or into a sub-folder
    # (default 'browser') of the base. Either way the built dir must live under the base.
    assert built_dir == base_dir or built_dir.startswith(base_dir + os.sep), (
        f"angular.json outputPath base resolves to {base_dir}, which is not consistent "
        f"with the actual built output directory {built_dir}. The Angular outputPath and "
        f"Capacitor webDir must be aligned to the same location."
    )


def test_capacitor_asset_detection_succeeds(build_output):
    """Truth step 4: `cap copy` runs Capacitor's web asset detection without the
    friction errors (no native platform is added, so only webDir is validated)."""
    assert os.path.isfile(CAP_BIN), f"Capacitor CLI not found at {CAP_BIN}."

    result = subprocess.run(
        [CAP_BIN, "copy"],
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True,
        timeout=300,
    )
    combined = (result.stdout or "") + "\n" + (result.stderr or "")
    print("=== cap copy output ===")
    print(combined)

    assert WEB_ASSET_ERROR not in combined, (
        f"'cap copy' still reports a missing web assets directory:\n{combined}"
    )
    assert INDEX_ERROR not in combined, (
        f"'cap copy' still reports a missing index.html in webDir:\n{combined}"
    )
