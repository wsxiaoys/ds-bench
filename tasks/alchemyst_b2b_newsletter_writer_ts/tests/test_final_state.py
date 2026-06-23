import os
import re
import subprocess

import pytest

PROJECT_DIR = "/home/user/myproject"
NEWSLETTER_PATH = os.path.join(PROJECT_DIR, "output", "newsletter.md")
TOPIC = "AI agents"
KEYWORDS = ["agent", "autonomous", "llm", "planning", "tool"]
HEADING_RE = re.compile(r"^\s{0,3}#{1,3}\s+\S")
WORD_BOUNDARY_RE_CACHE = {kw: re.compile(rf"\b{re.escape(kw)}\b") for kw in KEYWORDS}


def _run_cli(timeout: int = 240) -> subprocess.CompletedProcess:
    env = os.environ.copy()
    return subprocess.run(
        ["node", "dist/main.js", "--topic", TOPIC],
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True,
        env=env,
        timeout=timeout,
    )


def _count_headings(markdown_text: str) -> int:
    count = 0
    for line in markdown_text.splitlines():
        if HEADING_RE.match(line):
            count += 1
    return count


def _count_keyword_hits(markdown_text: str) -> int:
    lowered = markdown_text.lower()
    hits = 0
    for kw in KEYWORDS:
        if WORD_BOUNDARY_RE_CACHE[kw].search(lowered):
            hits += 1
    return hits


@pytest.fixture(scope="module")
def first_run():
    # Clean any stale newsletter from a previous run before invoking the CLI.
    if os.path.exists(NEWSLETTER_PATH):
        os.remove(NEWSLETTER_PATH)
    result = _run_cli()
    return result


def test_built_cli_entrypoint_exists():
    entrypoint = os.path.join(PROJECT_DIR, "dist", "main.js")
    assert os.path.isfile(entrypoint), (
        f"Compiled CLI entrypoint {entrypoint} does not exist; "
        "the agent must build the TypeScript sources to dist/."
    )


def test_first_run_exits_successfully(first_run):
    assert first_run.returncode == 0, (
        "First invocation of `node dist/main.js --topic \"AI agents\"` failed with exit code "
        f"{first_run.returncode}.\nstdout:\n{first_run.stdout}\nstderr:\n{first_run.stderr}"
    )


def test_newsletter_file_exists_after_first_run(first_run):
    assert first_run.returncode == 0, "Skipping because CLI did not exit cleanly."
    assert os.path.isfile(NEWSLETTER_PATH), (
        f"Expected newsletter Markdown file at {NEWSLETTER_PATH} after CLI run, but it was not created."
    )
    assert os.path.getsize(NEWSLETTER_PATH) > 0, (
        f"Newsletter file {NEWSLETTER_PATH} exists but is empty."
    )


def test_newsletter_has_at_least_three_headings(first_run):
    assert first_run.returncode == 0, "Skipping because CLI did not exit cleanly."
    with open(NEWSLETTER_PATH, "r", encoding="utf-8") as f:
        content = f.read()
    heading_count = _count_headings(content)
    assert heading_count >= 3, (
        f"Expected at least 3 Markdown headings (#, ##, or ###) in {NEWSLETTER_PATH}, "
        f"found {heading_count}.\nContent was:\n{content}"
    )


def test_newsletter_contains_topic_seeded_keywords(first_run):
    assert first_run.returncode == 0, "Skipping because CLI did not exit cleanly."
    with open(NEWSLETTER_PATH, "r", encoding="utf-8") as f:
        content = f.read()
    hits = _count_keyword_hits(content)
    assert hits >= 2, (
        "Expected the newsletter to mention at least 2 of the seeded AI-agents keywords "
        f"{KEYWORDS}; found {hits} matches. This indicates the agent likely did not ground "
        f"the OpenAI prompt in the Alchemyst-retrieved context.\nContent was:\n{content}"
    )


def test_second_run_is_idempotent_and_safe():
    # Re-running the CLI must not trigger a 409 Conflict from Alchemyst, because the agent
    # must namespace `file_name` metadata with ZEALT_RUN_ID. The output file must still be
    # produced and still satisfy the heading and keyword checks.
    if os.path.exists(NEWSLETTER_PATH):
        os.remove(NEWSLETTER_PATH)
    result = _run_cli()
    assert result.returncode == 0, (
        "Second invocation of the CLI failed; the agent must avoid 409 Conflict by "
        f"namespacing Alchemyst `file_name` with ZEALT_RUN_ID.\n"
        f"stdout:\n{result.stdout}\nstderr:\n{result.stderr}"
    )
    assert os.path.isfile(NEWSLETTER_PATH), (
        f"Expected newsletter Markdown file at {NEWSLETTER_PATH} after rerun, "
        "but it was not created."
    )
    with open(NEWSLETTER_PATH, "r", encoding="utf-8") as f:
        content = f.read()
    assert _count_headings(content) >= 3, (
        "Rerun produced a newsletter with fewer than 3 Markdown headings."
    )
    assert _count_keyword_hits(content) >= 2, (
        f"Rerun produced a newsletter missing seeded keywords {KEYWORDS}."
    )
