# Build FROM the official CPU image: torch, docling, docling-serve and ALL
# default model weights are already baked in — the build does NO model/PyTorch
# downloads, so it will not hit HuggingFace/PyTorch timeouts and needs no
# build-time warmup. This task only exercises the HTML backend, which is pure
# CPU parsing and needs no model weights at all.
FROM ghcr.io/docling-project/docling-serve-cpu:latest

ARG POCHI_VERSION

# --- System deps: CentOS 9 Stream uses dnf, not apt-get ---
# Stay as root (UID 0) for the whole image so the harness, Pochi CLI, pytest,
# and the agent all have unrestricted access.
USER 0
# MUST set HOME=/root explicitly — switching USER does not change HOME, and the
# base image's inherited HOME=/opt/app-root/src would otherwise redirect the
# Pochi installer into the wrong directory and break the symlink below.
ENV HOME=/root
# NOTE: git, wget, and curl already ship in the base image — do not re-install.
RUN dnf config-manager --set-enabled crb \
    && dnf install -y https://dl.fedoraproject.org/pub/epel/epel-release-latest-9.noarch.rpm \
    && dnf install -y --nodocs --setopt=install_weak_deps=False ripgrep \
    && dnf clean all \
    && rm -rf /var/cache/dnf \
    && curl -fsSL https://getpochi.com/install.sh | bash -s ${POCHI_VERSION} \
    && ln -s /root/.pochi/bin/pochi /usr/local/bin/pochi \
    && python -m pip install --no-cache-dir pytest pytest-json-ctrf

# --- Runtime configuration ---
# Point the docling library at the pre-baked models so anything that does touch
# a model pipeline stays fully offline. Absolute path inherent to the base
# image. DOCLING_SERVE_ARTIFACTS_PATH / TESSDATA_PREFIX / OMP_NUM_THREADS are
# already set by the base image.
ENV DOCLING_ARTIFACTS_PATH="/opt/app-root/src/.cache/docling/models"

# --- Harbor project directory (CRITICAL — do NOT use /opt/app-root/src) ---
# The harness only persists agent-authored files under /home/user, so the
# project must live there, not at the base image's own HOME/WORKDIR.
RUN mkdir -p /home/user && chmod 0755 /home/user
RUN mkdir -p /home/user/project/assets && chmod -R 0755 /home/user/project

# --- Build-time input fixtures -------------------------------------------
# Author the HTML corpus and the local resource tree. This is pure file
# writing plus one tiny PNG drawn with Pillow: NO docling conversion and NO
# assertions run at build time.
RUN cat >/tmp/gen_fixtures.py <<'PYEOF'
"""Generate the HTML fixture corpus and the local resource tree."""

import sys
from pathlib import Path

PROJECT = Path(sys.argv[1] if len(sys.argv) > 1 else "/home/user/project")
HTML_DIR = PROJECT / "assets" / "html"
LOCAL_DIR = PROJECT / "assets" / "local"
HTML_DIR.mkdir(parents=True, exist_ok=True)
(LOCAL_DIR / "images").mkdir(parents=True, exist_ok=True)

SENTINEL = "\ue000"

FIXTURES: dict[str, str] = {}

FIXTURES["br_paragraph.html"] = (
    "<!DOCTYPE html>\n<html><head><title>Line Break Semantics</title></head><body>\n"
    "<h1>Line Breaks</h1>\n"
    "<p>\nThis sentence is split across\nsource newlines and must stay together.\n</p>\n"
    "<p>foo<br>bar</p>\n"
    "<p>alpha<br><br>beta</p>\n"
    "<address>Street 1<br>City</address>\n"
    f"<p>Text with a pre-existing sentinel{SENTINEL}character.</p>\n"
    "</body></html>\n"
)

FIXTURES["br_table.html"] = (
    "<!DOCTYPE html>\n<html><head><title>Line Breaks In Cells</title></head><body>\n"
    "<h1>Cells</h1>\n"
    "<table>\n"
    "<tr><td>Cell 1<br>Line 2</td><td>Plain</td></tr>\n"
    "<tr><td>Cell A<br><br>Cell B</td><td>Plain 2</td></tr>\n"
    "</table>\n"
    "</body></html>\n"
)

FIXTURES["pre_block.html"] = (
    "<!DOCTYPE html>\n<html><head><title>Preformatted</title></head><body>\n"
    "<h1>Program</h1>\n"
    "<pre>\nLine 1\nLine 2\nLine 3\n</pre>\n"
    "</body></html>\n"
)

FIXTURES["furniture_footer.html"] = (
    "<html><body><p>Initial content with some <strong>bold text</strong></p>"
    "<h1>Main Heading</h1>"
    "<p>Some Content</p>"
    "<footer><p>Some Footer Content</p></footer></body></html>"
)

