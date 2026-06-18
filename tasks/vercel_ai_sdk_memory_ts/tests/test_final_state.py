import json
import os
import re
import subprocess
import time

import pytest


PROJECT_DIR = "/home/user/vercel-ai-memory"


def _run_id():
    rid = os.environ.get("ZEALT_RUN_ID")
    assert rid, "ZEALT_RUN_ID must be set in the verifier environment."
    return rid


def _ids():
    rid = _run_id()
    user_id = f"vercel-memory-user-{rid}"
    establish_session = f"establish-{rid}"
    recall_session = f"recall-{rid}"
    return user_id, establish_session, recall_session


def _alchemyst_client():
    from alchemyst_ai import AlchemystAI

    api_key = os.environ.get("ALCHEMYST_AI_API_KEY")
    assert api_key, "ALCHEMYST_AI_API_KEY must be set in the verifier environment."
    return AlchemystAI(api_key=api_key)


def _delete_memory_best_effort(client, user_id, session_id):
    """Best-effort cleanup; never raise.

    Python SDK v0.10.0 exposes `v1.context.memory.delete`. We try both
    keyword styles defensively because the API has minor variations.
    """
    try:
        client.v1.context.memory.delete(
            user_id=user_id, session_id=session_id
        )
        return True
    except Exception:
        pass
    try:
        client.v1.context.memory.delete(
            userId=user_id, sessionId=session_id
        )
        return True
    except Exception:
        pass
    return False


@pytest.fixture(scope="module")
def ids():
    return _ids()


@pytest.fixture(scope="module")
def alchemyst_client():
    return _alchemyst_client()


@pytest.fixture(scope="module", autouse=True)
def _preclean_and_teardown(alchemyst_client, ids):
    user_id, establish_session, recall_session = ids
    _delete_memory_best_effort(alchemyst_client, user_id, establish_session)
    _delete_memory_best_effort(alchemyst_client, user_id, recall_session)
    yield
    _delete_memory_best_effort(alchemyst_client, user_id, establish_session)
    _delete_memory_best_effort(alchemyst_client, user_id, recall_session)


def test_project_dir_exists():
    assert os.path.isdir(PROJECT_DIR), (
        f"Expected the agent to create the project directory at {PROJECT_DIR}."
    )


def test_package_json_declares_required_dependencies():
    pkg_path = os.path.join(PROJECT_DIR, "package.json")
    assert os.path.isfile(pkg_path), (
        f"Expected {pkg_path} to exist (the agent must scaffold a Node project)."
    )
    with open(pkg_path) as f:
        pkg = json.load(f)
    deps = {}
    for key in (
        "dependencies",
        "devDependencies",
        "peerDependencies",
        "optionalDependencies",
    ):
        section = pkg.get(key) or {}
        if isinstance(section, dict):
            deps.update(section)
    required = ["ai", "@ai-sdk/openai", "@alchemystai/aisdk"]
    missing = [d for d in required if d not in deps]
    assert not missing, (
        "package.json must declare these dependencies: "
        f"{required}. Missing: {missing}. "
        f"Declared keys: {sorted(deps.keys())}"
    )


def _ensure_node_modules():
    node_modules = os.path.join(PROJECT_DIR, "node_modules")
    if not os.path.isdir(node_modules):
        install = subprocess.run(
            ["npm", "install"],
            cwd=PROJECT_DIR,
            capture_output=True,
            text=True,
            timeout=900,
        )
        assert install.returncode == 0, (
            f"`npm install` failed in {PROJECT_DIR} (rc={install.returncode}).\n"
            f"STDOUT:\n{install.stdout}\nSTDERR:\n{install.stderr}"
        )


