# Build FROM the official Docling CPU image: torch, docling, docling-serve and ALL
# default model weights are already baked in, so the build performs no model
# downloads and the container can convert documents fully offline.
FROM ghcr.io/docling-project/docling-serve-cpu:latest

ARG POCHI_VERSION

# --- System deps: CentOS 9 Stream uses dnf, not apt-get ---
# Stay as root (UID 0) for the whole image so the harness, Pochi CLI, pytest and
# the agent all have unrestricted access. HOME must be reset explicitly because
# the base image inherits HOME=/opt/app-root/src even for root.
USER 0
ENV HOME=/root

# git, wget and curl already ship with the base image and must not be reinstalled.
RUN dnf config-manager --set-enabled crb \
    && dnf install -y https://dl.fedoraproject.org/pub/epel/epel-release-latest-9.noarch.rpm \
    && dnf install -y --nodocs --setopt=install_weak_deps=False ripgrep \
    && dnf clean all \
    && rm -rf /var/cache/dnf \
    && curl -fsSL https://getpochi.com/install.sh | bash -s ${POCHI_VERSION} \
    && ln -s /root/.pochi/bin/pochi /usr/local/bin/pochi \
    && python -m pip install --no-cache-dir pytest pytest-json-ctrf reportlab \
    && python -c "import importlib.util, subprocess, sys; missing = [p for p in ('transformers', 'semchunk') if importlib.util.find_spec(p) is None]; subprocess.check_call([sys.executable, '-m', 'pip', 'install', '--no-cache-dir', *missing]) if missing else None" \
    && (command -v python3 >/dev/null 2>&1 || ln -s "$(command -v python)" /usr/local/bin/python3)

# Point the docling library at the pre-baked weights so the pipeline runs offline.
ENV DOCLING_ARTIFACTS_PATH="/opt/app-root/src/.cache/docling/models"

# --- Harbor project directory (must live under /home/user) ---
RUN mkdir -p /home/user && chmod 0755 /home/user \
    && mkdir -p /home/user/chunkforge/assets/corpus/appendix

# --- Build-time corpus fixtures (markdown, html, docx, pdf, unsupported txt) ---
RUN python - <<'PY'
from pathlib import Path

from docx import Document
from reportlab.lib.pagesizes import LETTER
from reportlab.pdfgen import canvas

corpus = Path("/home/user/chunkforge/assets/corpus")
(corpus / "appendix").mkdir(parents=True, exist_ok=True)

# ---------------------------------------------------------------- alpha_guide.md
capacity_sentences = [
    "The capacity planning window for the alpha fleet spans three consecutive quarters and is reviewed by the platform guild every month.",
    "Each region keeps a standing reservation of compute that is never handed back to the shared pool during a freeze period.",
    "Storage growth is projected from the trailing ninety day average and then padded by a fixed safety factor agreed with finance.",
    "When a projection exceeds the reservation the guild files a procurement ticket and records the expected delivery date in the ledger.",
    "Network egress is tracked separately because the billing model differs sharply between the internal backbone and the public transit links.",
    "A quarterly review compares the projection against the realised usage and the delta is folded back into the next projection round.",
    "Any region that misses its projection twice in a row is placed under a stricter weekly review until the drift disappears.",
    "The guild publishes the resulting numbers in a read only ledger so that every downstream team can plan against the same figures.",
]

parts = ["ZQXSENTINELALPHA marks the beginning of the capacity note that follows."]
for round_no in range(4):
    if round_no == 2:
        parts.append("ZQXSENTINELMIDDLE separates the historical review from the forward looking projection.")
    parts.extend(capacity_sentences)
parts.append("ZQXSENTINELOMEGA closes the capacity note and no further text follows it.")
capacity_paragraph = " ".join(parts)

alpha = "\n".join(
    [
        "# Alpha Operations Guide",
        "",
        "The alpha platform is operated by a small on call rotation that hands over every week.",
        "",
        "## Operations",
        "",
        "### Deployment",
        "",
        "#### Rollout Waves",
        "",
        "##### Rollback Drill",
        "",
        "Wave one covers the internal staging fleet only.",
        "",
        "Wave two adds the two smallest production regions.",
        "",
        "Wave three covers every remaining production region.",
        "",
        "Each wave is gated by an automatic health probe.",
        "",
        "The drill is repeated every quarter by the on call pair.",
        "",
        "Findings from the drill are filed as follow up items.",
        "",
        "### Capacity Notes",
        "",
        capacity_paragraph,
        "",
    ]
)
(corpus / "alpha_guide.md").write_text(alpha, encoding="utf-8")

# ------------------------------------------------------ appendix/omega_notes.md
omega = "\n".join(
    [
        "# Omega Appendix",
        "",
        "## Retention",
        "",
        "Operational logs are retained for ninety days and then archived to cold storage.",
        "",
        "## Contacts",
        "",
        "The appendix is maintained by the reliability team and reviewed twice a year.",
        "",
    ]
)
(corpus / "appendix" / "omega_notes.md").write_text(omega, encoding="utf-8")