FIXTURES["ol_default.html"] = (
    "<html><body><ol><li>1st item</li><li>2nd item</li></ol></body></html>"
)
FIXTURES["ol_start_2.html"] = (
    '<html><body><ol start="2"><li>1st item</li><li>2nd item</li></ol></body></html>'
)
FIXTURES["ol_start_0.html"] = (
    '<html><body><ol start="0"><li>1st item</li><li>2nd item</li></ol></body></html>'
)
FIXTURES["ol_start_neg5.html"] = (
    '<html><body><ol start="-5"><li>1st item</li><li>2nd item</li></ol></body></html>'
)
FIXTURES["ol_start_foo.html"] = (
    '<html><body><ol start="foo"><li>1st item</li><li>2nd item</li></ol></body></html>'
)

FIXTURES["dl_basic.html"] = (
    "<html><body><dl><dt>Coffee</dt><dd>Black hot drink</dd>"
    "<dt>Milk</dt><dd>White cold drink</dd></dl></body></html>"
)
FIXTURES["dl_multi_dd.html"] = (
    "<html><body><dl><dt>Python</dt><dd>A high-level programming language</dd>"
    "<dd>Known for simplicity</dd></dl></body></html>"
)
FIXTURES["dl_strong_dt.html"] = (
    "<html><body><dl><dt><strong>HTML</strong></dt>"
    "<dd>HyperText Markup Language</dd></dl></body></html>"
)
FIXTURES["dl_orphan_dd.html"] = (
    "<html><body><dl><dd>Orphan description 1</dd>"
    "<dd>Orphan description 2</dd></dl></body></html>"
)

FIXTURES["nested_table_in_li.html"] = (
    "<html><body><ol>"
    "<li>First step.</li>"
    "<li>Second step:"
    "<table><thead><tr><th>Name</th><th>Desc</th></tr></thead>"
    "<tbody><tr><td>Type</td>"
    "<td>Fault type.<ul><li>Alpha</li><li>Beta</li></ul></td></tr>"
    "</tbody></table></li>"
    "<li>Third step.</li>"
    "</ol></body></html>"
)

FIXTURES["nested_table_in_dd.html"] = (
    "<html><body><dl><dt>Term</dt>"
    "<dd>Def:<table><tbody><tr><td>A</td><td>B</td></tr></tbody></table></dd>"
    "</dl></body></html>"
)

FIXTURES["table_rowspan_header.html"] = (
    "<html><body><h1>Spans</h1><table>"
    "<tr><th rowspan=\"2\">Region</th><th colspan=\"2\">Sales</th></tr>"
    "<tr><th>Q1</th><th>Q2</th></tr>"
    "<tr><td>North</td><td>10</td><td>20</td></tr>"
    "</table></body></html>"
)


def _nested_clade(depth: int) -> str:
    def _inner(level: int) -> str:
        img = f'<img src="clade_{level}.png" alt="clade {level}">'
        if level == depth - 1:
            inner = f"<td>{img}</td>"
        else:
            inner = f"<td>{img}{_inner(level + 1)}</td>"
        return f"<table><tbody><tr>{inner}</tr></tbody></table>"

    return f"<html><body><h2>Cladogram</h2>{_inner(0)}</body></html>"


FIXTURES["nested_table_images.html"] = _nested_clade(6)

for name, content in FIXTURES.items():
    (HTML_DIR / name).write_text(content, encoding="utf-8")

# --- local resource tree used by the resource-policy probes ---------------
(LOCAL_DIR / "page.html").write_text(
    '<html><body><h1>Local Page</h1><p>See <img src="images/tiny.png"></p></body></html>',
    encoding="utf-8",
)
(LOCAL_DIR / "images" / "diagram.svg").write_text(
    '<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"></svg>\n',
    encoding="utf-8",
)

from PIL import Image  # noqa: E402

Image.new("RGB", (4, 4), (10, 120, 200)).save(
    LOCAL_DIR / "images" / "tiny.png", format="PNG"
)
PYEOF
RUN python /tmp/gen_fixtures.py /home/user/project \
    && rm -f /tmp/gen_fixtures.py \
    && chmod -R 0755 /home/user/project

WORKDIR /home/user/project
# NOTE: main.py is authored by the agent at solve time — do not COPY it in and
# do not add a `CMD ["python", "main.py"]`.

LABEL Author="generate-harbor-tasks"
LABEL Description="Docling (docling-serve-cpu base, fully offline) HTML-backend task: audit HTML->DoclingDocument structural fidelity and the backend's local/remote resource-fetch policy, with a build-time HTML fixture corpus at /home/user/project/assets/html and a local resource tree at /home/user/project/assets/local."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - base image: ghcr.io/docling-project/docling-serve-cpu:latest (CentOS 9
#     Stream, Python 3.12, docling + all model weights pre-baked, Pillow,
#     BeautifulSoup and requests already installed)
#   - extra dnf packages: ripgrep (via crb + EPEL)
#   - extra pip packages: pytest, pytest-json-ctrf
#   - Pochi CLI installed and symlinked to /usr/local/bin/pochi
#   - DOCLING_ARTIFACTS_PATH points docling at the pre-baked offline models
#   - /home/user/project: Harbor project directory (WORKDIR)
#   - /home/user/project/assets/html: 17 build-time HTML fixtures
#   - /home/user/project/assets/local: page.html + images/tiny.png + images/diagram.svg

COPY test_initial_state.py /bootstrap/test_initial_state.py

# Setup entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
