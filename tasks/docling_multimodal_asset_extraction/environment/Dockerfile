# Docling multimodal-asset-extraction task environment.
# Built FROM the official CPU image so torch, docling (v2.107.0) and ALL default
# model weights are already baked in -> the build performs NO model/PyTorch
# downloads and runs fully offline.
FROM ghcr.io/docling-project/docling-serve-cpu:latest

ARG POCHI_VERSION

# --- System deps: CentOS 9 Stream uses dnf, not apt-get ---
# Stay as root (UID 0) for the whole image so the harness, Pochi CLI, pytest and
# the agent all have unrestricted access.
USER 0
# MUST set HOME=/root explicitly: switching USER does not change HOME, and the
# base image's inherited HOME=/opt/app-root/src would otherwise misdirect the
# Pochi/uv installers.
ENV HOME=/root
# NOTE: git, wget and curl already ship in the base image -> do not reinstall them.
RUN dnf config-manager --set-enabled crb \
    && dnf install -y https://dl.fedoraproject.org/pub/epel/epel-release-latest-9.noarch.rpm \
    && dnf install -y --nodocs --setopt=install_weak_deps=False \
        ripgrep \
    && dnf clean all \
    && rm -rf /var/cache/dnf \
    && curl -fsSL https://getpochi.com/install.sh | bash -s ${POCHI_VERSION} \
    && ln -s /root/.pochi/bin/pochi /usr/local/bin/pochi \
    && python -m pip install --no-cache-dir pytest pytest-json-ctrf pillow reportlab

# --- Runtime configuration ---
# Point the docling *library* at the pre-baked models so the pipeline runs fully
# offline. DOCLING_SERVE_ARTIFACTS_PATH, TESSDATA_PREFIX and OMP_NUM_THREADS are
# already set by the base image.
ENV DOCLING_ARTIFACTS_PATH="/opt/app-root/src/.cache/docling/models"

# --- Harbor project directory (CRITICAL - do NOT use /opt/app-root/src) ---
RUN mkdir -p /home/user/project/assets && chmod -R 0755 /home/user

# --- Build-time input fixture generation ---
# Generate a deterministic 2-page US-Letter PDF fixture containing one clearly
# ruled data table and one embedded figure. This is NOT a docling conversion and
# performs NO assertions, so it cannot cause BUILD_FAILED.
RUN cat >/tmp/gen_fixture.py <<'PYEOF'
from pathlib import Path

from PIL import Image, ImageDraw
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    Image as RLImage,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

ASSETS = Path("/home/user/project/assets")
ASSETS.mkdir(parents=True, exist_ok=True)

# 1) A bar-chart figure rendered as a PNG (an embedded raster picture).
chart_path = ASSETS / "_chart.png"
W, H = 480, 320
img = Image.new("RGB", (W, H), "white")
d = ImageDraw.Draw(img)
d.rectangle([50, 20, W - 20, H - 50], outline="black", width=2)
bars = [
    (80, 120, "#4C72B0"),
    (160, 200, "#DD8452"),
    (240, 90, "#55A868"),
    (320, 240, "#C44E52"),
    (400, 160, "#8172B3"),
]
base = H - 50
for x, h, color in bars:
    d.rectangle([x, base - h, x + 50, base], fill=color, outline="black")
d.text((60, H - 40), "Q1     Q2     Q3     Q4     Q5", fill="black")
img.save(chart_path)

# 2) The 2-page PDF: table on page 1, figure on page 2.
styles = getSampleStyleSheet()
doc = SimpleDocTemplate(str(ASSETS / "report.pdf"), pagesize=letter)
story = []
story.append(Paragraph("Quarterly Operations Report", styles["Title"]))
story.append(Spacer(1, 12))
story.append(
    Paragraph(
        "This report summarizes regional performance across recent quarters. "
        "The following table lists revenue figures by region, followed by a "
        "chart of quarterly totals.",
        styles["BodyText"],
    )
)
story.append(Spacer(1, 18))

data = [
    ["Region", "Q1", "Q2", "Q3", "Q4"],
    ["North", "120", "135", "150", "160"],
    ["South", "98", "110", "105", "130"],
    ["East", "145", "150", "160", "175"],
    ["West", "89", "95", "100", "115"],
    ["Central", "112", "120", "128", "140"],
]
table = Table(data, hAlign="LEFT")
table.setStyle(
    TableStyle(
        [
            ("GRID", (0, 0), (-1, -1), 1, colors.black),
            ("BACKGROUND", (0, 0), (-1, 0), colors.lightgrey),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("ALIGN", (1, 1), (-1, -1), "CENTER"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("LEFTPADDING", (0, 0), (-1, -1), 10),
            ("RIGHTPADDING", (0, 0), (-1, -1), 10),
            ("TOPPADDING", (0, 0), (-1, -1), 7),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ]
    )
)
story.append(table)
story.append(PageBreak())

story.append(Paragraph("Quarterly Totals", styles["Heading1"]))
story.append(
    Paragraph(
        "The figure below visualizes aggregate revenue for each quarter.",
        styles["BodyText"],
    )
)
story.append(Spacer(1, 12))
story.append(RLImage(str(chart_path), width=5 * inch, height=3.33 * inch))
story.append(Spacer(1, 12))
story.append(
    Paragraph(
        "Figure 1. Aggregate quarterly revenue across all regions.",
        styles["Italic"],
    )
)

doc.build(story)
print("Fixture written:", ASSETS / "report.pdf")
PYEOF
RUN python /tmp/gen_fixture.py && chmod -R 0755 /home/user/project

WORKDIR /home/user/project

LABEL Author="generate-harbor-tasks"
LABEL Description="Docling (v2.107.0) offline CPU environment with a pre-generated 2-page PDF fixture (one ruled table, one figure) for a multimodal asset-extraction task."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - Base: ghcr.io/docling-project/docling-serve-cpu:latest (CentOS 9 Stream,
#     Python 3.12, docling + torch + all default models pre-baked, offline).
#   - dnf packages added: epel-release, ripgrep.
#   - pip packages added: pytest, pytest-json-ctrf, pillow, reportlab.
#   - Pochi CLI installed and symlinked to /usr/local/bin/pochi.
#   - DOCLING_ARTIFACTS_PATH points the library at the pre-baked offline models.
#   - /home/user/project: task project directory (Harbor-persisted).
#   - /home/user/project/assets/report.pdf: 2-page US-Letter fixture with one
#     ruled data table and one embedded figure.

COPY test_initial_state.py /bootstrap/test_initial_state.py

# Setup entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
