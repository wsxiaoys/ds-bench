# Build FROM the official CPU image: torch, docling, docling-serve and ALL
# default model weights are already baked in, so the build performs NO
# downloads/conversions and cannot hit HuggingFace/PyTorch timeouts.
FROM ghcr.io/docling-project/docling-serve-cpu:latest

ARG POCHI_VERSION

# --- System deps: CentOS 9 Stream uses dnf, not apt-get ---
# Stay as root (UID 0) for the whole image so the harness, Pochi CLI, pytest,
# and the agent all have unrestricted access.
USER 0
# MUST set HOME=/root explicitly: switching USER does not reset HOME, and the
# base image's inherited HOME=/opt/app-root/src would otherwise cause the
# Pochi installer below to write into /opt/app-root/src instead of /root.
ENV HOME=/root
# NOTE: git, wget and curl already ship in the base image; do not reinstall
# them (curl would conflict with curl-minimal on CentOS 9 Stream).
RUN dnf config-manager --set-enabled crb \
    && dnf install -y https://dl.fedoraproject.org/pub/epel/epel-release-latest-9.noarch.rpm \
    && dnf install -y --nodocs --setopt=install_weak_deps=False ripgrep \
    && dnf clean all \
    && rm -rf /var/cache/dnf \
    && curl -fsSL https://getpochi.com/install.sh | bash -s ${POCHI_VERSION} \
    && ln -s /root/.pochi/bin/pochi /usr/local/bin/pochi \
    && python -m pip install --no-cache-dir pytest pytest-json-ctrf reportlab pillow

# --- Runtime configuration: point the docling library at the pre-baked models
# so the pipeline runs fully offline. Absolute path inherent to the base image.
ENV DOCLING_ARTIFACTS_PATH="/opt/app-root/src/.cache/docling/models"

# --- Harbor project directory (CRITICAL: under /home/user, NOT /opt/app-root/src) ---
RUN mkdir -p /home/user/project/assets && chmod -R 0755 /home/user

# --- Build-time fixture generator (NO docling conversion, NO asserts) ---
# Writes a 4-page US-Letter PDF at /home/user/project/assets/report.pdf whose
# figures are solid-colored (so tests can identify each figure from its crop)
# and whose figures/tables each carry a uniquely-coded caption directly below.
RUN cat > /tmp/gen_fixture.py <<'PYEOF'
import os
from PIL import Image, ImageDraw
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from reportlab.lib import colors
from reportlab.platypus import Table, TableStyle

PROJECT = "/home/user/project"
ASSETS = os.path.join(PROJECT, "assets")
os.makedirs(ASSETS, exist_ok=True)

FIG_COLORS = {
    "figA": (200, 30, 30),
    "figB": (30, 160, 60),
    "figC": (40, 80, 200),
    "figD": (230, 160, 20),
}

def make_fig(path, rgb):
    im = Image.new("RGB", (600, 300), rgb)
    d = ImageDraw.Draw(im)
    border = tuple(max(0, ch - 60) for ch in rgb)
    d.rectangle([0, 0, 599, 299], outline=border, width=6)
    im.save(path, "PNG")

paths = {}
for name, rgb in FIG_COLORS.items():
    p = os.path.join("/tmp", "seed_" + name + ".png")
    make_fig(p, rgb)
    paths[name] = p

PAGE_W, PAGE_H = letter  # 612.0, 792.0
c = canvas.Canvas(os.path.join(ASSETS, "report.pdf"), pagesize=letter)

def caption(x, y, text):
    c.setFont("Helvetica", 11)
    c.drawString(x, y, text)

def table(x, y, header, rows):
    data = [header] + rows
    t = Table(data, colWidths=[130, 130, 130])
    t.setStyle(TableStyle([
        ("GRID", (0, 0), (-1, -1), 1, colors.black),
        ("BACKGROUND", (0, 0), (-1, 0), colors.lightgrey),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    t.wrapOn(c, PAGE_W, PAGE_H)
    t.drawOn(c, x, y)

# Page 1: text only
c.setFont("Helvetica-Bold", 20)
c.drawString(72, 720, "Quarterly Systems Report")
c.setFont("Helvetica", 12)
yy = 680
for line in [
    "This report summarizes systems performance for the quarter.",
    "It contains several figures and tables on the following pages.",
    "Each figure and table is accompanied by a descriptive caption.",
    "The captions appear immediately below the element they describe.",
]:
    c.drawString(72, yy, line)
    yy -= 20
c.showPage()

# Page 2: two figures, each with its caption beneath it
c.drawImage(paths["figA"], 156, 560, width=300, height=150)
caption(156, 544, "Figure 1: Regional revenue distribution [FIGCODE-RA1]")
c.drawImage(paths["figB"], 156, 360, width=300, height=150)
caption(156, 344, "Figure 2: Latency percentile curves [FIGCODE-LB2]")
c.showPage()

# Page 3: one figure then one table (each with caption beneath)
c.drawImage(paths["figC"], 156, 560, width=300, height=150)
caption(156, 544, "Figure 3: Memory footprint over time [FIGCODE-MC3]")
table(111, 360, ["Endpoint", "RPS", "p99 ms"],
      [["/login", "1200", "48"], ["/search", "3400", "72"], ["/checkout", "800", "95"]])
caption(111, 344, "Table 1: Endpoint throughput summary [TBLCODE-TT1]")
c.showPage()

# Page 4: one figure then one table (each with caption beneath)
c.drawImage(paths["figD"], 156, 560, width=300, height=150)
caption(156, 544, "Figure 4: Cache hit ratio by tier [FIGCODE-HD4]")
table(111, 360, ["Service", "Budget", "Used"],
      [["api", "0.1%", "0.04%"], ["web", "0.2%", "0.09%"], ["batch", "0.5%", "0.30%"]])
caption(111, 344, "Table 2: Error budget allocation [TBLCODE-EB2]")
c.showPage()

c.save()
print("fixture written:", os.path.join(ASSETS, "report.pdf"))
PYEOF

RUN python /tmp/gen_fixture.py && rm -f /tmp/gen_fixture.py

WORKDIR /home/user/project

LABEL Author="generate-harbor-tasks"
LABEL Description="Offline Docling (v2.107.0) CPU environment with a pre-baked 4-page PDF fixture for figure/table provenance, bounding-box crop, and caption cross-referencing."

# NOTE: main.py is authored by the agent at solve time. Do not COPY it in and
# do not add a CMD that runs it. Standard Harbor ending below.
CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - Base: ghcr.io/docling-project/docling-serve-cpu:latest (CentOS 9 Stream,
#     Python 3.12 venv on PATH, torch + docling v2.107.0 + all default model
#     weights pre-baked at /opt/app-root/src/.cache/docling/models).
#   - dnf packages: ripgrep (+ EPEL/CRB enabled).
#   - pip packages: pytest, pytest-json-ctrf, reportlab, pillow.
#   - Pochi CLI installed to /root/.pochi and symlinked to /usr/local/bin/pochi.
#   - DOCLING_ARTIFACTS_PATH pinned to the pre-baked model cache (fully offline).
#   - /home/user/project: Harbor project directory (agent authors main.py here).
#   - /home/user/project/assets/report.pdf: build-time 4-page PDF fixture.

COPY test_initial_state.py /bootstrap/test_initial_state.py

# Setup entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
