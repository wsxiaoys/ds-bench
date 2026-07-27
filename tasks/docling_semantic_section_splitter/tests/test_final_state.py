import json
import os
import re
import subprocess
import sys

import pytest

PROJECT_DIR = "/home/user/project"
OUTPUT_DIR = os.path.join(PROJECT_DIR, "output")
SECTIONS_DIR = os.path.join(OUTPUT_DIR, "sections")
INDEX_MD = os.path.join(OUTPUT_DIR, "index.md")
TOC_JSON = os.path.join(OUTPUT_DIR, "toc.json")

DOC_TITLE = "Quarterly Systems Report"

# Ground-truth heading tree of assets/report.pdf, in document reading order.
# (full heading text, level, body sentinel token that lives under that heading)
SEQUENCE = [
    ("1 Introduction", 1, "SNTLQ001"),
    ("1.1 Background", 2, "SNTLQ002"),
    ("1.1.1 Prior Work", 3, "SNTLQ003"),
    ("1.2 Objectives", 2, "SNTLQ004"),
    ("2 Methodology", 1, "SNTLQ005"),
    ("2.1 Data Collection", 2, "SNTLQ006"),
    ("2.1.1 Sampling", 3, "SNTLQ007"),
    ("2.1.2 Instruments", 3, "SNTLQ008"),
    ("2.2 Analysis", 2, "SNTLQ009"),
    ("3 Results", 1, "SNTLQ010"),
    ("3.1 Findings", 2, "SNTLQ011"),
    ("3.2 Discussion", 2, "SNTLQ012"),
    ("3.2.1 Limitations", 3, "SNTLQ013"),
    ("4 Conclusion", 1, "SNTLQ014"),
    ("4.1 Summary", 2, "SNTLQ015"),
]

LINK_RE = re.compile(r"\[([^\]]+)\]\(([^)\s]+)\)")


def slug(text):
    """lowercase; every maximal run outside [a-z0-9] -> single '-'; strip '-'."""
    lowered = text.lower()
    hyphenated = re.sub(r"[^a-z0-9]+", "-", lowered)
    return hyphenated.strip("-")


def build_h1_sections():
    """Return list of dicts describing each H1 section in document order."""
    sections = []
    current = None
    for title, level, token in SEQUENCE:
        if level == 1:
            current = {
                "title": title,
                "subsections": [],  # list of (title, level)
                "tokens": [token],
            }
            sections.append(current)
        else:
            assert current is not None
            current["subsections"].append((title, level))
            current["tokens"].append(token)
    for idx, sec in enumerate(sections, start=1):
        sec["filename"] = f"{idx:02d}-{slug(sec['title'])}.md"
    return sections


def build_expected_tree():
    roots = []
    stack = []  # (level, node)
    for title, level, _token in SEQUENCE:
        node = {"title": title, "level": level, "children": []}
        if level == 1:
            roots.append(node)
            stack = [(1, node)]
        else:
            while stack and stack[-1][0] >= level:
                stack.pop()
            stack[-1][1]["children"].append(node)
            stack.append((level, node))
    return roots


H1_SECTIONS = build_h1_sections()
EXPECTED_TREE = build_expected_tree()


def read_text(path):
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


def first_heading_line(text):
    for line in text.splitlines():
        if re.match(r"^#{1,6}\s", line):
            return line.rstrip()
    return None


@pytest.fixture(scope="session")
def run_solution():
    """(Re)generate all outputs deterministically from the input PDF."""
    if os.path.isdir(OUTPUT_DIR):
        import shutil

        shutil.rmtree(OUTPUT_DIR)
    main_py = os.path.join(PROJECT_DIR, "main.py")
    assert os.path.isfile(main_py), f"Expected solution entrypoint {main_py} to exist."
    result = subprocess.run(
        [sys.executable, "main.py"],
        cwd=PROJECT_DIR,
        capture_output=True,
        text=True,
        timeout=1800,
    )
    print("STDOUT:\n", result.stdout)
    print("STDERR:\n", result.stderr)
    assert result.returncode == 0, (
        f"`python main.py` failed with code {result.returncode}. Stderr: {result.stderr}"
    )
    return result


def test_outputs_exist(run_solution):
    assert os.path.isdir(OUTPUT_DIR), f"Output directory {OUTPUT_DIR} was not created."
    assert os.path.isdir(SECTIONS_DIR), f"Sections directory {SECTIONS_DIR} was not created."
    assert os.path.isfile(INDEX_MD), f"{INDEX_MD} was not created."
    assert os.path.isfile(TOC_JSON), f"{TOC_JSON} was not created."


