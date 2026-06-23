import os
import re
import subprocess

import pytest

PROJECT_DIR = "/home/user/myapp"
ANDROID_DIR = os.path.join(PROJECT_DIR, "android")
ANDROID_APP_SRC = os.path.join(
    ANDROID_DIR, "app", "src", "main", "java", "com", "example", "myapp"
)
PLUGIN_JAVA = os.path.join(ANDROID_APP_SRC, "NavBarPlugin.java")
MAIN_ACTIVITY = os.path.join(ANDROID_APP_SRC, "MainActivity.java")
THEME_TS = os.path.join(PROJECT_DIR, "src", "theme.ts")
DEBUG_APK = os.path.join(
    ANDROID_DIR, "app", "build", "outputs", "apk", "debug", "app-debug.apk"
)


def _strip_comments(src: str) -> str:
    """Remove Java/TS-style line and block comments from source code."""
    src = re.sub(r"/\*.*?\*/", "", src, flags=re.DOTALL)
    src = re.sub(r"//[^\n]*", "", src)
    return src


@pytest.fixture(scope="module")
def plugin_source():
    assert os.path.isfile(PLUGIN_JAVA), (
        f"Expected plugin source at {PLUGIN_JAVA} but it does not exist."
    )
    with open(PLUGIN_JAVA) as f:
        raw = f.read()
    stripped = _strip_comments(raw)
    return {"path": PLUGIN_JAVA, "raw": raw, "src": stripped}


@pytest.fixture(scope="module")
def theme_source():
    assert os.path.isfile(THEME_TS), (
        f"Expected TypeScript theme module at {THEME_TS} but it does not exist."
    )
    with open(THEME_TS) as f:
        raw = f.read()
    stripped = _strip_comments(raw)
    return {"path": THEME_TS, "raw": raw, "src": stripped}


def test_plugin_source_declares_correct_package(plugin_source):
    assert re.search(
        r"^\s*package\s+com\.example\.myapp\s*;",
        plugin_source["src"],
        re.MULTILINE,
    ), "NavBarPlugin.java does not declare `package com.example.myapp;` at the top."


def test_plugin_source_has_required_imports(plugin_source):
    stripped = plugin_source["src"]
    required_imports = [
        r"com\.getcapacitor\.Plugin",
        r"com\.getcapacitor\.PluginCall",
        r"com\.getcapacitor\.PluginMethod",
        r"com\.getcapacitor\.annotation\.CapacitorPlugin",
    ]
    for imp in required_imports:
        assert re.search(rf"import\s+{imp}\s*;", stripped), (
            f"NavBarPlugin.java is missing required import for "
            f"{imp.replace(chr(92), '')}."
        )


def test_plugin_has_capacitor_plugin_annotation(plugin_source):
    assert re.search(
        r'@CapacitorPlugin\s*\(\s*name\s*=\s*"NavBar"\s*\)',
        plugin_source["src"],
    ), (
        "NavBarPlugin.java must be annotated with "
        "@CapacitorPlugin(name = \"NavBar\")."
    )


def test_plugin_class_extends_plugin(plugin_source):
    assert re.search(
        r"public\s+class\s+NavBarPlugin\s+extends\s+Plugin\b",
        plugin_source["src"],
    ), "NavBarPlugin.java must declare `public class NavBarPlugin extends Plugin`."


def test_plugin_has_set_color_method(plugin_source):
    stripped = plugin_source["src"]
    pattern = (
        r"@PluginMethod(?:\s*\([^)]*\))?\s+"
        r"public\s+void\s+setColor\s*\(\s*PluginCall\s+\w+\s*\)"
    )
    assert re.search(pattern, stripped), (
        "NavBarPlugin.java does not declare a @PluginMethod-annotated "
        "`public void setColor(PluginCall ...)` method."
    )


def _extract_set_color_body(stripped: str) -> str:
    """Return the body of the `setColor` method, including the braces."""
    m = re.search(
        r"@PluginMethod(?:\s*\([^)]*\))?\s+"
        r"public\s+void\s+setColor\s*\(\s*PluginCall\s+\w+\s*\)\s*\{",
        stripped,
    )
    assert m, "Could not locate the setColor() method signature."
    start = m.end() - 1  # the '{'
    depth = 0
    end = None
    for i in range(start, len(stripped)):
        c = stripped[i]
        if c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0:
                end = i
                break
    assert end is not None, "Could not parse setColor() method body braces."
    return stripped[start : end + 1]


