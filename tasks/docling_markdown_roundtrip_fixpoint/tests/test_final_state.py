import hashlib
import json
import os
import re
import shutil
import subprocess
import unicodedata
from collections import Counter
from decimal import ROUND_HALF_UP, Decimal

import pytest

PROJECT_DIR = "/home/user/fixpoint"
CORPUS_DIR = os.path.join(PROJECT_DIR, "corpus")
AUDIT_CMD = ["python3", "audit.py"]
RUN_TIMEOUT = 1800

DOC_IDS = [
    "alignment_table",
    "fenced_code",
    "fragment_page",
    "nested_lists",
    "quotes_media",
    "ragged_whitespace",
    "unicode_emoji",
]
SOURCE_FILES = {
    "alignment_table": "alignment_table.md",
    "fenced_code": "fenced_code.md",
    "fragment_page": "fragment_page.html",
    "nested_lists": "nested_lists.md",
    "quotes_media": "quotes_media.md",
    "ragged_whitespace": "ragged_whitespace.md",
    "unicode_emoji": "unicode_emoji.md",
}
CHANNELS = ["json", "markdown"]
CHANNEL_EXT = {"json": ".json", "markdown": ".md"}
STABLE_CODES = ("STABLE_IMMEDIATE", "STABLE_DELAYED")
ALL_CODES = sorted(
    [
        "STABLE_IMMEDIATE",
        "STABLE_DELAYED",
        "WHITESPACE_DRIFT",
        "TEXT_DRIFT",
        "STRUCTURE_DRIFT",
    ]
)


# --------------------------------------------------------------------------
# helpers
# --------------------------------------------------------------------------
def run_audit(args):
    """Execute the auditor inside the project directory and return the result."""
    return subprocess.run(
        AUDIT_CMD + list(args),
        cwd=PROJECT_DIR,
        capture_output=True,
        timeout=RUN_TIMEOUT,
    )


def read_bytes(path):
    with open(path, "rb") as handle:
        return handle.read()


def sha256_hex(data):
    return hashlib.sha256(data).hexdigest()


def normalize(text):
    """The normalization documented in the task description."""
    text = unicodedata.normalize("NFC", text)
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = text.replace("\t", " ").replace("\u00a0", " ")
    lines = []
    for line in text.split("\n"):
        line = re.sub(" {2,}", " ", line).strip(" ")
        if line:
            lines.append(line)
    return "\n".join(lines)


def loose_normalize(text):
    """A deliberately wrong normalization (keeps empty lines) used as a control."""
    text = unicodedata.normalize("NFC", text)
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = text.replace("\t", " ").replace("\u00a0", " ")
    lines = [re.sub(" {2,}", " ", line).strip(" ") for line in text.split("\n")]
    return "\n".join(lines)


def similarity(text_a, text_b):
    tokens_a = normalize(text_a).split()
    tokens_b = normalize(text_b).split()
    if not tokens_a and not tokens_b:
        return 1.0
    counter_a = Counter(tokens_a)
    counter_b = Counter(tokens_b)
    shared = sum(min(counter_a[tok], counter_b[tok]) for tok in set(counter_a) | set(counter_b))
    return 2.0 * shared / (len(tokens_a) + len(tokens_b))


def round6(value):
    return float(Decimal(repr(float(value))).quantize(Decimal("0.000001"), rounding=ROUND_HALF_UP))


def load_json(path):
    with open(path, encoding="utf-8") as handle:
        return json.load(handle)


def report_path(out_dir):
    return os.path.join(out_dir, "report.json")


def detail_path(out_dir, doc_id):
    return os.path.join(out_dir, "documents", doc_id, "detail.json")


def artifact_path(out_dir, doc_id, channel, iteration):
    return os.path.join(
        out_dir,
        "documents",
        doc_id,
        channel,
        "iter_%02d%s" % (iteration, CHANNEL_EXT[channel]),
    )


def rebuild_violations(report, min_similarity):
    violations = []
    for document in report["documents"]:
        for run in document["runs"]:
            key = "%s/%s" % (document["document_id"], run["channel"])
            if run["code"] not in STABLE_CODES:
                violations.append("%s:%s" % (key, run["code"]))
            if run["final_similarity"] < min_similarity:
                violations.append("%s:LOW_SIMILARITY" % key)
    return violations