def test_section_file_count_and_names(run_solution):
    files = sorted(f for f in os.listdir(SECTIONS_DIR) if f.endswith(".md"))
    expected = sorted(sec["filename"] for sec in H1_SECTIONS)
    assert files == expected, (
        f"Section files mismatch. Expected exactly {expected}, got {files}."
    )
    n_h1 = sum(1 for _t, lvl, _tok in SEQUENCE if lvl == 1)
    assert len(files) == n_h1, (
        f"Number of section files ({len(files)}) must equal number of H1 headings ({n_h1})."
    )


def test_h1_title_is_first_heading(run_solution):
    for sec in H1_SECTIONS:
        path = os.path.join(SECTIONS_DIR, sec["filename"])
        text = read_text(path)
        heading = first_heading_line(text)
        assert heading is not None, f"No Markdown heading found in {path}."
        assert heading.strip() == f"# {sec['title']}", (
            f"First heading of {path} must be '# {sec['title']}', got '{heading}'."
        )


def test_subsection_headings_present_and_ordered(run_solution):
    for sec in H1_SECTIONS:
        path = os.path.join(SECTIONS_DIR, sec["filename"])
        text = read_text(path)
        positions = []
        for title, level in sec["subsections"]:
            pat = re.compile(
                r"^#{" + str(level) + r"}[ \t]+" + re.escape(title) + r"\s*$",
                re.MULTILINE,
            )
            m = pat.search(text)
            assert m is not None, (
                f"Subsection heading '{'#' * level} {title}' not found in {path}."
            )
            positions.append(m.start())
        assert positions == sorted(positions), (
            f"Subsection headings in {path} are not in the expected reading order."
        )


def test_no_content_lost_or_duplicated(run_solution):
    token_to_file = {}
    for sec in H1_SECTIONS:
        for token in sec["tokens"]:
            token_to_file[token] = sec["filename"]

    contents = {
        sec["filename"]: read_text(os.path.join(SECTIONS_DIR, sec["filename"]))
        for sec in H1_SECTIONS
    }

    for token, expected_file in token_to_file.items():
        hits = [fname for fname, txt in contents.items() if token in txt]
        assert len(hits) == 1, (
            f"Sentinel {token} must appear in exactly one section file, found in {hits}."
        )
        assert hits[0] == expected_file, (
            f"Sentinel {token} must live in {expected_file}, but was found in {hits[0]}."
        )


def test_toc_top_level(run_solution):
    toc = json.loads(read_text(TOC_JSON))
    assert isinstance(toc.get("title"), str) and toc["title"].strip(), (
        "toc.json 'title' must be a non-empty string."
    )
    sections = toc.get("sections")
    assert isinstance(sections, list), "toc.json 'sections' must be a list."
    assert len(sections) == len(H1_SECTIONS), (
        f"toc.json must have {len(H1_SECTIONS)} top-level sections, got {len(sections)}."
    )
    page_nos = []
    for node, sec in zip(sections, H1_SECTIONS):
        assert node["level"] == 1, "Top-level toc nodes must have level 1."
        assert node["title"] == sec["title"], (
            f"Expected top-level title {sec['title']}, got {node.get('title')}."
        )
        assert node["anchor"] == slug(sec["title"]), (
            f"Anchor for {sec['title']} must be {slug(sec['title'])}, got {node.get('anchor')}."
        )
        assert node.get("filename") == f"sections/{sec['filename']}", (
            f"H1 node filename must be 'sections/{sec['filename']}', got {node.get('filename')}."
        )
        assert isinstance(node["page_no"], int) and node["page_no"] >= 1, (
            f"page_no for {sec['title']} must be an int >= 1, got {node.get('page_no')}."
        )
        page_nos.append(node["page_no"])
    assert page_nos[0] == 1, "The first H1 section must start on page 1."
    assert all(a < b for a, b in zip(page_nos, page_nos[1:])), (
        f"H1 page_no values must be strictly increasing, got {page_nos}."
    )


