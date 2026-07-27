# Build FROM the official Docling CPU image: torch, docling, docling-serve and
# ALL default model weights (layout, tableformer, picture_classifier, rapidocr,
# easyocr) are already baked in, plus Tesseract eng/spa data. The build performs
# NO model or PyTorch downloads, so it will not hit HuggingFace/PyTorch timeouts,
# and the task runs fully offline at solve/verify time.
FROM ghcr.io/docling-project/docling-serve-cpu:latest

ARG POCHI_VERSION

# --- Stay root for the whole image (Harbor harness / Pochi CLI / pytest / agent
# all need unrestricted write access). Switching USER does not reset HOME, and
# the base image's inherited HOME=/opt/app-root/src would otherwise make the
# Pochi installer write into the wrong place — so force HOME=/root. ---
USER 0
ENV HOME=/root

# --- System deps: CentOS 9 Stream uses dnf, NOT apt-get. git/wget/curl already
# ship in the base image, so do not reinstall them. Install ripgrep + Spanish
# Tesseract langpack, the Pochi CLI, and pytest + pytest-json-ctrf + reportlab
# (reportlab is only used at build time to generate the deterministic fixture). ---
RUN dnf config-manager --set-enabled crb \
    && dnf install -y https://dl.fedoraproject.org/pub/epel/epel-release-latest-9.noarch.rpm \
    && dnf install -y --nodocs --setopt=install_weak_deps=False \
        tesseract-langpack-spa ripgrep \
    && dnf clean all \
    && rm -rf /var/cache/dnf \
    && curl -fsSL https://getpochi.com/install.sh | bash -s ${POCHI_VERSION} \
    && ln -s /root/.pochi/bin/pochi /usr/local/bin/pochi \
    && python -m pip install --no-cache-dir pytest pytest-json-ctrf reportlab

# --- Runtime configuration: point the docling *library* at the pre-baked model
# cache so the pipeline runs fully offline. DOCLING_SERVE_ARTIFACTS_PATH,
# TESSDATA_PREFIX and OMP_NUM_THREADS are already set by the base image. ---
ENV DOCLING_ARTIFACTS_PATH="/opt/app-root/src/.cache/docling/models"

# --- Harbor project directory (CRITICAL: under /home/user, never /opt/app-root/src) ---
RUN mkdir -p /home/user && chmod 0755 /home/user
RUN mkdir -p /home/user/project/assets && chmod -R 0755 /home/user/project

# --- Deterministic build-time input fixture ------------------------------------
# Generate assets/report.pdf with a KNOWN multi-level heading hierarchy. Heading
# levels are encoded via outline numbering (N / N.N / N.N.N) so level detection
# is unambiguous regardless of the model's flat PDF heading predictions. Each
# body block carries a unique sentinel token (SNTLQ0xx) for content-integrity
# checks. A page break precedes every H1 so top-level page numbers are strictly
# increasing. This is a side-effect-only fixture step — NO docling conversion or
# assertions run during the build.
RUN cat > /tmp/gen_fixture.py <<'PYEOF'
from pathlib import Path

from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import PageBreak, Paragraph, SimpleDocTemplate, Spacer

TITLE = "Quarterly Systems Report"

# (heading text, level, sentinel token for the body block under this heading)
SEQUENCE = [
    ("1 Introduction", 1, "SNTLQ001"),
    ("1.1 Background", 2, "SNTLQ002"),
    ("1.1.1 Prior Work", 3, "SNTLQ003"),
    ("1.2 Objectives", 2, "SNTLQ004"),
    ("2 Methodology", 1, "SNTLQ005"),
    ("2.1 Data Collection", 2, "SNTLQ006"),
    ("2.1.1 Sampling", 3, "SNTLQ007"),
    ("2.1.2 Instruments", 3, "SNTLQ008"),
    ("2.2 Analysis", 2, "SNTLQ009"),
    ("3 Results", 1, "SNTLQ010"),
    ("3.1 Findings", 2, "SNTLQ011"),
    ("3.2 Discussion", 2, "SNTLQ012"),
    ("3.2.1 Limitations", 3, "SNTLQ013"),
    ("4 Conclusion", 1, "SNTLQ014"),
    ("4.1 Summary", 2, "SNTLQ015"),
]

title_style = ParagraphStyle(
    "DocTitle", fontName="Helvetica-Bold", fontSize=22, leading=26,
    spaceAfter=24, alignment=TA_LEFT,
)
heading_styles = {
    1: ParagraphStyle("H1", fontName="Helvetica-Bold", fontSize=18, leading=22,
                      spaceBefore=18, spaceAfter=10),
    2: ParagraphStyle("H2", fontName="Helvetica-Bold", fontSize=14, leading=18,
                      spaceBefore=14, spaceAfter=8),
    3: ParagraphStyle("H3", fontName="Helvetica-Bold", fontSize=12, leading=16,
                      spaceBefore=12, spaceAfter=6),
}
body_style = ParagraphStyle(
    "Body", fontName="Helvetica", fontSize=10.5, leading=15, spaceAfter=10,
)

BODY_TEMPLATE = (
    "This passage belongs to the section above and provides original narrative "
    "content for verification purposes. The unique sentinel marker {token} "
    "identifies this specific text block and must be preserved verbatim during "
    "processing. It is deliberately written as ordinary prose so that it is not "
    "mistaken for a section heading."
)

story = [Paragraph(TITLE, title_style), Spacer(1, 0.2 * inch)]
seen_first_h1 = False
for text, level, token in SEQUENCE:
    if level == 1:
        if seen_first_h1:
            story.append(PageBreak())
        seen_first_h1 = True
    story.append(Paragraph(text, heading_styles[level]))
    story.append(Paragraph(BODY_TEMPLATE.format(token=token), body_style))

out = Path("/home/user/project/assets/report.pdf")
out.parent.mkdir(parents=True, exist_ok=True)
doc = SimpleDocTemplate(
    str(out), pagesize=letter,
    leftMargin=0.9 * inch, rightMargin=0.9 * inch,
    topMargin=0.9 * inch, bottomMargin=0.9 * inch,
    title=TITLE,
)
doc.build(story)
print("wrote", out)
PYEOF
RUN python /tmp/gen_fixture.py && rm -f /tmp/gen_fixture.py && chmod 0644 /home/user/project/assets/report.pdf

WORKDIR /home/user/project

LABEL Author="generate-harbor-tasks"
LABEL Description="Offline Docling (v2.107.0) environment with a deterministic multi-level PDF fixture for the semantic section splitter task."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - Base: ghcr.io/docling-project/docling-serve-cpu:latest (CentOS 9 Stream,
#     Python 3.12, CPU torch + docling v2.107.0 + docling-serve, all default
#     model weights pre-baked, Tesseract eng/spa).
#   - dnf packages added: tesseract-langpack-spa, ripgrep (+ EPEL/CRB enabled).
#   - Pochi CLI (symlinked to /usr/local/bin/pochi).
#   - pip packages added: pytest, pytest-json-ctrf, reportlab (build-time fixture only).
#   - ENV DOCLING_ARTIFACTS_PATH -> pre-baked offline model cache.
#   - /home/user/project: Harbor project directory (WORKDIR).
#   - /home/user/project/assets/report.pdf: deterministic multi-level heading PDF fixture.
#   - main.py and output/ are authored/produced by the agent at solve time.

COPY test_initial_state.py /bootstrap/test_initial_state.py

# Setup entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