def check_summary_layout(out_dir, report, stdout_bytes=None):
    summary_file = os.path.join(out_dir, "summary.txt")
    assert os.path.isfile(summary_file), "%s is missing." % summary_file
    raw = read_bytes(summary_file)
    text = raw.decode("utf-8")
    assert text.endswith("\n"), "%s must end with exactly one newline." % summary_file
    assert not text.endswith("\n\n"), "%s must end with exactly one newline." % summary_file

    lines = text[:-1].split("\n")
    runs = [(doc, run) for doc in report["documents"] for run in doc["runs"]]
    assert len(lines) == 9 + len(runs), (
        "summary.txt must have exactly %d lines, found %d." % (9 + len(runs), len(lines))
    )
    assert lines[0] == "FIXPOINT AUDIT", "Line 1 must be 'FIXPOINT AUDIT', got %r." % lines[0]
    assert lines[1] == "corpus: %s" % report["corpus"], (
        "Line 2 must echo the report corpus path, got %r." % lines[1]
    )
    assert lines[2] == "documents: %d" % len(report["documents"]), (
        "Line 3 must report the document count, got %r." % lines[2]
    )
    assert lines[3] == "runs: %d" % len(runs), "Line 4 must report the run count, got %r." % lines[3]
    assert lines[4] == "max_iterations: %d" % report["max_iterations"], (
        "Line 5 must report max_iterations, got %r." % lines[4]
    )
    assert lines[5] == "min_similarity: %.6f" % report["min_similarity"], (
        "Line 6 must print min_similarity with 6 decimals, got %r." % lines[5]
    )
    assert lines[6] == "", "Line 7 must be empty, got %r." % lines[6]

    pattern = re.compile(r"^\S+ (json|markdown) [A-Z_]+ fixpoint=(\d+|-) similarity=\d\.\d{6}$")
    for index, (document, run) in enumerate(runs):
        line = lines[7 + index]
        assert pattern.match(line), "Run line %d has an invalid layout: %r" % (index + 1, line)
        fixpoint = "-" if run["fixpoint_iteration"] is None else str(run["fixpoint_iteration"])
        expected = "%s %s %s fixpoint=%s similarity=%.6f" % (
            document["document_id"],
            run["channel"],
            run["code"],
            fixpoint,
            run["final_similarity"],
        )
        assert line == expected, "Run line %d must be %r, got %r." % (index + 1, expected, line)

    assert lines[7 + len(runs)] == "", "The line after the run block must be empty."
    gate = report["gate"]
    expected_gate = (
        "GATE: PASS"
        if gate["passed"]
        else "GATE: FAIL (%d violations)" % len(gate["violations"])
    )
    assert lines[-1] == expected_gate, (
        "The last summary line must be %r, got %r." % (expected_gate, lines[-1])
    )

    if stdout_bytes is not None:
        assert stdout_bytes == raw, "stdout must be byte-identical to summary.txt."


def check_json_formatting(path):
    raw = read_bytes(path)
    text = raw.decode("utf-8")
    assert text.endswith("\n") and not text.endswith("\n\n"), (
        "%s must end with exactly one newline." % path
    )
    obj = json.loads(text)
    expected = json.dumps(obj, indent=2, sort_keys=True, ensure_ascii=False) + "\n"
    assert text == expected, (
        "%s must be serialized with 2-space indent, sorted keys and unescaped non-ASCII." % path
    )


def check_measurements(out_dir, report):
    """Recompute every per-iteration measurement from the artifacts on disk."""
    max_iterations = report["max_iterations"]
    for document in report["documents"]:
        doc_id = document["document_id"]
        detail = load_json(detail_path(out_dir, doc_id))
        for channel in CHANNELS:
            channel_detail = detail["channels"][channel]
            records = channel_detail["iterations"]
            assert len(records) == max_iterations, (
                "%s/%s must have %d iteration records, found %d."
                % (doc_id, channel, max_iterations, len(records))
            )
            texts = []
            for index, record in enumerate(records):
                iteration = index + 1
                assert record["iteration"] == iteration, (
                    "%s/%s iteration records must be ordered 1..%d."
                    % (doc_id, channel, max_iterations)
                )
                path = artifact_path(out_dir, doc_id, channel, iteration)
                assert os.path.isfile(path), "Missing artifact %s." % path
                raw = read_bytes(path)
                text = raw.decode("utf-8")
                texts.append(text)
                assert record["bytes"] == len(raw), (
                    "%s: recorded bytes %s != actual %d." % (path, record["bytes"], len(raw))
                )
                assert record["sha256"] == sha256_hex(raw), (
                    "%s: recorded sha256 does not match the artifact bytes." % path
                )
                expected_norm = sha256_hex(normalize(text).encode("utf-8"))
                assert record["normalized_sha256"] == expected_norm, (
                    "%s: normalized_sha256 does not match the documented normalization." % path
                )
                if iteration == 1:
                    assert record["byte_equal_to_previous"] is False, (
                        "%s: iteration 1 must have byte_equal_to_previous == false." % path
                    )
                    assert record["normalized_equal_to_previous"] is False, (
                        "%s: iteration 1 must have normalized_equal_to_previous == false." % path
                    )
                    assert record["structure_equal_to_previous"] is False, (
                        "%s: iteration 1 must have structure_equal_to_previous == false." % path
                    )
                    assert record["similarity_to_previous"] == 0.0, (
                        "%s: iteration 1 must have similarity_to_previous == 0.0." % path
                    )
                else:
                    previous = texts[index - 1]
                    expected_equal = read_bytes(
                        artifact_path(out_dir, doc_id, channel, iteration - 1)
                    ) == raw
                    assert record["byte_equal_to_previous"] == expected_equal, (
                        "%s: byte_equal_to_previous is wrong." % path
                    )
                    assert record["normalized_equal_to_previous"] == (
                        normalize(text) == normalize(previous)
                    ), "%s: normalized_equal_to_previous is wrong." % path
                    expected_similarity = round6(similarity(text, previous))
                    assert abs(record["similarity_to_previous"] - expected_similarity) <= 1e-6, (
                        "%s: similarity_to_previous %s != expected %s."
                        % (path, record["similarity_to_previous"], expected_similarity)
                    )
                    assert record["structure_equal_to_previous"] == (
                        record["structure"] == records[index - 1]["structure"]
                    ), "%s: structure_equal_to_previous is inconsistent with the recorded structures." % path