def _check_node(actual, expected):
    assert actual["title"] == expected["title"], (
        f"TOC node title mismatch: expected {expected['title']}, got {actual.get('title')}."
    )
    assert actual["level"] == expected["level"], (
        f"TOC node level mismatch for {expected['title']}."
    )
    assert actual["anchor"] == slug(expected["title"]), (
        f"TOC anchor for {expected['title']} must be {slug(expected['title'])}."
    )
    assert isinstance(actual["page_no"], int) and actual["page_no"] >= 1, (
        f"TOC node {expected['title']} must have integer page_no >= 1."
    )
    if expected["level"] == 1:
        assert "filename" in actual, f"H1 node {expected['title']} must have a filename."
    else:
        assert "filename" not in actual, (
            f"Non-H1 node {expected['title']} must NOT have a filename key."
        )
    actual_children = actual.get("children", [])
    assert len(actual_children) == len(expected["children"]), (
        f"Node {expected['title']} must have {len(expected['children'])} children, "
        f"got {len(actual_children)}."
    )
    for a_child, e_child in zip(actual_children, expected["children"]):
        _check_node(a_child, e_child)


def test_toc_nesting_levels_anchors(run_solution):
    toc = json.loads(read_text(TOC_JSON))
    sections = toc["sections"]
    assert len(sections) == len(EXPECTED_TREE)
    for actual, expected in zip(sections, EXPECTED_TREE):
        _check_node(actual, expected)


def test_toc_pagination_monotonic(run_solution):
    toc = json.loads(read_text(TOC_JSON))

    order = []

    def walk(node):
        order.append(node["page_no"])
        for child in node.get("children", []):
            walk(child)

    for node in toc["sections"]:
        walk(node)
    assert all(a <= b for a, b in zip(order, order[1:])), (
        f"page_no values must be non-decreasing in reading order, got {order}."
    )


def test_index_links(run_solution):
    text = read_text(INDEX_MD)
    links = LINK_RE.findall(text)
    # Keep, in order, links whose text matches an H1 title.
    title_to_file = {sec["title"]: sec["filename"] for sec in H1_SECTIONS}
    ordered_hits = [(t, tgt) for (t, tgt) in links if t.strip() in title_to_file]
    assert len(ordered_hits) == len(H1_SECTIONS), (
        f"index.md must contain one link per H1 section; got {ordered_hits}."
    )
    for (text_label, target), sec in zip(ordered_hits, H1_SECTIONS):
        assert text_label.strip() == sec["title"], (
            f"index.md links out of order; expected {sec['title']}, got {text_label}."
        )
        resolved = os.path.normpath(os.path.join(OUTPUT_DIR, target))
        expected_path = os.path.join(SECTIONS_DIR, sec["filename"])
        assert os.path.isfile(resolved), (
            f"index.md link target {target} does not resolve to an existing file."
        )
        assert os.path.samefile(resolved, expected_path), (
            f"index.md link for {sec['title']} should point to {expected_path}, "
            f"resolved to {resolved}."
        )


def _resolve(link_dir, target):
    return os.path.normpath(os.path.join(link_dir, target))


def test_section_cross_links(run_solution):
    n = len(H1_SECTIONS)
    for i, sec in enumerate(H1_SECTIONS):
        path = os.path.join(SECTIONS_DIR, sec["filename"])
        text = read_text(path)
        links = LINK_RE.findall(text)
        by_label = {}
        for label, target in links:
            by_label.setdefault(label.strip(), target)

        # Index back-link
        assert "Index" in by_label, f"{path} is missing an 'Index' cross-link."
        resolved_index = _resolve(SECTIONS_DIR, by_label["Index"])
        assert os.path.isfile(resolved_index) and os.path.samefile(resolved_index, INDEX_MD), (
            f"'Index' link in {path} must resolve to {INDEX_MD}."
        )

        # Previous
        if i > 0:
            assert "Previous" in by_label, f"{path} is missing a 'Previous' cross-link."
            resolved_prev = _resolve(SECTIONS_DIR, by_label["Previous"])
            expected_prev = os.path.join(SECTIONS_DIR, H1_SECTIONS[i - 1]["filename"])
            assert os.path.isfile(resolved_prev) and os.path.samefile(resolved_prev, expected_prev), (
                f"'Previous' link in {path} must resolve to {expected_prev}."
            )
        else:
            assert "Previous" not in by_label, (
                f"The first section {path} must not have a 'Previous' link."
            )

        # Next
        if i < n - 1:
            assert "Next" in by_label, f"{path} is missing a 'Next' cross-link."
            resolved_next = _resolve(SECTIONS_DIR, by_label["Next"])
            expected_next = os.path.join(SECTIONS_DIR, H1_SECTIONS[i + 1]["filename"])
            assert os.path.isfile(resolved_next) and os.path.samefile(resolved_next, expected_next), (
                f"'Next' link in {path} must resolve to {expected_next}."
            )
        else:
            assert "Next" not in by_label, (
                f"The last section {path} must not have a 'Next' link."
            )
