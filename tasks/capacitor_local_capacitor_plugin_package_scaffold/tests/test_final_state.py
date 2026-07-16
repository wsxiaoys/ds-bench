import glob
import json
import os
import re
import subprocess

import pytest

PROJECT_DIR = "/home/user/capacitor-stringkit"
SRC_DIR = os.path.join(PROJECT_DIR, "src")
DIST_DIR = os.path.join(PROJECT_DIR, "dist")
ESM_DIR = os.path.join(DIST_DIR, "esm")
CJS_BUNDLE = os.path.join(DIST_DIR, "plugin.cjs.js")


@pytest.fixture(scope="session")
def built():
    """Install dependencies and run a clean build, matching the truth Setup."""
    install = subprocess.run(
        ["npm", "install"],
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True,
        timeout=600,
    )
    assert install.returncode == 0, f"'npm install' failed:\n{install.stdout}\n{install.stderr}"

    if os.path.isdir(DIST_DIR):
        subprocess.run(["rm", "-rf", DIST_DIR], check=True)

    build = subprocess.run(
        ["npm", "run", "build"],
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True,
        timeout=600,
    )
    assert build.returncode == 0, f"'npm run build' failed:\n{build.stdout}\n{build.stderr}"
    return True


def test_source_layout_exists():
    for name in ("definitions.ts", "index.ts", "web.ts"):
        path = os.path.join(SRC_DIR, name)
        assert os.path.isfile(path), f"Expected source file {path} to exist."

    index_src = open(os.path.join(SRC_DIR, "index.ts")).read()
    assert "registerPlugin" in index_src, "src/index.ts must call registerPlugin."
    assert re.search(
        r"registerPlugin\s*(<[^>]*>)?\s*\(\s*['\"]StringKit['\"]", index_src
    ), "src/index.ts must register the plugin under the name 'StringKit'."

    web_src = open(os.path.join(SRC_DIR, "web.ts")).read()
    assert "WebPlugin" in web_src, "src/web.ts must use WebPlugin from @capacitor/core."


def test_build_output_exists(built):
    for path in (
        os.path.join(ESM_DIR, "index.js"),
        os.path.join(ESM_DIR, "web.js"),
        os.path.join(ESM_DIR, "index.d.ts"),
        CJS_BUNDLE,
    ):
        assert os.path.isfile(path), f"Expected build output {path} to exist after 'npm run build'."


def test_package_json_entry_fields(built):
    with open(os.path.join(PROJECT_DIR, "package.json")) as f:
        pkg = json.load(f)

    assert pkg.get("name") == "capacitor-stringkit", (
        f"package.json name must be 'capacitor-stringkit', got {pkg.get('name')!r}."
    )
    assert pkg.get("module") == "dist/esm/index.js", (
        f"package.json module must be 'dist/esm/index.js', got {pkg.get('module')!r}."
    )
    assert pkg.get("types") == "dist/esm/index.d.ts", (
        f"package.json types must be 'dist/esm/index.d.ts', got {pkg.get('types')!r}."
    )
    assert pkg.get("main") == "dist/plugin.cjs.js", (
        f"package.json main must be 'dist/plugin.cjs.js', got {pkg.get('main')!r}."
    )

    deps = {}
    for key in ("peerDependencies", "devDependencies", "dependencies"):
        deps.update(pkg.get(key, {}) or {})
    assert "@capacitor/core" in deps, (
        "@capacitor/core must be declared as a peer/dev/regular dependency in package.json."
    )


def test_type_declarations_contain_interface(built):
    dts_files = glob.glob(os.path.join(ESM_DIR, "*.d.ts"))
    assert dts_files, f"No .d.ts declaration files found under {ESM_DIR}."
    combined = "\n".join(open(p).read() for p in dts_files)

    assert "StringKitPlugin" in combined, (
        "Emitted .d.ts declarations must include the 'StringKitPlugin' interface."
    )
    for method in ("echo", "reverse", "slugify"):
        assert method in combined, (
            f"Emitted .d.ts declarations must include the '{method}' method signature."
        )


def test_capacitor_core_is_external(built):
    bundle = open(CJS_BUNDLE).read()
    assert re.search(r"require\(\s*['\"]@capacitor/core['\"]\s*\)", bundle), (
        "dist/plugin.cjs.js must require '@capacitor/core' (it must be external, not bundled)."
    )
    assert "class WebPlugin" not in bundle, (
        "The Capacitor WebPlugin class must NOT be inlined into dist/plugin.cjs.js; "
        "'@capacitor/core' must be marked external in the bundler config."
    )


def test_functional_via_cjs_bundle(built):
    script = (
        "const { StringKit } = require('./dist/plugin.cjs.js');"
        "(async () => {"
        "  const out = {"
        "    echo: await StringKit.echo({ value: 'Hello' }),"
        "    rev1: await StringKit.reverse({ value: 'abcde' }),"
        "    rev2: await StringKit.reverse({ value: 'Capacitor' }),"
        "    slug1: await StringKit.slugify({ value: '  Hello, World! 123 ' }),"
        "    slug2: await StringKit.slugify({ value: 'Node.js & Rollup--Build' }),"
        "    slug3: await StringKit.slugify({ value: '---already---' }),"
        "  };"
        "  process.stdout.write(JSON.stringify(out));"
        "})().catch((e) => { console.error(e); process.exit(1); });"
    )
    result = subprocess.run(
        ["node", "-e", script],
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True,
        timeout=120,
    )
    assert result.returncode == 0, (
        f"Loading and calling the CommonJS bundle failed:\n{result.stdout}\n{result.stderr}"
    )
    out = json.loads(result.stdout)
    assert out["echo"] == {"value": "Hello"}, f"echo mismatch: {out['echo']}"
    assert out["rev1"] == {"value": "edcba"}, f"reverse('abcde') mismatch: {out['rev1']}"
    assert out["rev2"] == {"value": "roticapaC"}, f"reverse('Capacitor') mismatch: {out['rev2']}"
    assert out["slug1"] == {"slug": "hello-world-123"}, f"slugify mismatch: {out['slug1']}"
    assert out["slug2"] == {"slug": "node-js-rollup-build"}, f"slugify mismatch: {out['slug2']}"
    assert out["slug3"] == {"slug": "already"}, f"slugify mismatch: {out['slug3']}"


def test_functional_via_esm_web_build(built):
    script = (
        "import { StringKitWeb } from './dist/esm/web.js';"
        "const w = new StringKitWeb();"
        "const out = {"
        "  rev: await w.reverse({ value: 'Capacitor' }),"
        "  slug: await w.slugify({ value: 'Node.js & Rollup--Build' }),"
        "};"
        "process.stdout.write(JSON.stringify(out));"
    )
    result = subprocess.run(
        ["node", "--input-type=module", "-e", script],
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True,
        timeout=120,
    )
    assert result.returncode == 0, (
        f"Importing the ESM web build failed:\n{result.stdout}\n{result.stderr}"
    )
    out = json.loads(result.stdout)
    assert out["rev"] == {"value": "roticapaC"}, f"reverse('Capacitor') mismatch: {out['rev']}"
    assert out["slug"] == {"slug": "node-js-rollup-build"}, f"slugify mismatch: {out['slug']}"