def check_fixpoint_and_codes(out_dir, report):
    max_iterations = report["max_iterations"]
    for document in report["documents"]:
        doc_id = document["document_id"]
        detail = load_json(detail_path(out_dir, doc_id))
        for run in document["runs"]:
            channel = run["channel"]
            channel_detail = detail["channels"][channel]
            records = channel_detail["iterations"]

            expected_fixpoint = None
            for iteration in range(1, max_iterations):
                first = read_bytes(artifact_path(out_dir, doc_id, channel, iteration))
                second = read_bytes(artifact_path(out_dir, doc_id, channel, iteration + 1))
                if first == second:
                    expected_fixpoint = iteration
                    break
            assert run["fixpoint_iteration"] == expected_fixpoint, (
                "%s/%s: fixpoint_iteration %s != recomputed %s"
                % (doc_id, channel, run["fixpoint_iteration"], expected_fixpoint)
            )
            assert run["converged"] == (expected_fixpoint is not None), (
                "%s/%s: converged must be true exactly when a fixpoint exists." % (doc_id, channel)
            )

            final = records[-1]
            if expected_fixpoint == 1:
                expected_code = "STABLE_IMMEDIATE"
            elif expected_fixpoint is not None:
                expected_code = "STABLE_DELAYED"
            elif final["normalized_equal_to_previous"]:
                expected_code = "WHITESPACE_DRIFT"
            elif final["structure_equal_to_previous"]:
                expected_code = "TEXT_DRIFT"
            else:
                expected_code = "STRUCTURE_DRIFT"
            assert run["code"] == expected_code, (
                "%s/%s: code %r != expected %r" % (doc_id, channel, run["code"], expected_code)
            )
            assert run["iterations"] == max_iterations, (
                "%s/%s: iterations must equal max_iterations." % (doc_id, channel)
            )
            assert abs(run["final_similarity"] - final["similarity_to_previous"]) <= 1e-9, (
                "%s/%s: final_similarity must equal the last record's similarity_to_previous."
                % (doc_id, channel)
            )
            assert channel_detail["code"] == run["code"], (
                "%s/%s: detail.json and report.json disagree on code." % (doc_id, channel)
            )
            assert channel_detail["converged"] == run["converged"], (
                "%s/%s: detail.json and report.json disagree on converged." % (doc_id, channel)
            )
            assert channel_detail["fixpoint_iteration"] == run["fixpoint_iteration"], (
                "%s/%s: detail.json and report.json disagree on fixpoint_iteration."
                % (doc_id, channel)
            )


def check_totals_and_gate(out_dir, report, exit_code):
    runs = [run for document in report["documents"] for run in document["runs"]]
    totals = report["totals"]
    assert totals["documents"] == len(report["documents"]), "totals.documents is wrong."
    assert totals["runs"] == len(runs), "totals.runs is wrong."
    assert totals["converged_runs"] == sum(1 for run in runs if run["converged"]), (
        "totals.converged_runs is wrong."
    )
    assert sorted(totals["codes"].keys()) == ALL_CODES, (
        "totals.codes must carry exactly the five classification codes, got %s."
        % sorted(totals["codes"].keys())
    )
    observed = Counter(run["code"] for run in runs)
    for code in ALL_CODES:
        assert totals["codes"][code] == observed.get(code, 0), (
            "totals.codes[%s] is wrong." % code
        )
    assert sum(totals["codes"].values()) == len(runs), "totals.codes must sum to the run count."
    expected_min = min(run["final_similarity"] for run in runs)
    assert abs(totals["min_final_similarity"] - expected_min) <= 1e-9, (
        "totals.min_final_similarity is wrong."
    )

    gate = report["gate"]
    expected_violations = rebuild_violations(report, report["min_similarity"])
    assert gate["violations"] == expected_violations, (
        "gate.violations %s != expected %s" % (gate["violations"], expected_violations)
    )
    assert gate["passed"] == (not expected_violations), "gate.passed is inconsistent."
    assert gate["exit_code"] == (0 if gate["passed"] else 3), "gate.exit_code is inconsistent."
    assert exit_code == gate["exit_code"], (
        "The process exit code %d must equal gate.exit_code %d." % (exit_code, gate["exit_code"])
    )


def check_structures(out_dir, report):
    for document in report["documents"]:
        doc_id = document["document_id"]
        detail = load_json(detail_path(out_dir, doc_id))
        for channel in CHANNELS:
            for record in detail["channels"][channel]["iterations"]:
                structure = record["structure"]
                assert sorted(structure.keys()) == ["item_counts", "max_depth", "table_dims"], (
                    "%s/%s: structure must have exactly item_counts, max_depth and table_dims."
                    % (doc_id, channel)
                )
                for label, count in structure["item_counts"].items():
                    assert re.match(r"^[a-z0-9_]+$", label), (
                        "%s/%s: label %r must only contain [a-z0-9_]." % (doc_id, channel, label)
                    )
                    assert isinstance(count, int) and count >= 1, (
                        "%s/%s: item_counts[%s] must be an integer >= 1." % (doc_id, channel, label)
                    )
                assert isinstance(structure["max_depth"], int) and structure["max_depth"] >= 0, (
                    "%s/%s: max_depth must be an integer >= 0." % (doc_id, channel)
                )
                dims = structure["table_dims"]
                assert isinstance(dims, list), "%s/%s: table_dims must be a list." % (doc_id, channel)
                for pair in dims:
                    assert (
                        isinstance(pair, list)
                        and len(pair) == 2
                        and all(isinstance(value, int) for value in pair)
                    ), "%s/%s: table_dims entries must be [rows, cols] integer pairs." % (
                        doc_id,
                        channel,
                    )
                    assert pair[0] >= 1 and pair[1] >= 1, (
                        "%s/%s: table dimensions must be >= 1." % (doc_id, channel)
                    )
                assert len(dims) == structure["item_counts"].get("table", 0), (
                    "%s/%s: len(table_dims) must equal item_counts['table']." % (doc_id, channel)
                )


