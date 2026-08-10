# Build FROM the official CPU image: torch, docling, docling-serve and ALL
# default model weights are already baked in — the build does NO downloads,
# so it will not hit HuggingFace/PyTorch timeouts.
FROM ghcr.io/docling-project/docling-serve-cpu:latest

ARG POCHI_VERSION

# --- System deps: CentOS 9 Stream uses dnf, not apt-get ---
# Stay as root (UID 0) for the whole image so the harness, Pochi CLI, pytest,
# and the agent all have unrestricted access.
USER 0
# MUST set HOME=/root explicitly — switching USER does not change HOME, and the
# base image's inherited HOME=/opt/app-root/src would otherwise cause the
# Pochi/pip installers below to write into /opt/app-root/src instead of /root.
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
# Point the *library* (docling) at the pre-baked models so the pipeline runs
# fully offline. This is an absolute path inherent to the base image.
ENV DOCLING_ARTIFACTS_PATH="/opt/app-root/src/.cache/docling/models"

# --- Harbor project directory (CRITICAL — do NOT use /opt/app-root/src) ---
# The harness only persists agent-authored files under /home/user.
RUN mkdir -p /home/user/docling_overlay/assets && chmod -R 0755 /home/user

# --- Build-time input fixture (deterministic, no docling conversion here) ---
# Generate the multi-page PDF used by the task. This uses reportlab only; it
# performs NO document conversion or model warmup, so it cannot fail the build
# on model/layout behavior.
RUN cat > /tmp/gen_fixture.py <<'PY'
import io

from PIL import Image as PILImage
from reportlab.lib import colors
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    Image,
    ListFlowable,
    ListItem,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

OUT = "/home/user/docling_overlay/assets/report.pdf"

styles = getSampleStyleSheet()
title_style = styles["Title"]
h_style = styles["Heading1"]
body_style = styles["BodyText"]
caption_style = ParagraphStyle(
    "Caption", parent=styles["Italic"], fontSize=9, leading=11, spaceBefore=4
)

LOREM = (
    "Docling parses documents into a unified structured representation with rich "
    "layout provenance. Each element carries a bounding box on its page, enabling "
    "downstream tools to overlay, crop, and cross reference detected content across "
    "the rendered raster images produced by the conversion pipeline."
)


def make_picture(w, h, seed):
    img = PILImage.new("RGB", (w, h), (245, 245, 245))
    px = img.load()
    for y in range(h):
        for x in range(w):
            px[x, y] = ((x * 3 + seed) % 256, (y * 5 + seed) % 256, (x + y + seed) % 256)
    # solid framed band so the layout model reliably sees a picture region
    for y in range(h):
        for x in range(w):
            if x < 6 or y < 6 or x > w - 7 or y > h - 7:
                px[x, y] = (20, 20, 20)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return buf


def build():
    doc = SimpleDocTemplate(
        OUT,
        pagesize=LETTER,
        leftMargin=0.9 * inch,
        rightMargin=0.9 * inch,
        topMargin=0.9 * inch,
        bottomMargin=0.9 * inch,
    )
    story = []

    story.append(Paragraph("Quarterly Layout Analysis Report", title_style))
    story.append(Spacer(1, 0.2 * inch))
    story.append(Paragraph("1. Introduction", h_style))
    story.append(Paragraph(LOREM, body_style))
    story.append(Paragraph(LOREM, body_style))
    story.append(Spacer(1, 0.15 * inch))
    story.append(Paragraph("1.1 Key Points", h_style))
    story.append(
        ListFlowable(
            [
                ListItem(Paragraph("Provenance boxes are stored per element.", body_style)),
                ListItem(Paragraph("Page images render at a configurable scale.", body_style)),
                ListItem(Paragraph("Coordinates must be mapped into pixel space.", body_style)),
            ],
            bulletType="bullet",
        )
    )

    story.append(PageBreak())

    story.append(Paragraph("2. Tabular Results", h_style))
    story.append(Paragraph(LOREM, body_style))
    data = [
        ["Region", "Documents", "Tables", "Figures"],
        ["North", "1204", "312", "88"],
        ["South", "980", "205", "64"],
        ["East", "1560", "410", "133"],
        ["West", "742", "150", "51"],
    ]
    table = Table(data, colWidths=[1.4 * inch] * 4)
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#4472C4")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("GRID", (0, 0), (-1, -1), 0.75, colors.black),
                ("ALIGN", (1, 0), (-1, -1), "CENTER"),
                ("FONTSIZE", (0, 0), (-1, -1), 10),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    story.append(table)
    story.append(Paragraph("Table 1. Aggregated processing counts per region.", caption_style))
    story.append(Spacer(1, 0.2 * inch))
    story.append(Paragraph(LOREM, body_style))

    story.append(PageBreak())

    story.append(Paragraph("3. Figures", h_style))
    story.append(Paragraph(LOREM, body_style))
    story.append(Image(make_picture(320, 200, 40), width=3.2 * inch, height=2.0 * inch))
    story.append(Paragraph("Figure 1. Synthetic raster used for layout detection.", caption_style))
    story.append(Spacer(1, 0.2 * inch))
    story.append(Paragraph("3.1 Discussion", h_style))
    story.append(Paragraph(LOREM, body_style))
    story.append(Paragraph(LOREM, body_style))

    doc.build(story)


build()
print("wrote", OUT)
PY
RUN python /tmp/gen_fixture.py

WORKDIR /home/user/docling_overlay

LABEL Author="generate-harbor-tasks"
LABEL Description="Offline Docling per-page provenance bbox overlay task; multi-page PDF fixture pre-generated under /home/user/docling_overlay/assets."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - base image ghcr.io/docling-project/docling-serve-cpu:latest (torch + docling
#     v2.107.0 + docling-serve + all default model weights, pre-baked, offline)
#   - extra dnf package: ripgrep (via crb + epel)
#   - pip packages: pytest, pytest-json-ctrf, reportlab
#   - Pochi CLI symlinked at /usr/local/bin/pochi
#   - DOCLING_ARTIFACTS_PATH points docling at the pre-baked offline model cache
#   - /home/user/docling_overlay: project directory (WORKDIR)
#   - /home/user/docling_overlay/assets/report.pdf: deterministic multi-page PDF fixture

COPY test_initial_state.py /bootstrap/test_initial_state.py

# Setup entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
