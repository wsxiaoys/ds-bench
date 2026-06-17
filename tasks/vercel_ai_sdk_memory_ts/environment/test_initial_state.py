import os
import shutil
import subprocess


def test_node_binary_available():
    assert shutil.which("node") is not None, (
        "Expected the `node` binary to be available in PATH so the agent can "
        "build and run the TypeScript CLI."
    )


def test_npm_binary_available():
    assert shutil.which("npm") is not None, (
        "Expected the `npm` binary to be available in PATH so the agent can "
        "install Vercel AI SDK, @ai-sdk/openai, and @alchemystai/aisdk."
    )


def test_node_major_version_is_24():
    result = subprocess.run(
        ["node", "--version"],
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 0, (
        f"`node --version` failed (rc={result.returncode}): "
        f"stdout={result.stdout!r} stderr={result.stderr!r}"
    )
    version = result.stdout.strip().lstrip("v")
    major = version.split(".", 1)[0]
    assert major == "24", (
        f"Expected Node.js major version 24 in the task environment, "
        f"got {result.stdout.strip()!r}."
    )


def test_home_user_exists():
    assert os.path.isdir("/home/user"), (
        "Expected /home/user to exist as the working directory root."
    )


def test_zealt_run_id_is_set():
    run_id = os.environ.get("ZEALT_RUN_ID")
    assert run_id, (
        "Expected the ZEALT_RUN_ID environment variable to be set so that "
        "user/session identifiers can be namespaced per run."
    )


def test_alchemyst_api_key_is_set():
    assert os.environ.get("ALCHEMYST_AI_API_KEY"), (
        "Expected ALCHEMYST_AI_API_KEY to be set in the task environment so "
        "the Vercel AI SDK + Alchemyst middleware can authenticate."
    )


def test_openai_api_key_is_set():
    assert os.environ.get("OPENAI_API_KEY"), (
        "Expected OPENAI_API_KEY to be set in the task environment so the "
        "Vercel AI SDK OpenAI provider can authenticate."
    )