def test_set_color_method_reads_color_argument(plugin_source):
    body = _extract_set_color_body(plugin_source["src"])
    assert re.search(r'\.\s*getString\s*\(\s*"color"\s*\)', body), (
        'setColor() must call `call.getString("color")` to read the input color.'
    )


def test_set_color_method_invokes_set_navigation_bar_color(plugin_source):
    body = _extract_set_color_body(plugin_source["src"])
    assert re.search(r"\bsetNavigationBarColor\s*\(", body), (
        "setColor() must call `setNavigationBarColor(...)` on the activity window."
    )


def test_set_color_method_resolves_call(plugin_source):
    body = _extract_set_color_body(plugin_source["src"])
    assert re.search(r"\bcall\s*\.\s*resolve\s*\(", body), (
        "setColor() must call `call.resolve(...)` to complete the plugin call."
    )


def test_main_activity_registers_nav_bar_plugin():
    assert os.path.isfile(MAIN_ACTIVITY), f"{MAIN_ACTIVITY} does not exist."
    with open(MAIN_ACTIVITY) as f:
        raw = f.read()
    stripped = _strip_comments(raw)

    m = re.search(
        r"void\s+onCreate\s*\(\s*Bundle\s+\w+\s*\)\s*\{",
        stripped,
    )
    assert m, "MainActivity does not declare onCreate(Bundle ...)."

    start = m.end() - 1  # the '{'
    depth = 0
    end = None
    for i in range(start, len(stripped)):
        if stripped[i] == "{":
            depth += 1
        elif stripped[i] == "}":
            depth -= 1
            if depth == 0:
                end = i
                break
    assert end is not None, "Could not parse onCreate method body."
    body = stripped[start : end + 1]
    assert re.search(
        r"registerPlugin\s*\(\s*NavBarPlugin\s*\.\s*class\s*\)",
        body,
    ), "MainActivity.onCreate must call registerPlugin(NavBarPlugin.class)."


def test_theme_ts_imports_status_bar_and_style(theme_source):
    src = theme_source["src"]
    pattern = (
        r"import\s*\{[^}]*\bStatusBar\b[^}]*\bStyle\b[^}]*\}\s*from\s*"
        r"['\"]@capacitor/status-bar['\"]"
    )
    alt_pattern = (
        r"import\s*\{[^}]*\bStyle\b[^}]*\bStatusBar\b[^}]*\}\s*from\s*"
        r"['\"]@capacitor/status-bar['\"]"
    )
    assert re.search(pattern, src) or re.search(alt_pattern, src), (
        "src/theme.ts must import both `StatusBar` and `Style` from "
        "'@capacitor/status-bar'."
    )


def test_theme_ts_imports_app_from_capacitor_app(theme_source):
    src = theme_source["src"]
    pattern = (
        r"import\s*\{[^}]*\bApp\b[^}]*\}\s*from\s*['\"]@capacitor/app['\"]"
    )
    assert re.search(pattern, src), (
        "src/theme.ts must import `App` from '@capacitor/app'."
    )


def test_theme_ts_imports_register_plugin(theme_source):
    src = theme_source["src"]
    pattern = (
        r"import\s*\{[^}]*\bregisterPlugin\b[^}]*\}\s*from\s*"
        r"['\"]@capacitor/core['\"]"
    )
    assert re.search(pattern, src), (
        "src/theme.ts must import `registerPlugin` from '@capacitor/core'."
    )


def test_theme_ts_registers_navbar_plugin(theme_source):
    src = theme_source["src"]
    pattern = r"registerPlugin\s*(?:<[^>]*>)?\s*\(\s*['\"]NavBar['\"]"
    assert re.search(pattern, src), (
        "src/theme.ts must call registerPlugin with the exact string literal "
        '"NavBar".'
    )


def test_theme_ts_uses_getinfo_from_both_app_and_status_bar(theme_source):
    src = theme_source["src"]
    assert re.search(r"\bApp\s*\.\s*getInfo\s*\(", src), (
        "src/theme.ts must call `App.getInfo(...)` somewhere in the module."
    )
    assert re.search(r"\bStatusBar\s*\.\s*getInfo\s*\(", src), (
        "src/theme.ts must call `StatusBar.getInfo(...)` somewhere in the module."
    )