def write_file(path, content, newline="\n"):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8", newline=newline) as handle:
        handle.write(content)


# --------------------------------------------------------------------------
# fixtures
# --------------------------------------------------------------------------
@pytest.fixture(scope="session")
def main_run():
    out_dir = os.path.join(PROJECT_DIR, "out_v1")
    shutil.rmtree(out_dir, ignore_errors=True)
    result = run_audit(["--out", "out_v1"])
    assert result.returncode in (0, 3), (
        "`python3 audit.py --out out_v1` exited with %d.\nstderr:\n%s"
        % (result.returncode, result.stderr.decode("utf-8", "replace"))
    )
    assert os.path.isfile(report_path(out_dir)), "%s was not created." % report_path(out_dir)
    return {
        "out_dir": out_dir,
        "returncode": result.returncode,
        "stdout": result.stdout,
        "stderr": result.stderr,
        "report": load_json(report_path(out_dir)),
    }


@pytest.fixture(scope="session")
def whitespace_run():
    corpus = "/tmp/fx_corpus_ws"
    shutil.rmtree(corpus, ignore_errors=True)
    body = (
        "# Ragged\u00a0Heading\r\n"
        "\r\n"
        "Alpha\tbeta   gamma   \r\n"
        "\r\n"
        "\r\n"
        "-  first   item  \r\n"
        "-  second\titem\r\n"
        "\r\n"
        "Closing    paragraph\u00a0with   gaps.   \r\n"
    )
    write_file(os.path.join(corpus, "ws.md"), body, newline="")
    out_dir = os.path.join(PROJECT_DIR, "out_v1_ws")
    shutil.rmtree(out_dir, ignore_errors=True)
    result = run_audit(["--corpus", corpus, "--out", "out_v1_ws", "--max-iterations", "2"])
    assert result.returncode in (0, 3), (
        "The whitespace audit exited with %d.\nstderr:\n%s"
        % (result.returncode, result.stderr.decode("utf-8", "replace"))
    )
    return {"out_dir": out_dir, "report": load_json(report_path(out_dir))}


@pytest.fixture(scope="session")
def determinism_runs():
    results = []
    for name in ("out_v2a", "out_v2b"):
        out_dir = os.path.join(PROJECT_DIR, name)
        shutil.rmtree(out_dir, ignore_errors=True)
        result = run_audit(
            ["--doc", "nested_lists", "--doc", "fragment_page", "--out", name]
        )
        assert result.returncode in (0, 3), (
            "The filtered audit into %s exited with %d.\nstderr:\n%s"
            % (name, result.returncode, result.stderr.decode("utf-8", "replace"))
        )
        results.append({"out_dir": out_dir, "returncode": result.returncode})
    return results


@pytest.fixture(scope="session")
def five_iteration_run():
    out_dir = os.path.join(PROJECT_DIR, "out_v3")
    shutil.rmtree(out_dir, ignore_errors=True)
    args = ["--doc", "fenced_code", "--out", "out_v3", "--max-iterations", "5"]
    result = run_audit(args)
    assert result.returncode in (0, 3), (
        "The 5-iteration audit exited with %d.\nstderr:\n%s"
        % (result.returncode, result.stderr.decode("utf-8", "replace"))
    )
    return {"out_dir": out_dir, "args": args, "report": load_json(report_path(out_dir))}


@pytest.fixture(scope="session")
def unicode_id_run():
    corpus = "/tmp/fx_corpus_uni"
    shutil.rmtree(corpus, ignore_errors=True)
    body = (
        "# Caf\u00e9 Pr\u00f3be\n"
        "\n"
        "Paragraph with accents: \u00e9\u00e8\u00ea and CJK \u6587\u6863.\n"
        "\n"
        "- first\n"
        "- second\n"
    )
    write_file(os.path.join(corpus, "caf\u00e9_pr\u00f3be.md"), body)
    out_dir = os.path.join(PROJECT_DIR, "out_uni")
    shutil.rmtree(out_dir, ignore_errors=True)
    result = run_audit(["--corpus", corpus, "--out", "out_uni", "--max-iterations", "2"])
    assert result.returncode in (0, 3), (
        "The unicode-id audit exited with %d.\nstderr:\n%s"
        % (result.returncode, result.stderr.decode("utf-8", "replace"))
    )
    return {
        "out_dir": out_dir,
        "returncode": result.returncode,
        "stdout": result.stdout,
        "report": load_json(report_path(out_dir)),
    }


