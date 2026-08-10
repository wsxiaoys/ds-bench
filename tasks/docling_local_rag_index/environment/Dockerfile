# Build FROM the official Docling CPU image: torch, docling, docling-serve and
# ALL default model weights are already baked in, so the build performs NO
# downloads and will not hit HuggingFace/PyTorch timeouts. Document conversion
# therefore runs fully offline out of the box.
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
    && dnf install -y --nodocs --setopt=install_weak_deps=False \
        ripgrep \
    && dnf clean all \
    && rm -rf /var/cache/dnf \
    && curl -fsSL https://getpochi.com/install.sh | bash -s ${POCHI_VERSION} \
    && ln -s /root/.pochi/bin/pochi /usr/local/bin/pochi \
    && python -m pip install --no-cache-dir pytest pytest-json-ctrf reportlab numpy

# --- Runtime configuration ---
# Point the docling *library* at the pre-baked models so the pipeline runs fully
# offline. Absolute path inherent to the base image, independent of the project
# directory. DOCLING_SERVE_ARTIFACTS_PATH, TESSDATA_PREFIX and OMP_NUM_THREADS
# are already set by the base image.
ENV DOCLING_ARTIFACTS_PATH="/opt/app-root/src/.cache/docling/models"

# --- Harbor project directory (CRITICAL — do NOT use /opt/app-root/src) ---
RUN mkdir -p /home/user/project/corpus && chmod -R 0755 /home/user

# --- Build-time input fixtures ---
# Generate the corpus of PDFs with reportlab (pure PDF authoring, NOT a docling
# conversion — no model inference and no assertions run at build time). Each PDF
# is 2 pages, each page under a distinct heading and carrying a unique marker
# token; finance.pdf page 2 contains a bordered table whose rows carry unique
# codename values, used to verify table header-context chunking.
RUN cat >/tmp/gen_fixtures.py <<'PYEOF'
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    PageBreak,
    Table,
    TableStyle,
)

CORPUS = Path("/home/user/project/corpus")
CORPUS.mkdir(parents=True, exist_ok=True)
styles = getSampleStyleSheet()
H = styles["Heading1"]
B = styles["BodyText"]


def page(heading, paragraphs):
    flow = [Paragraph(heading, H), Spacer(1, 18)]
    for p in paragraphs:
        flow.append(Paragraph(p, B))
        flow.append(Spacer(1, 12))
    return flow


def build(name, pages):
    doc = SimpleDocTemplate(str(CORPUS / name), pagesize=LETTER)
    story = []
    for i, (heading, paras, extra) in enumerate(pages):
        story.extend(page(heading, paras))
        if extra is not None:
            story.append(Spacer(1, 18))
            story.append(extra)
        if i != len(pages) - 1:
            story.append(PageBreak())
    doc.build(story)


build(
    "climate.pdf",
    [
        (
            "Atmospheric Overview",
            [
                "This section reviews the physics of the upper atmosphere and greenhouse forcing.",
                "The stratospheric anomaly code is ZORPHENOL4471.",
                "Aerosol loading modulates radiative balance across latitudes.",
            ],
            None,
        ),
        (
            "Ocean Currents",
            [
                "Thermohaline circulation redistributes heat between the equator and the poles.",
                "The deep current index equals THALASSO9920.",
                "Upwelling zones drive nutrient cycles that sustain marine ecosystems.",
            ],
            None,
        ),
    ],
)

build(
    "robotics.pdf",
    [
        (
            "Actuator Systems",
            [
                "Electric actuators convert current into precise mechanical motion.",
                "The servo calibration token is KINETIX3082.",
                "Torque ripple must be compensated in closed-loop controllers.",
            ],
            None,
        ),
        (
            "Sensor Fusion",
            [
                "Combining inertial and visual measurements improves state estimation.",
                "The fusion baseline reference is SENSORIA6613.",
                "Kalman filtering balances process noise against measurement noise.",
            ],
            None,
        ),
    ],
)

ledger = Table(
    [
        ["Instrument", "Codename", "Rating"],
        ["Bond", "VECTORBOND5501", "AAA"],
        ["Equity", "NIMBUSEQ3390", "BBB"],
        ["Option", "QUASAR8846", "CCC"],
    ],
    colWidths=[130, 190, 90],
)
ledger.setStyle(
    TableStyle(
        [
            ("GRID", (0, 0), (-1, -1), 1, colors.black),
            ("BACKGROUND", (0, 0), (-1, 0), colors.lightgrey),
            ("FONTSIZE", (0, 0), (-1, -1), 12),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ("TOPPADDING", (0, 0), (-1, -1), 8),
        ]
    )
)

build(
    "finance.pdf",
    [
        (
            "Market Summary",
            [
                "Macro conditions shaped fixed-income and equity performance this quarter.",
                "The quarterly liquidity signal is FINLIQ7745.",
                "Volatility compressed as credit spreads narrowed.",
            ],
            None,
        ),
        (
            "Instrument Ledger",
            [
                "The following ledger enumerates tracked instruments and their internal codenames.",
            ],
            ledger,
        ),
    ],
)

print("fixtures written:", sorted(p.name for p in CORPUS.glob("*.pdf")))
PYEOF
RUN python /tmp/gen_fixtures.py \
    && rm -f /tmp/gen_fixtures.py

WORKDIR /home/user/project

LABEL Author="generate-harbor-tasks"
LABEL Description="Offline Docling RAG task: docling v2.107.0 CPU base image with pre-baked models, a build-time PDF corpus under /home/user/project/corpus, and pytest tooling."

# NOTE: main.py is authored by the agent at solve time.
CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - Base: ghcr.io/docling-project/docling-serve-cpu:latest (CentOS 9 Stream,
#     Python 3.12 venv at /opt/app-root, torch + docling v2.107.0 + all default
#     model weights pre-baked at /opt/app-root/src/.cache/docling/models)
#   - dnf packages: ripgrep (via EPEL/CRB)
#   - pip packages: pytest, pytest-json-ctrf, reportlab, numpy
#   - Pochi CLI installed and symlinked to /usr/local/bin/pochi
#   - DOCLING_ARTIFACTS_PATH set for fully-offline library conversion
#   - /home/user/project: Harbor project directory (agent authors main.py here)
#   - /home/user/project/corpus: build-time PDF fixtures climate.pdf,
#     robotics.pdf, finance.pdf (finance.pdf page 2 has a bordered ledger table)

COPY test_initial_state.py /bootstrap/test_initial_state.py

# Setup entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
