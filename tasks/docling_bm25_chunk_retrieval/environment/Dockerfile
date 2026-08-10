# Offline BM25 retrieval-over-Docling task environment.
#
# Build FROM the official Docling CPU image: torch, docling, docling-serve and
# ALL default model weights (layout, tableformer, picture_classifier, rapidocr,
# easyocr) are already baked in, so the build performs NO model/PyTorch
# downloads and runs fully offline at solve/verify time.
FROM ghcr.io/docling-project/docling-serve-cpu:latest

ARG POCHI_VERSION

# --- Stay root for the whole image (Harbor harness / Pochi CLI / pytest all
#     need unrestricted write access) and reset HOME so the Pochi/uv installers
#     write to /root, not the base image's inherited /opt/app-root/src. ---
USER 0
ENV HOME=/root

# --- System deps: CentOS 9 Stream uses dnf (git/wget/curl already present). ---
RUN dnf config-manager --set-enabled crb \
    && dnf install -y https://dl.fedoraproject.org/pub/epel/epel-release-latest-9.noarch.rpm \
    && dnf install -y --nodocs --setopt=install_weak_deps=False \
        tesseract-langpack-spa ripgrep \
    && dnf clean all \
    && rm -rf /var/cache/dnf \
    && curl -fsSL https://getpochi.com/install.sh | bash -s ${POCHI_VERSION} \
    && ln -s /root/.pochi/bin/pochi /usr/local/bin/pochi \
    && python -m pip install --no-cache-dir pytest pytest-json-ctrf reportlab rank-bm25

# --- Runtime configuration: point the docling library at the pre-baked models
#     so the pipeline runs fully offline. ---
ENV DOCLING_ARTIFACTS_PATH="/opt/app-root/src/.cache/docling/models"

# --- Harbor project directory (CRITICAL — never /opt/app-root/src). ---
RUN mkdir -p /home/user/project/assets && chmod -R 0755 /home/user

# --- Deterministic build-time input fixtures (NO docling conversion here). ---
# Generates a 2-page PDF report (five headed sections + one table) and the
# seeded queries file under the project directory using reportlab.
RUN cat > /tmp/gen_fixture.py <<'PYEOF'
import json
import os

from reportlab.lib import colors
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

ASSETS = "/home/user/project/assets"
os.makedirs(ASSETS, exist_ok=True)

styles = getSampleStyleSheet()
title_style = ParagraphStyle(
    "BigTitle", parent=styles["Title"], fontSize=26, leading=30, spaceAfter=24
)
head_style = ParagraphStyle(
    "SecHead",
    parent=styles["Heading1"],
    fontSize=18,
    leading=22,
    spaceBefore=18,
    spaceAfter=10,
    fontName="Helvetica-Bold",
)
body_style = ParagraphStyle(
    "Body", parent=styles["BodyText"], fontSize=11, leading=15, spaceAfter=10
)

story = []
story.append(Paragraph("Aurora Field Operations Manual", title_style))

story.append(Paragraph("Device Onboarding", head_style))
story.append(
    Paragraph(
        "Every newly provisioned unit needs an activation passphrase before "
        "joining the mesh. The activation passphrase for this deployment is "
        "ZEPHYR-4417 and must be entered within ten minutes.",
        body_style,
    )
)

story.append(Paragraph("Billing Policy", head_style))
story.append(
    Paragraph(
        "All customer invoices are settled exclusively in the kronelumen "
        "currency. Partial settlements are refused and overdue balances accrue "
        "a monthly penalty.",
        body_style,
    )
)

story.append(Paragraph("Cryptography Standards", head_style))
story.append(
    Paragraph(
        "The mandatory transport cipher for every secured link is "
        "BLOWFISH-CASCADE. Operators cannot re-enable retired ciphers once they "
        "have been disabled.",
        body_style,
    )
)

story.append(PageBreak())

story.append(Paragraph("Hardware Specifications", head_style))
story.append(
    Paragraph(
        "This section enumerates the certified components together with their "
        "operating limits.",
        body_style,
    )
)
data = [
    ["Component", "Model", "Rating"],
    ["Flux Capacitor", "FCX-9", "88"],
    ["Plasma Coil", "PLC-3", "42"],
    ["Ion Damper", "IOND-7", "15"],
]
table = Table(data, hAlign="LEFT")
table.setStyle(
    TableStyle(
        [
            ("GRID", (0, 0), (-1, -1), 1, colors.black),
            ("BACKGROUND", (0, 0), (-1, 0), colors.lightgrey),
            ("FONTSIZE", (0, 0), (-1, -1), 11),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ]
    )
)
story.append(table)
story.append(Spacer(1, 12))

story.append(Paragraph("Maintenance Schedule", head_style))
story.append(
    Paragraph(
        "Intake filters must be replaced every 512 service hours to sustain "
        "airflow. Missing a scheduled replacement voids the equipment warranty.",
        body_style,
    )
)

SimpleDocTemplate(
    os.path.join(ASSETS, "report.pdf"),
    pagesize=LETTER,
    topMargin=1 * inch,
    bottomMargin=1 * inch,
    leftMargin=1 * inch,
    rightMargin=1 * inch,
).build(story)

queries = [
    {"query_id": "q_onboarding", "query": "What is the device activation passphrase?"},
    {"query_id": "q_billing", "query": "Which currency is used to settle customer invoices?"},
    {"query_id": "q_crypto_heading", "query": "cryptography standards"},
    {"query_id": "q_hardware_table", "query": "flux capacitor model number"},
    {"query_id": "q_maintenance", "query": "how often must intake filters be replaced"},
]
with open(os.path.join(ASSETS, "queries.json"), "w", encoding="utf-8") as f:
    json.dump(queries, f, indent=2)

print("fixtures generated")
PYEOF
RUN python /tmp/gen_fixture.py && rm -f /tmp/gen_fixture.py && chmod -R 0755 /home/user

WORKDIR /home/user/project

LABEL Author="generate-harbor-tasks"
LABEL Description="Offline Docling + BM25 retrieval task: 2-page seeded PDF report and queries baked under /home/user/project/assets."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - Base: ghcr.io/docling-project/docling-serve-cpu:latest (CentOS 9 Stream,
#     Python 3.12 venv on PATH, docling v2.107.0 + all default model weights).
#   - dnf extras: tesseract-langpack-spa, ripgrep (git/wget/curl already present).
#   - pip extras: pytest, pytest-json-ctrf (verifier), reportlab (build-time
#     fixture generation), rank-bm25 (offline pure-python BM25, optional for agent).
#   - Pochi CLI installed and symlinked to /usr/local/bin/pochi.
#   - DOCLING_ARTIFACTS_PATH points docling at the pre-baked offline model cache.
#   - /home/user/project/assets/report.pdf: 2-page seeded report (5 sections + table).
#   - /home/user/project/assets/queries.json: 5 seeded test queries.

COPY test_initial_state.py /bootstrap/test_initial_state.py

# Setup entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