def _ensure_built_entrypoint():
    """Make sure dist/main.js exists, running `npm run build` if needed."""
    entry = os.path.join(PROJECT_DIR, "dist", "main.js")
    if os.path.isfile(entry):
        return entry
    build = subprocess.run(
        ["npm", "run", "build"],
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True,
        timeout=600,
    )
    assert build.returncode == 0, (
        f"`npm run build` failed in {PROJECT_DIR} (rc={build.returncode}).\n"
        f"STDOUT:\n{build.stdout}\nSTDERR:\n{build.stderr}"
    )
    assert os.path.isfile(entry), (
        f"After running `npm run build`, expected the TypeScript build to "
        f"produce {entry}, but it does not exist."
    )
    return entry


def test_build_produces_dist_main_js():
    _ensure_node_modules()
    entry = _ensure_built_entrypoint()
    assert os.path.isfile(entry), (
        f"Expected the TypeScript build to emit a runnable entrypoint at {entry}."
    )


def _run_cli(phase, env, timeout=300):
    cmd = ["node", "dist/main.js", "--phase", phase]
    proc = subprocess.run(
        cmd,
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True,
        env=env,
        timeout=timeout,
    )
    return cmd, proc


def test_establish_then_recall_uses_alchemyst_memory(ids):
    user_id, establish_session, recall_session = ids
    _ensure_node_modules()
    _ensure_built_entrypoint()

    env = os.environ.copy()
    # Sanity: required envs for the CLI must be present in the verifier env.
    for k in ("ALCHEMYST_AI_API_KEY", "OPENAI_API_KEY", "ZEALT_RUN_ID"):
        assert env.get(k), (
            f"Verifier environment is missing required env var {k}; "
            "the CLI under test requires it."
        )

    # --- Phase 1: establish ---
    cmd_e, proc_e = _run_cli("establish", env)
    assert proc_e.returncode == 0, (
        f"`{' '.join(cmd_e)}` exited with rc={proc_e.returncode}.\n"
        f"STDOUT:\n{proc_e.stdout}\nSTDERR:\n{proc_e.stderr}"
    )
    assert proc_e.stdout.strip(), (
        "Expected non-empty stdout from the establish phase "
        "(the model's acknowledgement).\n"
        f"STDERR:\n{proc_e.stderr}"
    )

    # Let Alchemyst commit the new memory before recall.
    time.sleep(5)

    # --- Phase 2: recall (different sessionId, same userId) ---
    cmd_r, proc_r = _run_cli("recall", env)
    assert proc_r.returncode == 0, (
        f"`{' '.join(cmd_r)}` exited with rc={proc_r.returncode}.\n"
        f"STDOUT:\n{proc_r.stdout}\nSTDERR:\n{proc_r.stderr}"
    )
    assert proc_r.stdout.strip(), (
        "Expected non-empty stdout from the recall phase (the model's reply)."
        f"\nSTDERR:\n{proc_r.stderr}"
    )

    # The recall response must include the preference word `vegan`.
    # We allow any casing.
    recall_lower = proc_r.stdout.lower()
    assert re.search(r"\bvegan\b", recall_lower), (
        "Expected the recall-phase model output to mention the user's stored "
        "dietary preference (case-insensitive substring `vegan`). "
        "This proves the @alchemystai/aisdk middleware recalled the memory "
        "stored in the previous, different sessionId.\n"
        f"Recall stdout was:\n{proc_r.stdout}"
    )


def test_cli_rejects_missing_run_id():
    """The CLI must fail fast (non-zero exit) if ZEALT_RUN_ID is missing.

    This protects against silently namespacing memories under an empty run id,
    which would cause cross-trial contamination.
    """
    _ensure_node_modules()
    _ensure_built_entrypoint()

    env = os.environ.copy()
    env.pop("ZEALT_RUN_ID", None)

    proc = subprocess.run(
        ["node", "dist/main.js", "--phase", "establish"],
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True,
        env=env,
        timeout=60,
    )
    assert proc.returncode != 0, (
        "Expected the CLI to exit non-zero when ZEALT_RUN_ID is unset, but it "
        f"exited with rc=0.\nSTDOUT:\n{proc.stdout}\nSTDERR:\n{proc.stderr}"
    )
