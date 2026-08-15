# Build FROM the official CPU image: torch, docling and ALL default model weights
# are already baked in, so the build performs no model downloads and the task runs
# fully offline. Markdown conversion (InputFormat.MD) needs no AI model at all.
FROM ghcr.io/docling-project/docling-serve-cpu:latest

ARG POCHI_VERSION

# --- System deps: CentOS 9 Stream uses dnf, not apt-get ---
# Stay as root (UID 0) for the whole image so the harness, Pochi CLI, pytest and
# the agent all have unrestricted access. HOME must be reset explicitly.
USER 0
ENV HOME=/root

# NOTE: git, wget and curl already ship with the base image; only ripgrep is missing.
RUN dnf config-manager --set-enabled crb \
    && dnf install -y https://dl.fedoraproject.org/pub/epel/epel-release-latest-9.noarch.rpm \
    && dnf install -y --nodocs --setopt=install_weak_deps=False ripgrep \
    && dnf clean all \
    && rm -rf /var/cache/dnf \
    && curl -fsSL https://getpochi.com/install.sh | bash -s ${POCHI_VERSION} \
    && ln -s /root/.pochi/bin/pochi /usr/local/bin/pochi \
    && python -m pip install --no-cache-dir pytest pytest-json-ctrf

# --- Runtime configuration ---
# Point the docling library at the pre-baked models so nothing is ever fetched.
ENV DOCLING_ARTIFACTS_PATH="/opt/app-root/src/.cache/docling/models"

# --- Harbor project directory (must live under /home/user) ---
RUN mkdir -p /home/user/md_table_audit/assets/corpus && chmod -R 0755 /home/user

# --- Build-time fixture generation (deterministic, no downloads) ---
RUN cat >/tmp/gen_corpus.py <<'PYEOF'
"""Generate the deterministic markdown corpus used by the audit task."""

import base64
import sys
from io import BytesIO
from pathlib import Path

from PIL import Image


def _png_data_uri(img):
    buf = BytesIO()
    img.save(buf, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


def _solid(width, height, color):
    return Image.new("RGB", (width, height), color=color)


def _gradient(width, height):
    img = Image.new("RGB", (width, height))
    px = img.load()
    for y in range(height):
        for x in range(width):
            px[x, y] = ((x * 7) % 256, (y * 13) % 256, (x * y) % 256)
    return img


ALIGNMENTS = """# Quarterly Revenue

Region | Q1 | Q2
:--- | :---: | ---:
North | 10 | 20
South | 30 | 40

| City | Growth |
| ---: | :--- |
| Zurich | 4.5 |
| Basel | 1.25 |
"""

FORMATTED = """## Formatted Headers

**Region** | Q1
--- | ---
North | 10

| [Region](https://example.com) | `Q2` |
| --- | --- |
| South | 20 |
"""

RAGGED = """### Ragged Rows

| a | b | c |
| :--- | --- | ---: |
| 1 | 2 |
| 4 | 5 | 6 | 7 |
|  |  |  |
| x \\| y | z |  |
"""

PROSE = """Region | Q1
--- | ---
North | 10

Some sentence with a | pipe in it.

Region | Q1 | Q2
--- | ---
South | 20

| Region | Q2 |
| --- | --- |
| South | 20 |
"""

CODE_AND_IMAGES = """# Assets

```python
import sys
print(sys.argv)
```

```
SELECT id FROM users;
```

```
ambiguous snippet here
```

Pipeline: extract | transform | load

![small]({small})

![mid]({mid})

![big]({big})

| step | owner |
| --- | --- |
| parse | docling |
"""


def main(out_dir):
    corpus = Path(out_dir)
    corpus.mkdir(parents=True, exist_ok=True)

    (corpus / "01_alignments.md").write_text(ALIGNMENTS, encoding="utf-8")
    (corpus / "02_formatted_headers.md").write_text(FORMATTED, encoding="utf-8")
    (corpus / "03_ragged_cells.md").write_text(RAGGED, encoding="utf-8")
    (corpus / "04_pipes_in_prose.md").write_text(PROSE, encoding="utf-8")
    (corpus / "05_code_and_images.md").write_text(
        CODE_AND_IMAGES.format(
            small=_png_data_uri(_solid(7, 5, (255, 0, 0))),
            mid=_png_data_uri(_solid(12, 9, (0, 128, 255))),
            big=_png_data_uri(_gradient(64, 64)),
        ),
        encoding="utf-8",
    )
    (corpus / "06_broken_encoding.md").write_bytes(
        b"\xff\xfe# Broken heading\x00\xff not utf-8 | at all\n"
    )


if __name__ == "__main__":
    main(sys.argv[1])
PYEOF

RUN python /tmp/gen_corpus.py /home/user/md_table_audit/assets/corpus \
    && rm -f /tmp/gen_corpus.py \
    && chmod -R 0755 /home/user

WORKDIR /home/user/md_table_audit

LABEL Author="generate-harbor-tasks"
LABEL Description="Offline docling Markdown-backend environment with a GFM table edge-case corpus in /home/user/md_table_audit/assets/corpus."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - base image ghcr.io/docling-project/docling-serve-cpu:latest (Python 3.12, docling,
#     CPU torch and all default model weights pre-baked; CentOS 9 Stream / dnf)
#   - extra dnf package: ripgrep (git, wget, curl already present)
#   - pip packages: pytest, pytest-json-ctrf
#   - Pochi CLI symlinked at /usr/local/bin/pochi
#   - /home/user/md_table_audit: task project directory (WORKDIR)
#   - /home/user/md_table_audit/assets/corpus: 6 build-time generated markdown fixtures
#     (5 UTF-8 documents with GFM table/code/image edge cases + 1 invalid-UTF-8 file)

COPY test_initial_state.py /bootstrap/test_initial_state.py

# Setup entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
