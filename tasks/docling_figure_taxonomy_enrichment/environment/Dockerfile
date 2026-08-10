# Build FROM the official Docling CPU image: torch, docling, docling-serve and
# ALL default model weights (layout, tableformer, picture_classifier, rapidocr,
# easyocr) are already baked in, so the build performs NO model downloads and the
# pipeline runs fully offline. See plan.md for the mandatory base-image rules.
FROM ghcr.io/docling-project/docling-serve-cpu:latest

ARG POCHI_VERSION

# --- Stay root for the whole image (Harbor harness / Pochi / pytest need it) ---
USER 0
# MUST reset HOME=/root: switching USER does not change the inherited
# HOME=/opt/app-root/src, which would misdirect the Pochi installer / pip.
ENV HOME=/root

# --- System + Python tooling (CentOS 9 Stream uses dnf, not apt-get) ---
# git/wget/curl already ship in the base image; do NOT reinstall them.
# reportlab is added only to deterministically generate the build-time PDF
# fixture below (Pillow is already present via docling).
RUN dnf config-manager --set-enabled crb \
    && dnf install -y https://dl.fedoraproject.org/pub/epel/epel-release-latest-9.noarch.rpm \
    && dnf install -y --nodocs --setopt=install_weak_deps=False \
        tesseract-langpack-spa ripgrep \
    && dnf clean all \
    && rm -rf /var/cache/dnf \
    && curl -fsSL https://getpochi.com/install.sh | bash -s ${POCHI_VERSION} \
    && ln -s /root/.pochi/bin/pochi /usr/local/bin/pochi \
    && python -m pip install --no-cache-dir pytest pytest-json-ctrf reportlab

# --- Runtime configuration: point the docling *library* at the pre-baked models
# so conversion is fully offline. Absolute path inherent to the base image. ---
ENV DOCLING_ARTIFACTS_PATH="/opt/app-root/src/.cache/docling/models"

# --- Harbor project directory (CRITICAL: under /home/user, never /opt/app-root/src) ---
RUN mkdir -p /home/user/project/assets && chmod -R 0755 /home/user

# --- Deterministically generate the input PDF fixture at BUILD time ---
# The PDF embeds several distinct raster figures/charts plus a table and
# captions across multiple pages. This is plain PDF authoring (reportlab/Pillow)
# — NOT a docling conversion — so it is safe in a RUN layer.
RUN cat > /tmp/gen_fixture.py <<'PYEOF' \
    && python /tmp/gen_fixture.py \
    && rm -f /tmp/gen_fixture.py
import os
from PIL import Image, ImageDraw
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import (
    SimpleDocTemplate, Image as RLImage, Paragraph, Spacer,
    Table, TableStyle, PageBreak,
)

ASSETS = "/home/user/project/assets"
SRC = "/tmp/fig_src"
os.makedirs(ASSETS, exist_ok=True)
os.makedirs(SRC, exist_ok=True)


def _save(img, name):
    path = os.path.join(SRC, name)
    img.save(path, "PNG")
    return path


def bar_chart():
    W, H = 500, 340
    im = Image.new("RGB", (W, H), "white")
    d = ImageDraw.Draw(im)
    d.rectangle([0, 0, W - 1, H - 1], outline="black", width=2)
    vals = [70, 150, 95, 220, 130, 180]
    cols = ["#4e79a7", "#f28e2b", "#e15759", "#76b7b2", "#59a14f", "#edc948"]
    bw, gap, x = 58, 18, 46
    for v, c in zip(vals, cols):
        d.rectangle([x, H - 50 - v, x + bw, H - 50], fill=c, outline="black")
        x += bw + gap
    d.line([36, H - 50, W - 20, H - 50], fill="black", width=2)
    d.line([36, 24, 36, H - 50], fill="black", width=2)
    return _save(im, "bar.png")


def line_chart():
    W, H = 500, 340
    im = Image.new("RGB", (W, H), "white")
    d = ImageDraw.Draw(im)
    d.rectangle([0, 0, W - 1, H - 1], outline="black", width=2)
    pts = [(50, 260), (130, 180), (210, 210), (290, 120), (370, 150), (450, 70)]
    d.line([40, 290, W - 20, 290], fill="black", width=2)
    d.line([40, 24, 40, 290], fill="black", width=2)
    d.line(pts, fill="#e15759", width=3)
    for px, py in pts:
        d.ellipse([px - 5, py - 5, px + 5, py + 5], fill="#4e79a7", outline="black")
    return _save(im, "line.png")