# --------------------------------------------------------------- beta_report.html
beta = """<!DOCTYPE html>
<html>
  <head><title>Beta Quarterly Report</title></head>
  <body>
    <h1>Beta Quarterly Report</h1>
    <h2>Regional Revenue</h2>
    <p>The table below lists the revenue recorded per region for the first two quarters.</p>
    <table>
      <thead>
        <tr><th>Region</th><th>Q1</th><th>Q2</th><th>Total</th></tr>
      </thead>
      <tbody>
        <tr><td>Zurich</td><td>8200</td><td>10220</td><td>18420</td></tr>
        <tr><td>Dublin</td><td>7400</td><td>9110</td><td>16510</td></tr>
        <tr><td>Osaka</td><td>6100</td><td>7350</td><td>13450</td></tr>
      </tbody>
    </table>
    <h2>Outlook</h2>
    <p>Revenue is expected to grow moderately in the third quarter across all three regions.</p>
  </body>
</html>
"""
(corpus / "beta_report.html").write_text(beta, encoding="utf-8")

# -------------------------------------------------------------- gamma_minutes.docx
document = Document()
document.add_heading("Gamma Steering Minutes", level=1)
document.add_paragraph("The steering group met to review the migration programme.")
document.add_heading("Decisions", level=2)
document.add_paragraph("The migration of the reporting service is approved for the next window.")
document.add_paragraph("The legacy exporter is frozen and only security fixes are accepted.")
document.add_heading("Action Items", level=2)
table = document.add_table(rows=3, cols=3)
cells = [
    ["Owner", "Action", "Due"],
    ["Reliability", "Publish the freeze calendar", "Week 12"],
    ["Reporting", "Draft the migration runbook", "Week 14"],
]
for row_index, row in enumerate(cells):
    for col_index, value in enumerate(row):
        table.cell(row_index, col_index).text = value
document.add_paragraph("Minutes approved without objection.")
document.save(str(corpus / "gamma_minutes.docx"))

# ---------------------------------------------------------------- delta_brief.pdf
pdf = canvas.Canvas(str(corpus / "delta_brief.pdf"), pagesize=LETTER, invariant=1)
pdf.setFont("Helvetica-Bold", 18)
pdf.drawString(72, 720, "Delta Incident Brief")
pdf.setFont("Helvetica-Bold", 13)
pdf.drawString(72, 685, "Summary")
pdf.setFont("Helvetica", 11)
for offset, line in enumerate(
    [
        "A partial outage affected the delta ingestion tier for eleven minutes.",
        "Requests were shed by the load balancer while the tier was restarted.",
        "No data loss was observed and the backlog drained within the hour.",
    ]
):
    pdf.drawString(72, 660 - offset * 16, line)
pdf.setFont("Helvetica-Bold", 13)
pdf.drawString(72, 595, "Follow Up")
pdf.setFont("Helvetica", 11)
for offset, line in enumerate(
    [
        "The restart procedure is now covered by an automated health probe.",
        "A capacity review is scheduled before the next seasonal peak.",
    ]
):
    pdf.drawString(72, 570 - offset * 16, line)
pdf.showPage()
pdf.save()

# ---------------------------------------------------------------------- notes.txt
(corpus / "notes.txt").write_text(
    "Scratch notes in an unsupported format; this file must not be chunked.\n",
    encoding="utf-8",
)
PY

# --- Bake the embedding tokenizer so token counting works without any network ---
RUN python -c "from transformers import AutoTokenizer; AutoTokenizer.from_pretrained('sentence-transformers/all-MiniLM-L6-v2').save_pretrained('/home/user/chunkforge/assets/tokenizer')" \
    && chmod -R 0755 /home/user/chunkforge

# Everything the task needs is now on disk: force fully offline behaviour.
ENV HF_HUB_OFFLINE=1 \
    TRANSFORMERS_OFFLINE=1 \
    HF_HUB_DISABLE_TELEMETRY=1 \
    TOKENIZERS_PARALLELISM=false

WORKDIR /home/user/chunkforge

LABEL Author="generate-harbor-tasks"
LABEL Description="Offline Docling CPU environment with a mixed-format corpus and a baked HuggingFace tokenizer for token-budget-aware chunk packing."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - base image ghcr.io/docling-project/docling-serve-cpu:latest (CPU torch, docling,
#     docling-serve, all default model weights pre-baked, Python 3.12 venv on PATH)
#   - dnf packages: ripgrep (EPEL); git/wget/curl already present in the base image
#   - pip packages: pytest, pytest-json-ctrf, reportlab (+ transformers/semchunk if absent)
#   - Pochi CLI symlinked to /usr/local/bin/pochi
#   - /home/user/chunkforge: task project directory (working directory)
#   - /home/user/chunkforge/assets/corpus: alpha_guide.md, appendix/omega_notes.md,
#     beta_report.html, gamma_minutes.docx, delta_brief.pdf, notes.txt (unsupported)
#   - /home/user/chunkforge/assets/tokenizer: baked all-MiniLM-L6-v2 tokenizer files
#   - offline enforcement: DOCLING_ARTIFACTS_PATH, HF_HUB_OFFLINE, TRANSFORMERS_OFFLINE

COPY test_initial_state.py /bootstrap/test_initial_state.py

# Setup entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
