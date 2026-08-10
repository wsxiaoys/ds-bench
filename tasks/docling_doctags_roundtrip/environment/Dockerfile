# Build FROM the official Docling CPU image: torch, docling, docling-serve and
# ALL default model weights are already baked in — the build does NO downloads,
# so it will not hit HuggingFace/PyTorch timeouts, and the pipeline runs fully
# offline at solve/verify time.
FROM ghcr.io/docling-project/docling-serve-cpu:latest

ARG POCHI_VERSION

# --- System deps: CentOS 9 Stream uses dnf, not apt-get ---
# Stay as root (UID 0) for the whole image so the harness, Pochi CLI, pytest,
# and the agent all have unrestricted access.
USER 0
# MUST set HOME=/root explicitly — switching USER does not change HOME, and the
# base image's inherited HOME=/opt/app-root/src would otherwise cause the
# Pochi installer below to write into /opt/app-root/src instead of /root.
ENV HOME=/root
# NOTE: git, wget, and curl are already present in the base image — do not
# re-install them here.
RUN dnf config-manager --set-enabled crb \
    && dnf install -y https://dl.fedoraproject.org/pub/epel/epel-release-latest-9.noarch.rpm \
    && dnf install -y --nodocs --setopt=install_weak_deps=False ripgrep \
    && dnf clean all \
    && rm -rf /var/cache/dnf \
    && curl -fsSL https://getpochi.com/install.sh | bash -s ${POCHI_VERSION} \
    && ln -s /root/.pochi/bin/pochi /usr/local/bin/pochi \
    && python -m pip install --no-cache-dir pytest pytest-json-ctrf reportlab

# --- Runtime configuration ---
# Point the docling *library* at the pre-baked models so the pipeline runs fully
# offline. Absolute path inherent to the base image. DOCLING_SERVE_ARTIFACTS_PATH,
# TESSDATA_PREFIX and OMP_NUM_THREADS are already set by the base image.
ENV DOCLING_ARTIFACTS_PATH="/opt/app-root/src/.cache/docling/models"

# --- Harbor project directory (CRITICAL — never /opt/app-root/src) ---
RUN mkdir -p /home/user && chmod 0755 /home/user
RUN mkdir -p /home/user/project/assets && chmod -R 0755 /home/user/project

# --- Build-time fixture generation (reportlab/PIL only; NO docling conversion,
#     NO assertions — a pure, side-effect-only PDF writer so the build cannot
#     fail on model-dependent detection). Writes /home/user/project/assets/report.pdf
#     containing a title, section headings (incl. a nested subsection), body
#     paragraphs, one bordered multi-row/multi-column table, and one embedded
#     figure with a caption. ---
RUN python - <<'PY'
import os
from io import BytesIO

from PIL import Image as PILImage, ImageDraw
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    Image,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

os.makedirs("/home/user/project/assets", exist_ok=True)

# Build an embedded raster figure (a simple bar chart) so layout analysis has a
# clear picture region to detect.
fig = PILImage.new("RGB", (480, 260), "white")
draw = ImageDraw.Draw(fig)
draw.rectangle([10, 10, 470, 250], outline="black", width=2)
bars = [(60, 1200, "#d9534f"), (160, 1500, "#5cb85c"),
        (260, 900, "#0275d8"), (360, 1600, "#f0ad4e")]
for x, val, col in bars:
    h = int(val / 1600.0 * 180)
    draw.rectangle([x, 230 - h, x + 60, 230], fill=col, outline="black")
buf = BytesIO()
fig.save(buf, format="PNG")
buf.seek(0)

styles = getSampleStyleSheet()
title_style = ParagraphStyle("DocTitle", parent=styles["Title"], fontSize=24, alignment=TA_CENTER)
h1 = ParagraphStyle("H1", parent=styles["Heading1"], fontSize=16, spaceBefore=12, spaceAfter=8)
h2 = ParagraphStyle("H2", parent=styles["Heading2"], fontSize=13, spaceBefore=8, spaceAfter=6)
body = styles["BodyText"]
cap = ParagraphStyle("Cap", parent=styles["Italic"], fontSize=9, alignment=TA_CENTER)

story = []
story.append(Paragraph("Quarterly Financial Overview", title_style))
story.append(Spacer(1, 12))
story.append(Paragraph(
    "This report summarizes regional revenue performance across the first two "
    "quarters of the fiscal year and documents the methodology used to compile it.",
    body,
))
story.append(Paragraph("Regional Revenue", h1))
story.append(Paragraph("The table below lists quarterly revenue by region, in thousands of dollars.", body))
story.append(Spacer(1, 8))
data = [
    ["Region", "Q1 Revenue", "Q2 Revenue"],
    ["North", "1200", "1500"],
    ["South", "900", "1100"],
    ["East", "700", "850"],
    ["West", "1300", "1600"],
]
tbl = Table(data, colWidths=[1.7 * inch, 1.7 * inch, 1.7 * inch])
tbl.setStyle(TableStyle([
    ("GRID", (0, 0), (-1, -1), 1, colors.black),
    ("BACKGROUND", (0, 0), (-1, 0), colors.lightgrey),
    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
    ("ALIGN", (1, 1), (-1, -1), "RIGHT"),
    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ("TOPPADDING", (0, 0), (-1, -1), 6),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
]))
story.append(tbl)
story.append(Spacer(1, 16))
story.append(Paragraph("Methodology", h1))
story.append(Paragraph("We aggregated figures from regional ledgers and reconciled them against bank statements.", body))
story.append(Paragraph("Data Sources", h2))
story.append(Paragraph("Ledgers were exported monthly from the accounting system and validated by the finance team.", body))
story.append(Spacer(1, 16))
story.append(Image(buf, width=4.0 * inch, height=2.166 * inch))
story.append(Paragraph("Figure 1: Revenue Trend", cap))

doc = SimpleDocTemplate("/home/user/project/assets/report.pdf", pagesize=LETTER)
doc.build(story)
print("fixture written:", os.path.getsize("/home/user/project/assets/report.pdf"), "bytes")
PY

WORKDIR /home/user/project
# NOTE: main.py is authored by the agent at solve time — do not COPY it in and
# do not add a CMD that runs it.

LABEL Author="generate-harbor-tasks"
LABEL Description="Docling DocTags round-trip pipeline task: offline docling-serve-cpu base with a pre-baked fixture PDF (headings, table, figure) at /home/user/project/assets/report.pdf."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - base image: ghcr.io/docling-project/docling-serve-cpu:latest (CentOS 9
#     Stream, Python 3.12, docling v2.107.0 + all default model weights baked in)
#   - extra dnf packages: ripgrep (+ EPEL/crb enabled)
#   - extra pip packages: pytest, pytest-json-ctrf, reportlab (build-time fixture)
#   - Pochi CLI installed and symlinked to /usr/local/bin/pochi
#   - DOCLING_ARTIFACTS_PATH points the docling library at the pre-baked offline models
#   - /home/user/project: Harbor project directory (WORKDIR)
#   - /home/user/project/assets/report.pdf: pre-generated fixture PDF
#   - agent authors /home/user/project/main.py and produces out/ artifacts at solve time

COPY test_initial_state.py /bootstrap/test_initial_state.py

# Setup entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
