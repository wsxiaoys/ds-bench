# Build FROM the official Docling CPU image: torch, docling, docling-serve and ALL
# default model weights are already baked in, so the build performs no model or
# PyTorch downloads and the container runs fully offline.
FROM ghcr.io/docling-project/docling-serve-cpu:latest

ARG POCHI_VERSION

# The base image is CentOS 9 Stream (dnf, not apt-get) and defaults to UID 1001
# with HOME=/opt/app-root/src. Stay root for the whole image and reset HOME so
# the Pochi installer writes to /root.
USER 0
ENV HOME=/root

# git, wget and curl already ship with the base image; only ripgrep is missing.
RUN dnf config-manager --set-enabled crb \
    && dnf install -y https://dl.fedoraproject.org/pub/epel/epel-release-latest-9.noarch.rpm \
    && dnf install -y --nodocs --setopt=install_weak_deps=False ripgrep \
    && dnf clean all \
    && rm -rf /var/cache/dnf \
    && curl -fsSL https://getpochi.com/install.sh | bash -s ${POCHI_VERSION} \
    && ln -s /root/.pochi/bin/pochi /usr/local/bin/pochi \
    && python -m pip install --no-cache-dir pytest pytest-json-ctrf

# Point the docling library at the pre-baked model cache of the base image so
# every pipeline runs without network access.
ENV DOCLING_ARTIFACTS_PATH="/opt/app-root/src/.cache/docling/models"

# Harbor project directory: agent-authored files are only persisted below
# /home/user, never below the base image's own /opt/app-root/src.
RUN mkdir -p /home/user/project && chmod -R 0755 /home/user

# Fixture generator for the RCP/Markdown corpus (build-time only, no conversion
# and no assertions are executed during the build).
RUN cat >/tmp/gen_corpus.py <<'PYEOF'
import sys
from pathlib import Path

ALPHA = """%RCP/1.0
id=alpha-run
title=Cold Brew Concentrate
author=Q. Rivera
revision=3
%%
S1> Ingredients
P> Use coarsely ground coffee and filtered water at room temperature.
B> 120 g coarse coffee
B> 1000 ml filtered water
| Component | Amount | Note
| Coffee | 120 g | coarse grind
| Water | 1000 ml | filtered
| Ice | 400 g | optional
S2> Substitutions
P> Decaf beans work with the same ratio.
A> Chicory changes the extraction time.
S1> Method
N> Combine coffee and water in a 2 litre jar.
N> Steep for 16 hours at room temperature.
N> Filter twice through a paper cone.
F> figures/steep-jar.png :: Steeping jar after 16 hours
S3> Timing Notes
P> Longer steeping increases bitterness.
"""

BRAVO = """%RCP/1.0
id=bravo-log
title=Fermentation Log
%%
S1> Week One
P> Bubbles appear on day two.
| Day | pH
| 1 | 5.8
| 2 | 4.9
S1> Week Two
P> Aroma turns sour and clean.
N> Refresh the starter each morning.
N> Discard half of the mass.
A> Temperature stayed near 21 C.
"""

README_MD = """# Release Notes

Short markdown document used as a native input.

## Highlights

- faster parsing
- fewer allocations

| Metric | Value |
| --- | --- |
| speed | 1.4x |
| memory | 0.8x |
"""

BAD_MAGIC = """%RCP/2.0
id=bad-magic
title=Wrong Magic
%%
P> This file must be rejected.
"""

NO_TERMINATOR = """%RCP/1.0
id=no-terminator
title=Header Never Ends
P> This file must be rejected.
"""

MISSING_TITLE = """%RCP/1.0
id=missing-title
author=Nobody
%%
S1> Orphan
P> This file must be rejected.
"""

UNKNOWN_MARKER = """%RCP/1.0
id=unknown-marker
title=Bad Body Line
%%
S1> Fine
X> This marker does not exist.
"""

RAGGED_TABLE = """%RCP/1.0
id=ragged-table
title=Ragged Table
%%
S1> Data
| A | B | C
| 1 | 2
"""

DUP_KEY = """%RCP/1.0
id=dup-key
title=Duplicated Key
id=dup-key-again
%%
P> This file must be rejected.
"""

CSV_DOC = """name,qty
beans,2
water,5
"""

NOTES_TXT = """plain text file that is not part of the corpus
"""

FILES = {
    "clean/alpha.rcp": ALPHA,
    "clean/bravo.rcp": BRAVO,
    "clean/readme.md": README_MD,
    "mixed/alpha.rcp": ALPHA,
    "mixed/bravo.rcp": BRAVO,
    "mixed/readme.md": README_MD,
    "mixed/broken.rcp": UNKNOWN_MARKER,
    "mixed/notes.txt": NOTES_TXT,
    "mixed/inventory.csv": CSV_DOC,
    "mixed/nested/deep.rcp": ALPHA,
    "malformed/bad_magic.rcp": BAD_MAGIC,
    "malformed/no_terminator.rcp": NO_TERMINATOR,
    "malformed/missing_title.rcp": MISSING_TITLE,
    "malformed/unknown_marker.rcp": UNKNOWN_MARKER,
    "malformed/ragged_table.rcp": RAGGED_TABLE,
    "malformed/dup_key.rcp": DUP_KEY,
    "unsupported/inventory.csv": CSV_DOC,
}

base = Path(sys.argv[1])
for rel, content in FILES.items():
    target = base / rel
    target.parent.mkdir(parents=True, exist_ok=True)
    with open(target, "w", encoding="utf-8", newline="\n") as handle:
        handle.write(content)
print("wrote %d fixture files under %s" % (len(FILES), base))
PYEOF

RUN python /tmp/gen_corpus.py /home/user/project/corpus \
    && rm -f /tmp/gen_corpus.py \
    && chmod -R 0755 /home/user/project

WORKDIR /home/user/project

LABEL Author="generate-harbor-tasks"
LABEL Description="Offline Docling CPU environment with an RCP/Markdown fixture corpus under /home/user/project/corpus for building a custom Docling input-format backend."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - base image ghcr.io/docling-project/docling-serve-cpu:latest (CentOS 9 Stream,
#     Python 3.12, docling + docling-core + all default model weights, Tesseract)
#   - extra dnf package: ripgrep (git, wget, curl already present)
#   - pip packages: pytest, pytest-json-ctrf
#   - Pochi CLI symlinked at /usr/local/bin/pochi
#   - DOCLING_ARTIFACTS_PATH pointing at the pre-baked offline model cache
#   - /home/user/project: task project directory (working directory)
#   - /home/user/project/corpus/{clean,mixed,malformed,unsupported}: RCP and
#     Markdown fixtures generated at build time

COPY test_initial_state.py /bootstrap/test_initial_state.py

# Setup entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