@pytest.fixture(scope="session")
def unseen_corpus_run():
    corpus = "/tmp/fx_corpus_new"
    shutil.rmtree(corpus, ignore_errors=True)
    markdown = (
        "# Probe Document\n"
        "\n"
        "Intro paragraph with **bold**, *italic* and `inline code`.\n"
        "\n"
        "- level one\n"
        "  - level two\n"
        "    - level three\n"
        "- second root item\n"
        "\n"
        "| Metric | Value | Note |\n"
        "| :--- | ---: | :---: |\n"
        "| alpha | 1 | ok |\n"
        "| beta | 22 | fine |\n"
        "\n"
        "```python\n"
        "def probe(x):\n"
        "    return x * 2\n"
        "```\n"
        "\n"
        "> quoted line with emoji \U0001f9ea and accents \u00e9\u00e8\u00ea\n"
    )
    html = (
        "<html><body>\n"
        "<h1>Probe HTML</h1>\n"
        "<p>Paragraph with <b>bold</b> and <code>code</code>.</p>\n"
        "<ul><li>outer<ul><li>inner</li></ul></li><li>sibling</li></ul>\n"
        "<table><tr><th>Name</th><th>Count</th></tr>"
        "<tr><td>alpha</td><td>1</td></tr><tr><td>beta</td><td>2</td></tr></table>\n"
        "<pre><code>echo hello\n</code></pre>\n"
        "<blockquote>quoted html</blockquote>\n"
        "</body></html>\n"
    )
    write_file(os.path.join(corpus, "probe.md"), markdown)
    write_file(os.path.join(corpus, "probe_html.html"), html)
    out_dir = os.path.join(PROJECT_DIR, "out_new")
    shutil.rmtree(out_dir, ignore_errors=True)
    result = run_audit(["--corpus", corpus, "--out", "out_new", "--max-iterations", "2"])
    assert result.returncode in (0, 3), (
        "The unseen-corpus audit exited with %d.\nstderr:\n%s"
        % (result.returncode, result.stderr.decode("utf-8", "replace"))
    )
    return {
        "out_dir": out_dir,
        "corpus": corpus,
        "returncode": result.returncode,
        "stdout": result.stdout,
        "report": load_json(report_path(out_dir)),
    }


# --------------------------------------------------------------------------
# tests
# --------------------------------------------------------------------------
def test_report_shape_and_document_selection(main_run):
    report = main_run["report"]
    assert sorted(report.keys()) == sorted(
        [
            "schema_version",
            "corpus",
            "max_iterations",
            "min_similarity",
            "channels",
            "documents",
            "totals",
            "gate",
        ]
    ), "report.json has unexpected top-level keys: %s" % sorted(report.keys())
    assert report["schema_version"] == "1.0", "schema_version must be the string '1.0'."
    assert report["corpus"] in (CORPUS_DIR, os.path.realpath(CORPUS_DIR)), (
        "report.corpus must be the absolute corpus path, got %r." % report["corpus"]
    )
    assert report["max_iterations"] == 3, "The default max_iterations must be 3."
    assert report["min_similarity"] == pytest.approx(0.95), (
        "The default min_similarity must be 0.95."
    )
    assert report["channels"] == CHANNELS, "channels must be exactly ['json', 'markdown']."

    ids = [document["document_id"] for document in report["documents"]]
    assert ids == DOC_IDS, "documents must be exactly %s in ascending order, got %s." % (
        DOC_IDS,
        ids,
    )
    for document in report["documents"]:
        assert sorted(document.keys()) == sorted(
            ["document_id", "source_file", "html_sha256", "runs"]
        ), "Document entries have unexpected keys: %s" % sorted(document.keys())
        assert document["source_file"] == SOURCE_FILES[document["document_id"]], (
            "source_file is wrong for %s." % document["document_id"]
        )
        assert [run["channel"] for run in document["runs"]] == CHANNELS, (
            "runs must be ordered by channel ascending for %s." % document["document_id"]
        )
        for run in document["runs"]:
            assert sorted(run.keys()) == sorted(
                [
                    "channel",
                    "iterations",
                    "fixpoint_iteration",
                    "converged",
                    "code",
                    "final_similarity",
                ]
            ), "Run entries have unexpected keys: %s" % sorted(run.keys())
    for ignored in ("README", "notes", "ignored"):
        assert ignored not in ids, "%r must not be treated as a corpus document." % ignored


def test_stdout_is_byte_identical_to_summary(main_run):
    check_summary_layout(main_run["out_dir"], main_run["report"], main_run["stdout"])


def test_artifact_tree_is_complete(main_run):
    out_dir = main_run["out_dir"]
    for document in main_run["report"]["documents"]:
        doc_id = document["document_id"]
        doc_dir = os.path.join(out_dir, "documents", doc_id)
        assert os.path.isdir(doc_dir), "Missing document directory %s." % doc_dir

        observation = os.path.join(doc_dir, "observation.html")
        assert os.path.isfile(observation), "Missing %s." % observation
        html_bytes = read_bytes(observation)
        assert len(html_bytes) > 0, "%s must not be empty." % observation
        assert b"<" in html_bytes, "%s does not look like HTML." % observation

        detail = load_json(detail_path(out_dir, doc_id))
        assert sorted(detail.keys()) == sorted(
            [
                "document_id",
                "source_file",
                "source_sha256",
                "html_sha256",
                "html_bytes",
                "channels",
            ]
        ), "detail.json for %s has unexpected keys: %s" % (doc_id, sorted(detail.keys()))
        assert detail["document_id"] == doc_id, "detail.document_id mismatch for %s." % doc_id
        assert detail["source_file"] == SOURCE_FILES[doc_id], (
            "detail.source_file mismatch for %s." % doc_id
        )
        source_digest = sha256_hex(read_bytes(os.path.join(CORPUS_DIR, SOURCE_FILES[doc_id])))
        assert detail["source_sha256"] == source_digest, (
            "detail.source_sha256 does not match the corpus file for %s." % doc_id
        )
        assert detail["html_sha256"] == sha256_hex(html_bytes), (
            "detail.html_sha256 does not match observation.html for %s." % doc_id
        )
        assert detail["html_bytes"] == len(html_bytes), (
            "detail.html_bytes does not match observation.html for %s." % doc_id
        )
        assert document["html_sha256"] == sha256_hex(html_bytes), (
            "report html_sha256 does not match observation.html for %s." % doc_id
        )

        for channel in CHANNELS:
            channel_detail = detail["channels"][channel]
            assert sorted(channel_detail.keys()) == sorted(
                [
                    "code",
                    "converged",
                    "fixpoint_iteration",
                    "final_similarity",
                    "artifacts",
                    "iterations",
                ]
            ), "detail channel object has unexpected keys: %s" % sorted(channel_detail.keys())
            expected_artifacts = [
                "%s/iter_%02d%s" % (channel, iteration, CHANNEL_EXT[channel])
                for iteration in range(1, 4)
            ]
            assert channel_detail["artifacts"] == expected_artifacts, (
                "%s/%s artifacts must be %s, got %s."
                % (doc_id, channel, expected_artifacts, channel_detail["artifacts"])
            )
            for iteration in range(1, 4):
                path = artifact_path(out_dir, doc_id, channel, iteration)
                assert os.path.isfile(path), "Missing artifact %s." % path
                assert os.path.getsize(path) > 0, "Artifact %s is empty." % path
                if channel == "json":
                    json.loads(read_bytes(path).decode("utf-8"))


