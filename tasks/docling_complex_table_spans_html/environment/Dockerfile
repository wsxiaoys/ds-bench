# Build FROM the official CPU image: torch, docling, docling-serve and ALL
# default model weights (layout, tableformer, ...) are already baked in — the
# build does NO model/PyTorch downloads, so it will not hit HuggingFace/PyTorch
# timeouts and needs no build-time warmup.
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
    && python -m pip install --no-cache-dir pytest pytest-json-ctrf reportlab

# --- Runtime configuration ---
# Point the docling library at the pre-baked models so the pipeline runs fully
# offline. Absolute path inherent to the base image, independent of the project
# location. DOCLING_SERVE_ARTIFACTS_PATH / TESSDATA_PREFIX / OMP_NUM_THREADS are
# already set by the base image.
ENV DOCLING_ARTIFACTS_PATH="/opt/app-root/src/.cache/docling/models"

# --- Harbor project directory (CRITICAL — do NOT use /opt/app-root/src) ---
# The harness only persists agent-authored files under /home/user, so the
# project must live there, not at the base image's own HOME/WORKDIR.
RUN mkdir -p /home/user && chmod 0755 /home/user
RUN mkdir -p /home/user/project/assets && chmod -R 0755 /home/user/project

# --- Build-time input fixture ---------------------------------------------
# Draw a single COMPLEX ruled table (row- and column-spanning header cells plus
# a numeric body) into a programmatic PDF with reportlab. This is pure drawing:
# NO docling conversion or assertions run at build time.
RUN cat >/tmp/gen_fixture.py <<'PYEOF'
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle

# reportlab cell coordinates are (col, row); "" marks positions covered by a span.
data = [
    ["Region", "Sales", "", ""],
    ["", "Q1", "Q2", "Q3"],
    ["North", "10", "20", "30"],
    ["South", "40", "50", "60"],
    ["East", "70", "80", "90"],
]

table = Table(
    data,
    colWidths=[1.4 * inch, 1.4 * inch, 1.4 * inch, 1.4 * inch],
    rowHeights=[0.55 * inch] * 5,
)
table.setStyle(
    TableStyle(
        [
            ("SPAN", (0, 0), (0, 1)),   # "Region" spans two rows in column 0
            ("SPAN", (1, 0), (3, 0)),   # "Sales" spans three columns in row 0
            ("GRID", (0, 0), (-1, -1), 1, colors.black),
            ("BOX", (0, 0), (-1, -1), 1.5, colors.black),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("FONTNAME", (0, 0), (-1, -1), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 13),
            ("BACKGROUND", (0, 0), (-1, 1), colors.whitesmoke),
        ]
    )
)

doc = SimpleDocTemplate(
    "/home/user/project/assets/complex_table.pdf", pagesize=letter
)
doc.build([table])
PYEOF
RUN python /tmp/gen_fixture.py && rm -f /tmp/gen_fixture.py

WORKDIR /home/user/project
# NOTE: main.py is authored by the agent at solve time — do not COPY it in and
# do not add a `CMD ["python", "main.py"]`.

LABEL Author="generate-harbor-tasks"
LABEL Description="Docling v2.107.0 (docling-serve-cpu base, offline TableFormer) task: reconstruct a complex spanning-cell table to normalized HTML + a JSON grid model, with a build-time reportlab PDF fixture at /home/user/project/assets/complex_table.pdf."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - base image: ghcr.io/docling-project/docling-serve-cpu:latest (CentOS 9
#     Stream, Python 3.12, docling v2.107.0 + all model weights pre-baked)
#   - extra dnf packages: ripgrep (via crb + EPEL)
#   - extra pip packages: pytest, pytest-json-ctrf, reportlab (build-time fixture only)
#   - Pochi CLI installed and symlinked to /usr/local/bin/pochi
#   - DOCLING_ARTIFACTS_PATH points docling at the pre-baked offline models
#   - /home/user/project: Harbor project directory (WORKDIR)
#   - /home/user/project/assets/complex_table.pdf: build-time complex-table PDF fixture

COPY test_initial_state.py /bootstrap/test_initial_state.py

# Setup entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
