FROM ubuntu:24.04

# Install OS packages, Node.js v24 (for the TypeScript task SDK), and Python tooling.
RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep && \
    curl -fsSL https://deb.nodesource.com/setup_24.x | bash - && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends nodejs && \
    pip3 install --break-system-packages pytest-json-ctrf reportlab && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Make tsx available globally so the agent can run `npx tsx ...` quickly without resolving from npm each time.
RUN npm install -g tsx@^4 typescript@^5

# Standard user home.
RUN mkdir -p /home/user && chmod 0755 /home/user

# Project directory.
RUN mkdir -p /home/user/project

# Generate the sample invoice PDF used by the task.
# The PDF deliberately contains:
#   - Invoice Number: INV-2026-0042
#   - Date: 2026-04-15
#   - Vendor: Acme Corporation
#   - Two line items: Widget A (qty 3 @ $25.00 = $75.00), Widget B (qty 2 @ $50.00 = $100.00)
#   - Grand Total: $175.00
RUN python3 - <<'PYEOF'
from reportlab.lib.pagesizes import LETTER
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)
from reportlab.lib.styles import getSampleStyleSheet

pdf_path = "/home/user/project/invoice.pdf"
doc = SimpleDocTemplate(pdf_path, pagesize=LETTER, title="Invoice INV-2026-0042")
styles = getSampleStyleSheet()
story = []

story.append(Paragraph("<b>Acme Corporation</b>", styles["Title"]))
story.append(Paragraph("123 Industrial Way, Springfield, USA", styles["Normal"]))
story.append(Spacer(1, 18))

story.append(Paragraph("<b>INVOICE</b>", styles["Heading2"]))
story.append(Paragraph("Invoice Number: INV-2026-0042", styles["Normal"]))
story.append(Paragraph("Invoice Date: 2026-04-15", styles["Normal"]))
story.append(Paragraph("Bill To: Globex Industries", styles["Normal"]))
story.append(Spacer(1, 18))

data = [
    ["Description", "Quantity", "Unit Price (USD)", "Line Total (USD)"],
    ["Widget A", "3", "25.00", "75.00"],
    ["Widget B", "2", "50.00", "100.00"],
    ["", "", "Grand Total:", "175.00"],
]
table = Table(data, colWidths=[200, 80, 110, 110])
table.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, 0), colors.lightgrey),
    ("GRID", (0, 0), (-1, -2), 0.5, colors.grey),
    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
    ("FONTNAME", (-2, -1), (-1, -1), "Helvetica-Bold"),
    ("ALIGN", (1, 1), (-1, -1), "RIGHT"),
]))
story.append(table)
story.append(Spacer(1, 18))
story.append(Paragraph("Payment terms: Net 30. Thank you for your business.", styles["Normal"]))

doc.build(story)
print("Wrote", pdf_path)
PYEOF

# Sanity check that the PDF really exists.
RUN test -s /home/user/project/invoice.pdf && head -c 5 /home/user/project/invoice.pdf | grep -q '%PDF-'

LABEL Author="generate-harbor-tasks"
LABEL Description="LlamaCloud Extract v2 TypeScript task environment with Node.js v24 and a pre-generated sample invoice PDF."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - reportlab (only used at build-time to generate the sample invoice PDF)
#   - Node.js v24 (provides node/npm/npx)
#   - Global npm: tsx, typescript (for fast `npx tsx ...` invocations)
#   - /home/user/project: working directory for the task
#   - /home/user/project/invoice.pdf: pre-generated sample invoice used by the LlamaCloud Extract task
