# Build FROM the official CPU image: torch, docling, docling-serve and ALL
# default model weights are already baked in -- the build does NO model/PyTorch
# downloads, so it will not hit HuggingFace/PyTorch timeouts and runs offline
# at solve/verify time.
FROM ghcr.io/docling-project/docling-serve-cpu:latest

ARG POCHI_VERSION

# --- System deps: CentOS 9 Stream uses dnf, not apt-get ---
# Stay as root (UID 0) for the whole image so the harness, Pochi CLI, pytest and
# the agent all have unrestricted access.
USER 0
# MUST set HOME=/root explicitly -- switching USER does not change HOME, and the
# base image's inherited HOME=/opt/app-root/src would otherwise make the Pochi
# installer and python user installs write into /opt/app-root/src.
ENV HOME=/root
# NOTE: git, wget and curl are already present in the base image -- do not
# re-install them (curl conflicts with curl-minimal on CentOS 9 Stream).
RUN dnf config-manager --set-enabled crb \
    && dnf install -y https://dl.fedoraproject.org/pub/epel/epel-release-latest-9.noarch.rpm \
    && dnf install -y --nodocs --setopt=install_weak_deps=False \
        ripgrep \
    && dnf clean all \
    && rm -rf /var/cache/dnf \
    && curl -fsSL https://getpochi.com/install.sh | bash -s ${POCHI_VERSION} \
    && ln -s /root/.pochi/bin/pochi /usr/local/bin/pochi \
    && python -m pip install --no-cache-dir pytest pytest-json-ctrf reportlab

# --- Runtime configuration ---
# Point the *library* (docling) at the pre-baked models so the pipeline runs
# fully offline. Absolute path inherent to the base image, independent of the
# project directory location. DOCLING_SERVE_ARTIFACTS_PATH, TESSDATA_PREFIX and
# OMP_NUM_THREADS are already set by the base image.
ENV DOCLING_ARTIFACTS_PATH="/opt/app-root/src/.cache/docling/models"

# --- Harbor project directory (CRITICAL -- do NOT use /opt/app-root/src) ---
RUN mkdir -p /home/user/reading_order/assets && chmod -R 0755 /home/user

# --- Deterministic build-time input fixture (NO docling conversion here) ---
# Generate a 3-page, multi-column PDF with running header/footer/page-numbers,
# a full-width spanning title on page 1, and a known sentinel sentence that is
# typeset flowing from the bottom of page 1's left column into the top of its
# right column.
RUN python - <<'PYEOF'
import os
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    BaseDocTemplate, PageTemplate, Frame, Paragraph, FrameBreak,
    PageBreak, NextPageTemplate,
)

OUT = "/home/user/reading_order/assets/report.pdf"
os.makedirs(os.path.dirname(OUT), exist_ok=True)

W, H = letter  # 612 x 792 points

styles = getSampleStyleSheet()
body = ParagraphStyle("body", parent=styles["Normal"], fontName="Helvetica",
                      fontSize=10, leading=13, alignment=4, spaceAfter=6)
title_style = ParagraphStyle("titlestyle", parent=styles["Title"],
                             fontName="Helvetica-Bold", fontSize=18,
                             leading=22, alignment=1, spaceAfter=4)


def header_footer(canvas, doc):
    canvas.saveState()
    canvas.setFont("Helvetica", 8)
    canvas.drawString(54, 762, "CONFIDENTIALHEADERMARK Internal Draft Not For Distribution")
    canvas.drawString(54, 30, "FOOTERMARKZ Page %d of 3" % canvas.getPageNumber())
    canvas.restoreState()


# Frames (x1, y1 = bottom-left, then width, height)
title_frame = Frame(54, 672, 504, 60, id="title")
left1 = Frame(54, 60, 240, 600, id="left1")
right1 = Frame(318, 60, 240, 600, id="right1")
left2 = Frame(54, 60, 240, 680, id="left2")
right2 = Frame(318, 60, 240, 680, id="right2")
single3 = Frame(54, 60, 504, 680, id="single3")

doc = BaseDocTemplate(OUT, pagesize=letter,
                      leftMargin=54, rightMargin=54, topMargin=54, bottomMargin=54)
doc.addPageTemplates([
    PageTemplate(id="p1", frames=[title_frame, left1, right1], onPage=header_footer),
    PageTemplate(id="p2", frames=[left2, right2], onPage=header_footer),
    PageTemplate(id="p3", frames=[single3], onPage=header_footer),
])

# Sentinel split across the page-1 column break: PART1 is the last (bottom)
# element of the left column; PART2 is the first (top) element of the right
# column. Concatenated in true reading order they form one contiguous sentence.
SENTINEL_PART1 = ("SENTINEL BEGIN the quick auburn vessel silently navigated beyond the "
                  "northern archipelago while cartographers meticulously recorded")
