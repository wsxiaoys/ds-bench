# syntax=docker/dockerfile:1
# Build FROM the official Docling CPU image: torch, docling, docling-serve and
# ALL default model weights are already baked in, so the build performs NO
# model/PyTorch downloads and the pipeline can run fully offline at solve time.
FROM ghcr.io/docling-project/docling-serve-cpu:latest

ARG POCHI_VERSION

# Stay as root (UID 0) for the whole image so the harness, Pochi CLI, pytest and
# the agent all have unrestricted access.
USER 0
# MUST reset HOME explicitly: switching USER does not change HOME, and the base
# image's inherited HOME=/opt/app-root/src would otherwise make the Pochi/uv
# installers write into the wrong place and break the /root symlinks below.
ENV HOME=/root

# --- System deps + tooling (CentOS 9 Stream uses dnf, not apt-get) ---
# git, wget and curl already ship in the base image; only add what is missing.
RUN dnf config-manager --set-enabled crb \
    && dnf install -y https://dl.fedoraproject.org/pub/epel/epel-release-latest-9.noarch.rpm \
    && dnf install -y --nodocs --setopt=install_weak_deps=False \
        ripgrep \
    && dnf clean all \
    && rm -rf /var/cache/dnf \
    && curl -fsSL https://getpochi.com/install.sh | bash -s ${POCHI_VERSION} \
    && ln -s /root/.pochi/bin/pochi /usr/local/bin/pochi \
    && python -m pip install --no-cache-dir pytest pytest-json-ctrf fpdf2

# --- Runtime configuration: point the docling library at the pre-baked models
# so the pipeline runs fully offline. Absolute path inherent to the base image. ---
ENV DOCLING_ARTIFACTS_PATH="/opt/app-root/src/.cache/docling/models"

# --- Harbor project directory (CRITICAL — must live under /home/user) ---
RUN mkdir -p /home/user/project/assets && chmod -R 0755 /home/user

# --- Build-time input fixture generator (NOT a document conversion) ---
# Generates a multi-section PDF with nested headings (H1>H2>H3) and a table,
# containing deterministic marker tokens the final-state test relies on.
RUN cat > /tmp/gen_fixture.py <<'PYEOF'
from fpdf import FPDF

TITLE = "Quarterly Operations Report"

pdf = FPDF(format="A4")
pdf.set_auto_page_break(auto=True, margin=18)
pdf.set_margins(20, 20, 20)
pdf.add_page()


def heading(text, size):
    pdf.set_font("Helvetica", "B", size)
    pdf.multi_cell(0, size * 0.55, text)
    pdf.ln(3)


def body(text, size=10):
    pdf.set_font("Helvetica", "", size)
    pdf.multi_cell(0, 5.5, text)
    pdf.ln(3)


# --- Page 1: nested Title > H1 > H2 > H3 ending in the marker paragraph ---
heading(TITLE, 30)
body(
    "This report summarizes quarterly operations across all business units. "
    "It is organized into nested sections covering finance and operations."
)
heading("Financial Overview", 23)
body("The financial overview consolidates revenue, cost, and margin trends for the quarter.")
heading("Regional Performance", 17)
body("Regional performance is broken down by district to highlight local variation.")
heading("Northwest District Analysis", 14)
body(
    "The Northwest district exceeded its revenue target for the third consecutive quarter. "
    "Internal audit reference ZQPLUMBAGO-7731 confirms the reconciliation of all ledger "
    "entries for this district, and no material discrepancies were identified during review."
)

# --- Page 2: a second H1 section containing a bordered table ---
pdf.add_page()
heading("Operational Metrics", 23)
body("Operational metrics track throughput and key performance indicators per district.")
body("The following table lists selected district metric codes recorded during the quarter.")

pdf.set_font("Helvetica", "B", 10)
headers = ["District", "Metric Code", "Value"]
widths = [55, 65, 35]
for h, w in zip(headers, widths):
    pdf.cell(w, 8, h, border=1)
pdf.ln()

pdf.set_font("Helvetica", "", 10)
rows = [
    ["Northwest", "TBLQUOKKA-4402", "128"],
    ["Southeast", "KPI-2201", "342"],
    ["Midwest", "KPI-3310", "205"],
]
for row in rows:
    for c, w in zip(row, widths):
        pdf.cell(w, 8, c, border=1)
    pdf.ln()

pdf.output("/home/user/project/assets/report.pdf")
print("fixture written")
PYEOF

RUN python /tmp/gen_fixture.py && test -s /home/user/project/assets/report.pdf

WORKDIR /home/user/project

LABEL Author="generate-harbor-tasks"
LABEL Description="Docling (v2.107.0) offline environment with a pre-baked multi-section PDF fixture for a structure-aware hierarchical RAG chunking task."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - Base: ghcr.io/docling-project/docling-serve-cpu:latest (CentOS 9 Stream,
#     Python 3.12, docling v2.107.0 + all default model weights pre-baked)
#   - dnf packages added: ripgrep (+ EPEL/CRB enabled)
#   - pip packages added: pytest, pytest-json-ctrf, fpdf2
#   - Pochi CLI installed and symlinked to /usr/local/bin/pochi
#   - DOCLING_ARTIFACTS_PATH points at the pre-baked offline model cache
#   - /home/user/project: task project directory (WORKDIR)
#   - /home/user/project/assets/report.pdf: generated multi-section PDF fixture
#     (nested H1>H2>H3 headings + a table; markers ZQPLUMBAGO-7731, TBLQUOKKA-4402)

COPY test_initial_state.py /bootstrap/test_initial_state.py

# Setup entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
