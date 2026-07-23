import os
import re
import subprocess

import pytest

PROJECT_DIR = "/home/user/scene-baker"

SCENE_A = r"""{
  "type": "group",
  "name": "root",
  "enabled": true,
  "lx": 10, "ly": 20, "ls": 2,
  "children": [
    {
      "type": "group",
      "name": "arena",
      "lx": 5, "ly": 0, "ls": 0.5,
      "children": [
        {
          "type": "sprite",
          "name": "hero",
          "lx": 1, "ly": 1, "ls": 1,
          "region": "hero.png",
          "z": 5,
          "frames": [0, 1, 2, 3]
        },
        {
          "type": "light",
          "name": "torch",
          "lx": 2, "ly": 3, "ls": 1,
          "color": "ff8800",
          "intensity": 0.6667
        },
        {
          "type": "group",
          "name": "hidden",
          "enabled": false,
          "lx": 100, "ly": 100, "ls": 1,
          "children": [
            {
              "type": "sprite",
              "name": "ghost",
              "lx": 0, "ly": 0, "ls": 1,
              "region": "ghost.png",
              "z": 0,
              "frames": []
            }
          ]
        }
      ]
    },
    {
      "type": "trigger",
      "name": "onEnter",
      "lx": 0.333, "ly": 0, "ls": 1,
      "event": "start",
      "params": { "speed": "fast", "axis": "x", "mode": "loop" },
      "targets": [0, 1]
    },
    {
      "type": "sprite",
      "name": "decalDisabled",
      "enabled": false,
      "lx": 9, "ly": 9, "ls": 9,
      "region": "d.png",
      "z": 1,
      "frames": [7]
    }
  ]
}
"""

SCENE_B = r"""{
  "type": "group",
  "name": "world",
  "lx": 0, "ly": 0, "ls": 1,
  "children": [
    {
      "type": "light",
      "name": "sun",
      "lx": -4, "ly": 8, "ls": 2,
      "color": "ffffff",
      "intensity": 1.2346
    },
    {
      "type": "group",
      "name": "layer",
      "lx": 1, "ly": 1, "ls": 0.5,
      "children": [
        {
          "type": "group",
          "name": "empty",
          "lx": 0, "ly": 0, "ls": 1,
          "children": []
        },
        {
          "type": "sprite",
          "name": "coin",
          "lx": 2, "ly": -2, "ls": 4,
          "region": "coin.png",
          "z": -1,
          "frames": [10, 20]
        },
        {
          "type": "sprite",
          "name": "gone",
          "enabled": false,
          "lx": 3, "ly": 3, "ls": 3,
          "region": "gone.png",
          "z": 9,
          "frames": [1]
        }
      ]
    },
    {
      "type": "trigger",
      "name": "t",
      "lx": 0, "ly": 0, "ls": 1,
      "event": "fire",
      "params": { "k2": "v2", "k1": "v1" },
      "targets": []
    },
    {
      "type": "group",
      "name": "deadzone",
      "enabled": false,
      "lx": 50, "ly": 50, "ls": 1,
      "children": [
        { "type": "light", "name": "hiddenLight", "lx": 0, "ly": 0, "ls": 1, "color": "000000", "intensity": 0.5 }
      ]
    }
  ]
}
"""

GOLDEN_A = r"""{type:group,id:0,name:root,lx:10.000,ly:20.000,ls:2.000,absX:10.000,absY:20.000,absScale:2.000,children:[{type:group,id:1,name:arena,lx:5.000,ly:0.000,ls:0.500,absX:20.000,absY:20.000,absScale:1.000,children:[{type:sprite,id:2,name:hero,lx:1.000,ly:1.000,ls:1.000,absX:21.000,absY:21.000,absScale:1.000,region:hero.png,z:5,frames:[0,1,2,3]},{type:light,id:3,name:torch,lx:2.000,ly:3.000,ls:1.000,absX:22.000,absY:23.000,absScale:1.000,color:ff8800,intensity:0.667}]},{type:trigger,id:4,name:onEnter,lx:0.333,ly:0.000,ls:1.000,absX:10.666,absY:20.000,absScale:2.000,event:start,params:{axis:x,mode:loop,speed:fast},targets:[0,1]}]}"""

