import json
import os
import shutil
import subprocess

import pytest

PROJECT_DIR = "/home/user/myproject"
GODOT_BIN = "/opt/godot/godot"
ASSETS_DIR = os.path.join(os.path.dirname(__file__), "assets")
RESULT_PATH = "/tmp/result.json"


def _install_runner_assets() -> None:
    """Copy the verifier's test_runner.gd and test_runner.tscn into the project."""
    for name in ("test_runner.gd", "test_runner.tscn"):
        src = os.path.join(ASSETS_DIR, name)
        dst = os.path.join(PROJECT_DIR, name)
        assert os.path.isfile(src), f"Missing verifier asset: {src}"
        shutil.copyfile(src, dst)


def _run_godot_runner() -> subprocess.CompletedProcess:
    if os.path.exists(RESULT_PATH):
        os.remove(RESULT_PATH)
    _install_runner_assets()
    env = os.environ.copy()
    # Force software OpenGL via Mesa so the rendering server works without GPU.
    env.setdefault("LIBGL_ALWAYS_SOFTWARE", "1")
    # Godot's `--headless` mode uses a dummy renderer that never emits
    # `RenderingServer.frame_post_draw`, which would deadlock the test
    # runner. Provide a virtual X display via `xvfb-run` and force the
    # OpenGL3 (compatibility) driver, which works on top of Mesa llvmpipe.
    return subprocess.run(
        [
            "xvfb-run",
            "-a",
            "-s",
            "-screen 0 320x240x24",
            GODOT_BIN,
            "--rendering-driver",
            "opengl3",
            "--path",
            PROJECT_DIR,
            "res://test_runner.tscn",
        ],
        capture_output=True,
        text=True,
        timeout=180,
        env=env,
    )


@pytest.fixture(scope="module")
def godot_result():
    proc = _run_godot_runner()
    payload = None
    if os.path.exists(RESULT_PATH):
        try:
            with open(RESULT_PATH, "r", encoding="utf-8") as f:
                payload = json.load(f)
        except json.JSONDecodeError as exc:
            pytest.fail(
                f"Could not parse {RESULT_PATH} as JSON: {exc}.\n"
                f"Godot stdout:\n{proc.stdout}\nGodot stderr:\n{proc.stderr}"
            )
    return {"proc": proc, "payload": payload}


def _check(godot_result, name: str) -> dict:
    payload = godot_result["payload"]
    proc = godot_result["proc"]
    assert payload is not None, (
        f"Godot test runner did not produce {RESULT_PATH}.\n"
        f"stdout:\n{proc.stdout}\nstderr:\n{proc.stderr}"
    )
    checks = payload.get("checks", {})
    assert name in checks, (
        f"Expected check '{name}' missing from runner output. Got: {sorted(checks.keys())}.\n"
        f"stdout:\n{proc.stdout}\nstderr:\n{proc.stderr}"
    )
    return checks[name]


def test_godot_runner_executed(godot_result):
    proc = godot_result["proc"]
    assert proc.returncode is not None, "Godot process did not finish"
    # We do not assert on returncode here; per-check assertions give better
    # diagnostics. We only require that result.json was produced.
    payload = godot_result["payload"]
    assert payload is not None, (
        f"Godot runner did not write {RESULT_PATH}.\n"
        f"stdout:\n{proc.stdout}\nstderr:\n{proc.stderr}"
    )


def test_main_scene_declared(godot_result):
    c = _check(godot_result, "main_scene_declared")
    assert c["ok"], (
        f"project.godot must declare application/run/main_scene. Detail: {c['detail']}"
    )


def test_main_scene_loads(godot_result):
    c = _check(godot_result, "main_scene_loads")
    assert c["ok"], f"Main scene failed to load as PackedScene. Detail: {c['detail']}"


def test_main_scene_instantiates(godot_result):
    c = _check(godot_result, "main_scene_instantiates")
    assert c["ok"], f"Main scene failed to instantiate. Detail: {c['detail']}"


def test_source_viewport_present(godot_result):
    c = _check(godot_result, "source_viewport_present")
    assert c["ok"], (
        f"Node path 'World/SourceViewport' must exist as a SubViewport. Detail: {c['detail']}"
    )


def test_source_camera_present(godot_result):
    c = _check(godot_result, "source_camera_present")
    assert c["ok"], (
        f"Node path 'World/SourceViewport/SourceCamera' must exist as a Camera3D. "
        f"Detail: {c['detail']}"
    )


def test_hud_monitor_present(godot_result):
    c = _check(godot_result, "hud_monitor_present")
    assert c["ok"], (
        f"Node path 'HUD/MonitorScreen' must exist as a TextureRect. Detail: {c['detail']}"
    )


def test_set_camera_pose_method(godot_result):
    c = _check(godot_result, "set_camera_pose_method")
    assert c["ok"], (
        f"Root script must define set_camera_pose(pos, basis). Detail: {c['detail']}"
    )


def test_subviewport_size_256(godot_result):
    c = _check(godot_result, "subviewport_size_256")
    assert c["ok"], (
        f"SubViewport.size must be Vector2i(256, 256). Detail: {c['detail']}"
    )


def test_subviewport_update_always(godot_result):
    c = _check(godot_result, "subviewport_update_always")
    assert c["ok"], (
        f"SubViewport.render_target_update_mode must be UPDATE_ALWAYS. Detail: {c['detail']}"
    )


def test_subviewport_opaque_bg(godot_result):
    c = _check(godot_result, "subviewport_opaque_bg")
    assert c["ok"], (
        f"SubViewport.transparent_bg must be false. Detail: {c['detail']}"
    )


def test_hud_uses_viewport_texture(godot_result):
    c = _check(godot_result, "hud_uses_viewport_texture")
    assert c["ok"], (
        f"HUD/MonitorScreen.texture must be a ViewportTexture pointing at "
        f"World/SourceViewport. Detail: {c['detail']}"
    )


def test_red_view_center(godot_result):
    c = _check(godot_result, "red_view_center")
    assert c["ok"], (
        f"After set_camera_pose(Vector3(3,0,5), Basis.IDENTITY), the center pixel "
        f"of the SubViewport must read as red-dominant. Detail: {c['detail']}"
    )


def test_green_view_center(godot_result):
    c = _check(godot_result, "green_view_center")
    assert c["ok"], (
        f"After set_camera_pose(Vector3(-3,0,5), Basis.IDENTITY), the center pixel "
        f"of the SubViewport must read as green-dominant. Detail: {c['detail']}"
    )


def test_blue_view_center(godot_result):
    c = _check(godot_result, "blue_view_center")
    assert c["ok"], (
        f"After set_camera_pose(Vector3(0,0,2), Basis.from_euler(Vector3(0,PI,0))), "
        f"the center pixel of the SubViewport must read as blue-dominant. "
        f"Detail: {c['detail']}"
    )


def test_background_is_black(godot_result):
    c = _check(godot_result, "background_is_black")
    assert c["ok"], (
        f"A corner pixel of the SubViewport must read as black (background clear color). "
        f"Detail: {c['detail']}"
    )


def test_overall_passed(godot_result):
    payload = godot_result["payload"]
    assert payload is not None, "result.json missing"
    assert payload.get("passed") is True, (
        f"Headless Godot verifier reported failures: {payload.get('errors')}"
    )
