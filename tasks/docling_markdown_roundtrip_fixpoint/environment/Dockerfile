# Task environment for the Docling roundtrip fixpoint auditor.
#
# Built on the official Docling CPU image so that torch, docling and every
# default model weight are already baked in: the build performs NO downloads of
# models and the container runs fully offline.
FROM ghcr.io/docling-project/docling-serve-cpu:latest

ARG POCHI_VERSION

# The base image is CentOS 9 Stream and defaults to UID 1001 with
# HOME=/opt/app-root/src. Stay root for the whole image and reset HOME so the
# Pochi installer writes to /root.
USER 0
ENV HOME=/root

# git, wget and curl already ship with the base image; only ripgrep is missing.
RUN dnf config-manager --set-enabled crb && \
    dnf install -y https://dl.fedoraproject.org/pub/epel/epel-release-latest-9.noarch.rpm && \
    dnf install -y --nodocs --setopt=install_weak_deps=False ripgrep && \
    dnf clean all && \
    rm -rf /var/cache/dnf && \
    curl -fsSL https://getpochi.com/install.sh | bash -s ${POCHI_VERSION} && \
    ln -s /root/.pochi/bin/pochi /usr/local/bin/pochi && \
    python -m pip install --no-cache-dir pytest pytest-json-ctrf && \
    ([ -e /usr/local/bin/python ] || ln -s "$(command -v python3)" /usr/local/bin/python)

# Point the library at the pre-baked weights so every pipeline stays offline.
ENV DOCLING_ARTIFACTS_PATH="/opt/app-root/src/.cache/docling/models"

# Harbor only persists agent-authored files under /home/user.
RUN mkdir -p /home/user/fixpoint/corpus/notes && chmod -R 0755 /home/user

# Build-time corpus fixtures (no conversion, no assertions at build time).
RUN cat > /tmp/gen_corpus.py <<'PYEOF'
from pathlib import Path

CORPUS = Path("/home/user/fixpoint/corpus")
CORPUS.mkdir(parents=True, exist_ok=True)
(CORPUS / "notes").mkdir(parents=True, exist_ok=True)


def write(relative, text, newline="\n"):
    path = CORPUS / relative
    with open(path, "w", encoding="utf-8", newline=newline) as handle:
        handle.write(text)


write(
    "nested_lists.md",
    "# Nested Lists\n"
    "\n"
    "Intro paragraph before the lists.\n"
    "\n"
    "- Alpha\n"
    "  - Alpha one\n"
    "    - Alpha one deep\n"
    "  - Alpha two\n"
    "- Beta\n"
    "- Gamma\n"
    "\n"
    "1. First\n"
    "2. Second\n"
    "   1. Second nested\n"
    "   2. Second nested again\n"
    "3. Third\n"
    "\n"
    "## Sub section\n"
    "\n"
    "- single item list\n"
    "\n"
    "Closing paragraph.\n",
)

write(
    "alignment_table.md",
    "# Alignment Table\n"
    "\n"
    "| Left | Center | Right |\n"
    "| :--- | :---: | ---: |\n"
    "| `code` | **bold** | *italic* |\n"
    "| plain | a / b | 12.50 |\n"
    "| multi word cell | ~~struck~~ | [link](https://example.invalid) |\n"
    "\n"
    "Second table without an alignment row:\n"
    "\n"
    "| K | V |\n"
    "| --- | --- |\n"
    "| one | 1 |\n"
    "| two | 2 |\n"
    "\n"
    "Trailing paragraph after the tables.\n",
)

write(
    "fenced_code.md",
    "# Fenced Code\n"
    "\n"
    "Python block:\n"
    "\n"
    "```python\n"
    "def compute(values):\n"
    "    total = 0\n"
    "    for value in values:\n"
    "        total += value\n"
    "\n"
    "    return total\n"
    "```\n"
    "\n"
    "Shell block:\n"
    "\n"
    "```bash\n"
    "set -eu\n"
    "echo \"hello   world\"\n"
    "```\n"
    "\n"
    "Block without a language:\n"
    "\n"
    "```\n"
    "raw text\n"
    "  indented line\n"
    "```\n"
    "\n"
    "Inline `code span` inside a sentence.\n",
)

write(
    "quotes_media.md",
    "# Quotes and Media\n"
    "\n"
    "> Level one quote.\n"
    ">\n"
    "> > Level two quote with **bold**.\n"
    "\n"
    "Regular paragraph between the quotes.\n"
    "\n"
    "![Sensor diagram caption](assets/diagram.png)\n"
    "\n"
    "Another paragraph mentioning [the docs](https://example.invalid/docs).\n"
    "\n"
    "> Final quote.\n",
)