def test_iteration_measurements_are_recomputable(main_run):
    check_measurements(main_run["out_dir"], main_run["report"])


def test_normalization_matches_specification(whitespace_run):
    out_dir = whitespace_run["out_dir"]
    report = whitespace_run["report"]
    assert [document["document_id"] for document in report["documents"]] == ["ws"], (
        "The whitespace corpus must yield exactly the document id 'ws'."
    )
    check_measurements(out_dir, report)

    discriminating = False
    for channel in CHANNELS:
        for iteration in (1, 2):
            text = read_bytes(artifact_path(out_dir, "ws", channel, iteration)).decode("utf-8")
            strict = sha256_hex(normalize(text).encode("utf-8"))
            loose = sha256_hex(loose_normalize(text).encode("utf-8"))
            if strict != loose:
                discriminating = True
    assert discriminating, (
        "No artifact distinguishes the documented normalization from one keeping blank lines; "
        "the normalization check would have no discriminating power."
    )


def test_structure_signature_invariants(main_run):
    out_dir = main_run["out_dir"]
    check_structures(out_dir, main_run["report"])
    detail = load_json(detail_path(out_dir, "alignment_table"))
    has_table = any(
        record["structure"]["table_dims"]
        for record in detail["channels"]["markdown"]["iterations"]
    )
    assert has_table, (
        "The alignment_table document must record at least one non-empty table_dims "
        "entry in the markdown channel."
    )


def test_fixpoint_detection_and_classification(main_run):
    check_fixpoint_and_codes(main_run["out_dir"], main_run["report"])
    for document in main_run["report"]["documents"]:
        for run in document["runs"]:
            assert run["code"] in ALL_CODES, (
                "Unknown classification code %r for %s/%s."
                % (run["code"], document["document_id"], run["channel"])
            )


def test_totals_and_gate_are_consistent(main_run):
    report = main_run["report"]
    assert report["totals"]["documents"] == 7, "totals.documents must be 7."
    assert report["totals"]["runs"] == 14, "totals.runs must be 14."
    check_totals_and_gate(main_run["out_dir"], report, main_run["returncode"])


def test_gate_threshold_reacts_to_min_similarity():
    low_dir = os.path.join(PROJECT_DIR, "out_v1_lo")
    high_dir = os.path.join(PROJECT_DIR, "out_v1_hi")
    shutil.rmtree(low_dir, ignore_errors=True)
    shutil.rmtree(high_dir, ignore_errors=True)

    low = run_audit(
        [
            "--doc",
            "alignment_table",
            "--doc",
            "unicode_emoji",
            "--out",
            "out_v1_lo",
            "--min-similarity",
            "0.0",
        ]
    )
    assert low.returncode in (0, 3), (
        "The --min-similarity 0.0 audit exited with %d.\nstderr:\n%s"
        % (low.returncode, low.stderr.decode("utf-8", "replace"))
    )
    low_report = load_json(report_path(low_dir))
    assert low_report["min_similarity"] == pytest.approx(0.0), (
        "report.min_similarity must echo --min-similarity 0.0."
    )
    assert not [v for v in low_report["gate"]["violations"] if v.endswith(":LOW_SIMILARITY")], (
        "A threshold of 0.0 must never produce a LOW_SIMILARITY violation."
    )
    check_totals_and_gate(low_dir, low_report, low.returncode)

    high = run_audit(
        [
            "--doc",
            "alignment_table",
            "--doc",
            "unicode_emoji",
            "--out",
            "out_v1_hi",
            "--min-similarity",
            "1.0",
        ]
    )
    assert high.returncode in (0, 3), (
        "The --min-similarity 1.0 audit exited with %d.\nstderr:\n%s"
        % (high.returncode, high.stderr.decode("utf-8", "replace"))
    )
    high_report = load_json(report_path(high_dir))
    assert high_report["min_similarity"] == pytest.approx(1.0), (
        "report.min_similarity must echo --min-similarity 1.0."
    )
    for document in high_report["documents"]:
        for run in document["runs"]:
            key = "%s/%s:LOW_SIMILARITY" % (document["document_id"], run["channel"])
            expected = run["final_similarity"] < 1.0
            assert (key in high_report["gate"]["violations"]) == expected, (
                "LOW_SIMILARITY must be present exactly when final_similarity < 1.0 (%s)." % key
            )
    check_totals_and_gate(high_dir, high_report, high.returncode)
    check_summary_layout(high_dir, high_report, high.stdout)
    for document in high_report["documents"]:
        doc_id = document["document_id"]
        assert os.path.isfile(detail_path(high_dir, doc_id)), (
            "detail.json must be written even when the gate fails (%s)." % doc_id
        )
        for channel in CHANNELS:
            for iteration in range(1, 4):
                path = artifact_path(high_dir, doc_id, channel, iteration)
                assert os.path.isfile(path), (
                    "Iteration artifacts must be written even when the gate fails (%s)." % path
                )