def pie_chart():
    W, H = 420, 340
    im = Image.new("RGB", (W, H), "white")
    d = ImageDraw.Draw(im)
    box = [90, 40, 330, 280]
    slices = [(0, 120, "#4e79a7"), (120, 200, "#f28e2b"),
              (200, 300, "#59a14f"), (300, 360, "#e15759")]
    for start, end, col in slices:
        d.pieslice(box, start, end, fill=col, outline="black")
    return _save(im, "pie.png")


def scatter_plot():
    W, H = 500, 340
    im = Image.new("RGB", (W, H), "white")
    d = ImageDraw.Draw(im)
    d.rectangle([0, 0, W - 1, H - 1], outline="black", width=2)
    d.line([40, 300, W - 20, 300], fill="black", width=2)
    d.line([40, 24, 40, 300], fill="black", width=2)
    coords = [(70, 260), (110, 240), (150, 250), (200, 200), (240, 210),
              (280, 170), (320, 180), (360, 120), (400, 140), (440, 90),
              (130, 230), (300, 150), (210, 190), (350, 130)]
    for cx, cy in coords:
        d.ellipse([cx - 6, cy - 6, cx + 6, cy + 6], fill="#76b7b2", outline="black")
    return _save(im, "scatter.png")


styles = getSampleStyleSheet()
cap = styles["Italic"]
story = []
story.append(Paragraph("Quarterly Analytics Report", styles["Title"]))
story.append(Spacer(1, 12))
story.append(Paragraph("Section 1: Revenue Overview", styles["Heading2"]))
story.append(RLImage(bar_chart(), width=4.2 * inch, height=2.85 * inch))
story.append(Paragraph("Figure 1: Quarterly revenue by product line.", cap))
story.append(Spacer(1, 18))
story.append(RLImage(line_chart(), width=4.2 * inch, height=2.85 * inch))
story.append(Paragraph("Figure 2: Monthly active users trend over the period.", cap))
story.append(PageBreak())

story.append(Paragraph("Section 2: Distribution & Correlation", styles["Heading2"]))
table_data = [
    ["Region", "Q1", "Q2", "Q3", "Q4"],
    ["North", "120", "150", "170", "210"],
    ["South", "90", "110", "130", "160"],
    ["East", "60", "80", "95", "120"],
    ["West", "140", "160", "185", "205"],
]
tbl = Table(table_data, hAlign="LEFT")
tbl.setStyle(TableStyle([
    ("GRID", (0, 0), (-1, -1), 1, colors.black),
    ("BACKGROUND", (0, 0), (-1, 0), colors.lightgrey),
    ("FONTSIZE", (0, 0), (-1, -1), 10),
]))
story.append(tbl)
story.append(Paragraph("Table 1: Regional sales figures by quarter.", cap))
story.append(Spacer(1, 18))
story.append(RLImage(pie_chart(), width=3.4 * inch, height=2.75 * inch))
story.append(Paragraph("Figure 3: Market share distribution across segments.", cap))
story.append(PageBreak())

story.append(Paragraph("Section 3: Spend Efficiency", styles["Heading2"]))
story.append(RLImage(scatter_plot(), width=4.2 * inch, height=2.85 * inch))
story.append(Paragraph("Figure 4: Correlation between ad spend and conversions.", cap))

SimpleDocTemplate(
    os.path.join(ASSETS, "report.pdf"), pagesize=letter
).build(story)
print("Wrote", os.path.join(ASSETS, "report.pdf"))
PYEOF

WORKDIR /home/user/project

LABEL Author="generate-harbor-tasks"
LABEL Description="Offline Docling figure-taxonomy enrichment task: multi-page PDF fixture with charts/tables/captions, picture-classification models pre-baked."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - base image: ghcr.io/docling-project/docling-serve-cpu:latest (CentOS 9 Stream,
#     Python 3.12, torch + docling v2.107.0 + all default model weights pre-baked,
#     incl. layout, tableformer, picture_classifier, rapidocr, easyocr; Tesseract eng)
#   - dnf packages added: tesseract-langpack-spa, ripgrep, epel-release
#   - pip packages added: pytest, pytest-json-ctrf, reportlab (build-time fixture only)
#   - Pochi CLI installed and symlinked to /usr/local/bin/pochi
#   - DOCLING_ARTIFACTS_PATH -> pre-baked offline model cache
#   - /home/user/project: Harbor project directory (WORKDIR)
#   - /home/user/project/assets/report.pdf: deterministic multi-page PDF fixture
#     (embedded raster charts + a table + captions) generated at build time

COPY test_initial_state.py /bootstrap/test_initial_state.py

# Setup entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