SENTINEL_PART2 = ("every subtle contour of the uncharted coastline before dusk finally "
                  "settled over the tranquil harbor SENTINEL END")

L1 = [
    "PAGEONEMARK The expedition logbook opens with a measured account of the "
    "vessel departing the sheltered bay under a pale morning sky.",
    "Provisions were catalogued with unusual care and every crate of instruments "
    "was lashed securely against the anticipated swell of the open water.",
    "The navigator plotted an initial bearing that favoured the deeper channel, "
    "avoiding the shoals that had grounded lesser ships in previous seasons.",
    "Throughout the first watch the crew rotated in disciplined shifts, noting "
    "wind direction and the slow drift of distant cloud banks.",
]

R1 = [
    "By midday the coastline resolved into a series of jagged headlands whose "
    "shadows shifted as the sun climbed steadily overhead.",
    "The surveyor sketched each promontory in turn, annotating the folios with "
    "compass readings and estimates of the tidal range.",
    "A following breeze carried the scent of pine from the forested slopes that "
    "rose sharply behind the narrow strip of shingle beach.",
    "As evening approached the party prepared to make anchor in the lee of a "
    "broad granite outcrop that promised calm holding ground.",
]

P2 = [
    "PAGETWOMARK The second day of the survey began before dawn with the "
    "methodical calibration of the theodolite and the chronometers.",
    "Measurements were repeated three times and the mean of each set was entered "
    "into the ledger to guard against transcription error.",
    "The eastern reach of the inlet proved shallower than the charts suggested, "
    "forcing a cautious approach under reduced sail.",
    "Seabirds wheeled overhead in great numbers, their cries echoing from the "
    "cliff faces that hemmed the anchorage on three sides.",
    "The botanist collected specimens from the tideline, pressing fronds of kelp "
    "and pale flowering samphire between sheets of coarse paper.",
    "By dusk the completed traverse was reconciled against the previous day's "
    "observations, and the discrepancies were found to be trivially small.",
]

P3 = [
    "PAGETHREEMARK The concluding chapter of the report summarises the findings "
    "in a single continuous column of measured prose.",
    "The reconstructed coastline agreed closely with the corrected bearings, and "
    "the earlier charts were amended accordingly in the appended plates.",
    "Recommendations for future expeditions stress the value of redundant "
    "instruments and of recording every observation in duplicate.",
    "The authors close with gratitude to the crew whose steady discipline made "
    "the entire undertaking both safe and productive.",
    "A final note reminds the reader that all raw measurements remain archived in "
    "the accompanying data volume for independent verification.",
]

story = []
# --- Page 1: spanning title + 2 columns ---
story.append(Paragraph("PAGEONEMARK Quarterly Field Report On Coastal Navigation", title_style))
story.append(FrameBreak())  # move to left column
for p in L1:
    story.append(Paragraph(p, body))
story.append(Paragraph(SENTINEL_PART1, body))
story.append(FrameBreak())  # move to right column
story.append(Paragraph(SENTINEL_PART2, body))
for p in R1:
    story.append(Paragraph(p, body))

# --- Page 2: pure 2 columns ---
story.append(NextPageTemplate("p2"))
story.append(PageBreak())
half = 3
for p in P2[:half]:
    story.append(Paragraph(p, body))
story.append(FrameBreak())
for p in P2[half:]:
    story.append(Paragraph(p, body))

# --- Page 3: single column ---
story.append(NextPageTemplate("p3"))
story.append(PageBreak())
for p in P3:
    story.append(Paragraph(p, body))

doc.build(story)
assert os.path.isfile(OUT) and os.path.getsize(OUT) > 0
print("Generated fixture:", OUT, os.path.getsize(OUT), "bytes")
PYEOF

WORKDIR /home/user/reading_order

LABEL Author="generate-harbor-tasks"
LABEL Description="Docling offline multi-column reading-order reconstruction task: 3-page multi-column PDF fixture under /home/user/reading_order."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - Base: ghcr.io/docling-project/docling-serve-cpu:latest (CentOS 9 Stream,
#     Python 3.12, docling 2.107.0 + pre-baked model weights, Tesseract eng)
#   - dnf packages added: ripgrep (via EPEL/CRB)
#   - pip packages added: pytest, pytest-json-ctrf, reportlab
#   - Pochi CLI installed and symlinked to /usr/local/bin/pochi
#   - DOCLING_ARTIFACTS_PATH -> /opt/app-root/src/.cache/docling/models (offline)
#   - Project dir: /home/user/reading_order
#     - assets/report.pdf: deterministic build-time 3-page multi-column fixture
#       (running header/footer/page-numbers, full-width spanning title on page 1,
#        sentinel sentence spanning the page-1 column break)

COPY test_initial_state.py /bootstrap/test_initial_state.py

# Setup entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