def test_summary_layout_of_full_audit(main_run):
    out_dir = main_run["out_dir"]
    report = main_run["report"]
    check_summary_layout(out_dir, report)
    text = read_bytes(os.path.join(out_dir, "summary.txt")).decode("utf-8")
    lines = text[:-1].split("\n")
    assert len(lines) == 23, "The full audit summary must have exactly 23 lines."
    assert lines[2] == "documents: 7", "Line 3 must be 'documents: 7'."
    assert lines[3] == "runs: 14", "Line 4 must be 'runs: 14'."
    assert lines[5] == "min_similarity: 0.950000", "Line 6 must be 'min_similarity: 0.950000'."


def test_json_files_follow_formatting_rules(main_run):
    out_dir = main_run["out_dir"]
    check_json_formatting(report_path(out_dir))
    for doc_id in DOC_IDS:
        check_json_formatting(detail_path(out_dir, doc_id))


def test_non_ascii_document_ids_are_not_escaped(unicode_id_run):
    out_dir = unicode_id_run["out_dir"]
    report = unicode_id_run["report"]
    doc_id = "caf\u00e9_pr\u00f3be"
    ids = [document["document_id"] for document in report["documents"]]
    assert ids == [doc_id], "The unicode corpus must yield exactly [%r], got %s." % (doc_id, ids)
    assert os.path.isdir(os.path.join(out_dir, "documents", doc_id)), (
        "The document directory must be named after the non-ASCII document id."
    )
    for path in (report_path(out_dir), detail_path(out_dir, doc_id)):
        check_json_formatting(path)
        raw = read_bytes(path)
        assert doc_id.encode("utf-8") in raw, (
            "%s must contain the non-ASCII document id verbatim (unescaped)." % path
        )
    summary_raw = read_bytes(os.path.join(out_dir, "summary.txt"))
    assert doc_id.encode("utf-8") in summary_raw, (
        "summary.txt must contain the non-ASCII document id verbatim."
    )
    check_measurements(out_dir, report)
    check_totals_and_gate(out_dir, report, unicode_id_run["returncode"])
    check_summary_layout(out_dir, report, unicode_id_run["stdout"])


def test_outputs_are_byte_deterministic(determinism_runs):
    first, second = determinism_runs
    assert first["returncode"] == second["returncode"], (
        "Two identical invocations must produce the same exit code."
    )
    for relative in ("report.json", "summary.txt"):
        assert read_bytes(os.path.join(first["out_dir"], relative)) == read_bytes(
            os.path.join(second["out_dir"], relative)
        ), "%s differs between two identical runs." % relative
    for doc_id in ("fragment_page", "nested_lists"):
        assert read_bytes(detail_path(first["out_dir"], doc_id)) == read_bytes(
            detail_path(second["out_dir"], doc_id)
        ), "detail.json for %s differs between two identical runs." % doc_id
        for channel in CHANNELS:
            for iteration in range(1, 4):
                assert read_bytes(
                    artifact_path(first["out_dir"], doc_id, channel, iteration)
                ) == read_bytes(
                    artifact_path(second["out_dir"], doc_id, channel, iteration)
                ), "Artifact %s/%s/iter_%02d differs between two identical runs." % (
                    doc_id,
                    channel,
                    iteration,
                )


def test_doc_filter_restricts_the_audit(determinism_runs):
    out_dir = determinism_runs[0]["out_dir"]
    report = load_json(report_path(out_dir))
    ids = [document["document_id"] for document in report["documents"]]
    assert ids == ["fragment_page", "nested_lists"], (
        "--doc must restrict the audit to the requested ids in ascending order, got %s." % ids
    )
    assert report["totals"]["documents"] == 2, "totals.documents must be 2."
    assert report["totals"]["runs"] == 4, "totals.runs must be 4."
    entries = sorted(os.listdir(os.path.join(out_dir, "documents")))
    assert entries == ["fragment_page", "nested_lists"], (
        "Only the selected documents may appear under documents/, got %s." % entries
    )
    text = read_bytes(os.path.join(out_dir, "summary.txt")).decode("utf-8")
    assert len(text[:-1].split("\n")) == 13, "The filtered summary must have exactly 13 lines."
    check_summary_layout(out_dir, report)


def test_max_iterations_is_honoured(five_iteration_run):
    out_dir = five_iteration_run["out_dir"]
    report = five_iteration_run["report"]
    assert report["max_iterations"] == 5, "report.max_iterations must be 5."
    for document in report["documents"]:
        for run in document["runs"]:
            assert run["iterations"] == 5, "Every run must report 5 iterations."
            if run["fixpoint_iteration"] is not None:
                assert 1 <= run["fixpoint_iteration"] <= 4, (
                    "fixpoint_iteration must be within 1..4 when max_iterations is 5."
                )
    detail = load_json(detail_path(out_dir, "fenced_code"))
    for channel in CHANNELS:
        assert len(detail["channels"][channel]["iterations"]) == 5, (
            "detail.json must carry 5 iteration records for %s." % channel
        )
        for iteration in range(1, 6):
            path = artifact_path(out_dir, "fenced_code", channel, iteration)
            assert os.path.isfile(path), "Missing artifact %s." % path
    check_measurements(out_dir, report)
    check_fixpoint_and_codes(out_dir, report)