def test_theme_ts_references_style_dark_and_light(theme_source):
    src = theme_source["src"]
    assert re.search(r"\bStyle\s*\.\s*Dark\b", src), (
        "src/theme.ts must reference `Style.Dark`."
    )
    assert re.search(r"\bStyle\s*\.\s*Light\b", src), (
        "src/theme.ts must reference `Style.Light`."
    )


def test_theme_ts_calls_status_bar_set_style_and_background_color(theme_source):
    src = theme_source["src"]
    assert re.search(r"\bStatusBar\s*\.\s*setStyle\s*\(", src), (
        "src/theme.ts must call `StatusBar.setStyle(...)`."
    )
    assert re.search(r"\bStatusBar\s*\.\s*setBackgroundColor\s*\(", src), (
        "src/theme.ts must call `StatusBar.setBackgroundColor(...)`."
    )


def test_theme_ts_exports_apply_theme_async_function(theme_source):
    src = theme_source["src"]
    # Allow either `export async function applyTheme(...)` or
    # `export const applyTheme = async (...) =>` style declarations.
    pattern_fn = r"export\s+async\s+function\s+applyTheme\s*\("
    pattern_const = (
        r"export\s+(?:const|let|var)\s+applyTheme\s*(?::[^=]+)?=\s*async\b"
    )
    assert re.search(pattern_fn, src) or re.search(pattern_const, src), (
        "src/theme.ts must export an async function named `applyTheme`."
    )


def test_theme_ts_invokes_navbar_set_color(theme_source):
    src = theme_source["src"]
    assert re.search(r"\.\s*setColor\s*\(", src), (
        "src/theme.ts must invoke the custom NavBar plugin's `setColor(...)` "
        "method (e.g. `NavBar.setColor({ color: '#000000' })`)."
    )


def test_gradle_build_succeeds_and_apk_exists():
    if os.path.exists(DEBUG_APK):
        os.remove(DEBUG_APK)
    env = os.environ.copy()
    result = subprocess.run(
        ["./gradlew", ":app:assembleDebug", "--offline", "-q"],
        cwd=ANDROID_DIR,
        capture_output=True,
        text=True,
        env=env,
        timeout=900,
    )
    if result.returncode != 0:
        # Retry once without --offline to recover from any transient cache miss.
        result = subprocess.run(
            ["./gradlew", ":app:assembleDebug", "-q"],
            cwd=ANDROID_DIR,
            capture_output=True,
            text=True,
            env=env,
            timeout=1200,
        )
    assert result.returncode == 0, (
        f"Gradle build failed (exit={result.returncode}).\n"
        f"stdout:\n{result.stdout}\n\nstderr:\n{result.stderr}"
    )
    assert os.path.isfile(DEBUG_APK), (
        f"Expected debug APK at {DEBUG_APK} but it does not exist."
    )


def test_apk_dex_contains_nav_bar_plugin_class():
    assert os.path.isfile(DEBUG_APK), (
        f"Debug APK {DEBUG_APK} not present; build step must run first."
    )
    descriptor = b"Lcom/example/myapp/NavBarPlugin;"

    result = subprocess.run(
        ["unzip", "-p", DEBUG_APK, "classes.dex"],
        capture_output=True,
        timeout=120,
    )
    assert result.returncode == 0, (
        f"Failed to extract classes.dex from {DEBUG_APK}: "
        f"{result.stderr.decode(errors='ignore')}"
    )
    if descriptor in result.stdout:
        return

    # If the app is multidex, search additional classes*.dex members.
    for idx in range(2, 10):
        member = f"classes{idx}.dex"
        probe = subprocess.run(
            ["unzip", "-p", DEBUG_APK, member],
            capture_output=True,
            timeout=120,
        )
        if probe.returncode != 0 or not probe.stdout:
            continue
        if descriptor in probe.stdout:
            return

    raise AssertionError(
        f"DEX descriptor for plugin class {descriptor.decode()} not found in "
        f"any classes*.dex inside {DEBUG_APK}."
    )