write(
    "unicode_emoji.md",
    "# Unicode and Emoji \u2728\n"
    "\n"
    "Accents: caf\u00e9, na\u00efve, Gr\u00fc\u00dfe, A\u00f1ejo.\n"
    "\n"
    "Combining versus composed: cafe\u0301 and caf\u00e9.\n"
    "\n"
    "CJK: \u6587\u6863\u8f6c\u6362\u5668 \u30fb \u65e5\u672c\u8a9e\u30c6\u30ad\u30b9\u30c8 \u30fb \ud55c\uad6d\uc5b4 \ubb38\uc11c\n"
    "\n"
    "Symbols: \u2192 \u2248 \u2211 \u00b1 \u00be \u2014 \u201ccurly quotes\u201d \u2026\n"
    "\n"
    "Emoji: \U0001f9ea \U0001f680 \U0001f1ef\U0001f1f5\n"
    "\n"
    "A line with a no-break\u00a0space between\u00a0words.\n"
    "\n"
    "| Zone | Label |\n"
    "| --- | --- |\n"
    "| CJK | \u8868\u683c |\n"
    "| Emoji | \U0001f9ea |\n",
)

write(
    "ragged_whitespace.md",
    "# Ragged   Whitespace\r\n"
    "\r\n"
    "Line with trailing spaces.   \r\n"
    "\r\n"
    "\tTab indented line follows the blank runs.\r\n"
    "\r\n"
    "\r\n"
    "\r\n"
    "Paragraph   with    interior    gaps.\r\n"
    "\r\n"
    "-   item with a wide bullet gap\r\n"
    "-\titem after a tab\r\n"
    "\r\n"
    "## Section   with   gaps\r\n"
    "\r\n"
    "Final paragraph.   \r\n",
    newline="",
)

write(
    "fragment_page.html",
    "<!DOCTYPE html>\n"
    "<html>\n"
    "<head><meta charset=\"utf-8\"><title>Fragment Page</title></head>\n"
    "<body>\n"
    "<h1>Fragment Page</h1>\n"
    "<p>Paragraph with <strong>bold</strong>, <em>italic</em> and <code>inline code</code>.</p>\n"
    "<h2>Nested lists</h2>\n"
    "<ul>\n"
    "  <li>outer one\n"
    "    <ul><li>inner one</li><li>inner two</li></ul>\n"
    "  </li>\n"
    "  <li>outer two</li>\n"
    "</ul>\n"
    "<ol><li>step one</li><li>step two</li></ol>\n"
    "<h2>Table</h2>\n"
    "<table>\n"
    "  <thead><tr><th>Name</th><th>Count</th><th>Note</th></tr></thead>\n"
    "  <tbody>\n"
    "    <tr><td>alpha</td><td>1</td><td>ok</td></tr>\n"
    "    <tr><td>beta</td><td>22</td><td>fine</td></tr>\n"
    "  </tbody>\n"
    "</table>\n"
    "<h2>Code and quotes</h2>\n"
    "<pre><code>echo \"hello\"\n"
    "exit 0\n"
    "</code></pre>\n"
    "<blockquote><p>Quoted paragraph with a <a href=\"https://example.invalid\">link</a>.</p></blockquote>\n"
    "<figure><img src=\"assets/figure.png\" alt=\"Figure\"><figcaption>Figure 1. Caption text.</figcaption></figure>\n"
    "</body>\n"
    "</html>\n",
)

write(
    "README.txt",
    "This directory holds the audit corpus.\n"
    "Only files with a .md or .html extension are eligible sources.\n",
)

write(
    "notes/ignored.md",
    "# Ignored\n"
    "\n"
    "This file is nested one level deep and must never be audited.\n",
)
PYEOF

RUN python3 /tmp/gen_corpus.py && rm -f /tmp/gen_corpus.py && chmod -R 0755 /home/user/fixpoint

WORKDIR /home/user/fixpoint

LABEL Author="generate-harbor-tasks"
LABEL Description="Docling CPU environment with a pathological local document corpus for a roundtrip fixpoint stability auditor."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - base image ghcr.io/docling-project/docling-serve-cpu:latest (CentOS 9 Stream,
#     Python 3.12 venv at /opt/app-root with docling, docling-core and all default
#     model weights pre-baked; fully offline)
#   - dnf packages: ripgrep (git, wget and curl already ship with the base image)
#   - pip packages: pytest, pytest-json-ctrf
#   - Pochi CLI symlinked at /usr/local/bin/pochi
#   - DOCLING_ARTIFACTS_PATH pointing at the pre-baked model cache
#   - /home/user/fixpoint: project directory (agent writes audit.py here)
#   - /home/user/fixpoint/corpus: 7 eligible source documents
#     (alignment_table.md, fenced_code.md, fragment_page.html, nested_lists.md,
#      quotes_media.md, ragged_whitespace.md, unicode_emoji.md) plus the
#      deliberately ignorable README.txt and notes/ignored.md

COPY test_initial_state.py /bootstrap/test_initial_state.py

# Setup entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