def test_stale_output_is_purged(five_iteration_run):
    out_dir = five_iteration_run["out_dir"]
    stale_file = os.path.join(out_dir, "STALE.txt")
    ghost_file = os.path.join(out_dir, "documents", "ghostdoc", "ghost.md")
    write_file(stale_file, "stale\n")
    write_file(ghost_file, "ghost\n")

    result = run_audit(five_iteration_run["args"])
    assert result.returncode in (0, 3), (
        "The rerun exited with %d.\nstderr:\n%s"
        % (result.returncode, result.stderr.decode("utf-8", "replace"))
    )
    assert not os.path.exists(stale_file), "%s must be removed before writing new output." % stale_file
    assert not os.path.exists(os.path.join(out_dir, "documents", "ghostdoc")), (
        "Stale document directories must be removed before writing new output."
    )
    assert os.path.isfile(report_path(out_dir)), "report.json must be rewritten after the purge."
    assert os.path.isfile(
        artifact_path(out_dir, "fenced_code", "markdown", 5)
    ), "Regular artifacts must be present again after the purge."


@pytest.mark.parametrize(
    "case,args",
    [
        ("missing_corpus", ["--corpus", "/tmp/fx_corpus_missing", "--out", "out_bad"]),
        ("no_eligible_file", ["--corpus", "/tmp/fx_corpus_empty", "--out", "out_bad"]),
        ("duplicate_document_id", ["--corpus", "/tmp/fx_corpus_dup", "--out", "out_bad"]),
        ("unknown_doc", ["--out", "out_bad", "--doc", "no_such_document"]),
        ("iterations_too_low", ["--out", "out_bad", "--max-iterations", "1"]),
        ("iterations_too_high", ["--out", "out_bad", "--max-iterations", "11"]),
        ("iterations_not_an_int", ["--out", "out_bad", "--max-iterations", "abc"]),
        ("similarity_above_range", ["--out", "out_bad", "--min-similarity", "1.5"]),
        ("similarity_below_range", ["--out", "out_bad", "--min-similarity", "-0.1"]),
    ],
)
def test_invalid_invocations_exit_two_without_side_effects(case, args):
    shutil.rmtree("/tmp/fx_corpus_missing", ignore_errors=True)
    empty_corpus = "/tmp/fx_corpus_empty"
    shutil.rmtree(empty_corpus, ignore_errors=True)
    write_file(os.path.join(empty_corpus, "data.txt"), "not a document\n")
    write_file(os.path.join(empty_corpus, "image.png"), "not really a png\n")
    dup_corpus = "/tmp/fx_corpus_dup"
    shutil.rmtree(dup_corpus, ignore_errors=True)
    write_file(os.path.join(dup_corpus, "same.md"), "# Same\n\nBody.\n")
    write_file(os.path.join(dup_corpus, "same.html"), "<h1>Same</h1><p>Body.</p>\n")

    out_bad = os.path.join(PROJECT_DIR, "out_bad")
    shutil.rmtree(out_bad, ignore_errors=True)
    keep_file = os.path.join(out_bad, "keep.txt")
    write_file(keep_file, "keep-me\n")

    result = run_audit(args)
    stderr = result.stderr.decode("utf-8", "replace")
    assert result.returncode == 2, (
        "Case %s must exit with code 2, got %d.\nstderr:\n%s" % (case, result.returncode, stderr)
    )
    assert result.stdout == b"", "Case %s must print nothing on stdout." % case
    assert any(line.startswith("error: ") for line in stderr.splitlines()), (
        "Case %s must print a line starting with 'error: ' on stderr, got:\n%s" % (case, stderr)
    )
    assert os.path.isfile(keep_file), "Case %s must not delete %s." % (case, keep_file)
    assert read_bytes(keep_file) == b"keep-me\n", (
        "Case %s must not modify %s." % (case, keep_file)
    )
    assert not os.path.exists(report_path(out_bad)), (
        "Case %s must not write a report into the output directory." % case
    )


def test_unseen_corpus_is_handled_generically(unseen_corpus_run):
    out_dir = unseen_corpus_run["out_dir"]
    report = unseen_corpus_run["report"]
    ids = [document["document_id"] for document in report["documents"]]
    assert ids == ["probe", "probe_html"], (
        "The unseen corpus must yield exactly ['probe', 'probe_html'], got %s." % ids
    )
    assert report["corpus"] in (
        unseen_corpus_run["corpus"],
        os.path.realpath(unseen_corpus_run["corpus"]),
    ), "report.corpus must point at the temporary corpus, got %r." % report["corpus"]
    assert report["max_iterations"] == 2, "report.max_iterations must be 2."

    for doc_id in ids:
        assert os.path.isfile(detail_path(out_dir, doc_id)), "Missing detail.json for %s." % doc_id
        assert os.path.isfile(
            os.path.join(out_dir, "documents", doc_id, "observation.html")
        ), "Missing observation.html for %s." % doc_id
        for channel in CHANNELS:
            for iteration in (1, 2):
                path = artifact_path(out_dir, doc_id, channel, iteration)
                assert os.path.isfile(path), "Missing artifact %s." % path

    check_measurements(out_dir, report)
    check_structures(out_dir, report)
    check_fixpoint_and_codes(out_dir, report)
    check_totals_and_gate(out_dir, report, unseen_corpus_run["returncode"])
    check_summary_layout(out_dir, report, unseen_corpus_run["stdout"])
    check_json_formatting(report_path(out_dir))
    for doc_id in ids:
        check_json_formatting(detail_path(out_dir, doc_id))