GOLDEN_B = r"""{type:group,id:0,name:world,lx:0.000,ly:0.000,ls:1.000,absX:0.000,absY:0.000,absScale:1.000,children:[{type:light,id:1,name:sun,lx:-4.000,ly:8.000,ls:2.000,absX:-4.000,absY:8.000,absScale:2.000,color:ffffff,intensity:1.235},{type:group,id:2,name:layer,lx:1.000,ly:1.000,ls:0.500,absX:1.000,absY:1.000,absScale:0.500,children:[{type:group,id:3,name:empty,lx:0.000,ly:0.000,ls:1.000,absX:1.000,absY:1.000,absScale:0.500,children:[]},{type:sprite,id:4,name:coin,lx:2.000,ly:-2.000,ls:4.000,absX:2.000,absY:0.000,absScale:2.000,region:coin.png,z:-1,frames:[10,20]}]},{type:trigger,id:5,name:t,lx:0.000,ly:0.000,ls:1.000,absX:0.000,absY:0.000,absScale:1.000,event:fire,params:{k1:v1,k2:v2},targets:[]}]}"""

FORBIDDEN_JSON_TOKENS = [
    "jackson",
    "com.fasterxml",
    "gson",
    "org.json",
    "moshi",
    "fastjson",
    "javax.json",
    "jakarta.json",
]


def _gradle(*args, timeout=900):
    gradlew = os.path.join(PROJECT_DIR, "gradlew")
    if os.path.isfile(gradlew):
        cmd = ["sh", gradlew, *args]
    else:
        cmd = ["gradle", *args]
    return subprocess.run(cmd, cwd=PROJECT_DIR, capture_output=True, text=True, timeout=timeout)


def _run_scene(input_path):
    result = _gradle("--quiet", "--console=plain", "run", f"--args={input_path}", timeout=600)
    stdout = result.stdout or ""
    line = None
    for raw in stdout.splitlines():
        s = raw.strip()
        if s.startswith("{type:group"):
            line = s
            break
    assert line is not None, (
        "Could not find a canonical output line starting with '{type:group' on stdout.\n"
        f"return code: {result.returncode}\nSTDOUT:\n{stdout}\nSTDERR:\n{result.stderr}"
    )
    return line


@pytest.fixture(scope="session")
def gradle_build():
    result = _gradle("--quiet", "--console=plain", "build", timeout=900)
    print("===== gradle build STDOUT =====")
    print(result.stdout)
    print("===== gradle build STDERR =====")
    print(result.stderr)
    assert result.returncode == 0, f"`gradlew build` failed with code {result.returncode}."
    return True


def test_scene_a_exact_output(gradle_build, tmp_path):
    p = tmp_path / "sceneA.json"
    p.write_text(SCENE_A)
    line = _run_scene(str(p))
    assert line == GOLDEN_A, (
        "Canonical output for Scene A did not match exactly.\n"
        f"Expected:\n{GOLDEN_A}\nGot:\n{line}"
    )


def test_scene_b_exact_output(gradle_build, tmp_path):
    p = tmp_path / "sceneB.json"
    p.write_text(SCENE_B)
    line = _run_scene(str(p))
    assert line == GOLDEN_B, (
        "Canonical output for Scene B did not match exactly.\n"
        f"Expected:\n{GOLDEN_B}\nGot:\n{line}"
    )


def test_idempotency_scene_a(gradle_build, tmp_path):
    p = tmp_path / "sceneA.out.json"
    p.write_text(GOLDEN_A + "\n")
    line = _run_scene(str(p))
    assert line == GOLDEN_A, (
        "Re-running the program on Scene A's own canonical output was not idempotent.\n"
        f"Expected:\n{GOLDEN_A}\nGot:\n{line}"
    )


def test_idempotency_scene_b(gradle_build, tmp_path):
    p = tmp_path / "sceneB.out.json"
    p.write_text(GOLDEN_B + "\n")
    line = _run_scene(str(p))
    assert line == GOLDEN_B, (
        "Re-running the program on Scene B's own canonical output was not idempotent.\n"
        f"Expected:\n{GOLDEN_B}\nGot:\n{line}"
    )


def test_no_third_party_json_dependency():
    scanned = []
    offenders = []
    for root, dirs, files in os.walk(PROJECT_DIR):
        dirs[:] = [d for d in dirs if d not in {".gradle", "build", ".git", "out", ".idea"}]
        for fname in files:
            if fname.endswith((".gradle", ".kts", ".java", ".kt", ".toml", ".properties")):
                fpath = os.path.join(root, fname)
                try:
                    content = open(fpath, "r", encoding="utf-8", errors="ignore").read().lower()
                except OSError:
                    continue
                scanned.append(fpath)
                for token in FORBIDDEN_JSON_TOKENS:
                    if token in content:
                        offenders.append((fpath, token))
    assert scanned, f"No project source/build files found under {PROJECT_DIR} to scan."
    assert not offenders, (
        "A third-party JSON library appears to be used; only libGDX's own JSON utilities are allowed. "
        f"Offending references: {offenders}"
    )
