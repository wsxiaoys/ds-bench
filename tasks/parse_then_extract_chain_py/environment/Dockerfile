FROM ubuntu:24.04

RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep && \
    pip3 install --break-system-packages \
        pytest-json-ctrf \
        "llama-cloud>=2.7,<3" \
        "pydantic>=2,<3" \
        reportlab && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN mkdir -p /home/user && chmod 0755 /home/user
RUN mkdir -p /home/user/myproject/data

# Generate a deterministic sample invoice PDF at build time using reportlab.
# This avoids needing any network access at runtime to fetch a sample document.
RUN python3 - <<'PY'
from reportlab.lib.pagesizes import LETTER
from reportlab.pdfgen import canvas

PATH = "/home/user/myproject/data/invoice.pdf"
c = canvas.Canvas(PATH, pagesize=LETTER)
width, height = LETTER

y = height - 72
c.setFont("Helvetica-Bold", 18)
c.drawString(72, y, "INVOICE")
y -= 28

c.setFont("Helvetica", 11)
c.drawString(72, y, "Vendor: Acme Office Supplies, Inc.")
y -= 16
c.drawString(72, y, "Invoice Number: INV-2024-00042")
y -= 16
c.drawString(72, y, "Invoice Date: 2024-08-15")
y -= 16
c.drawString(72, y, "Bill To: Globex Corporation, 1 Main St., Springfield")
y -= 28

c.setFont("Helvetica-Bold", 12)
c.drawString(72, y, "Line Items")
y -= 18
c.setFont("Helvetica", 11)
for line in [
    "1. Ergonomic Office Chair - $245.00",
    "2. Standing Desk (Adjustable) - $499.00",
    "3. Wireless Keyboard and Mouse Combo - $89.50",
    "4. 27\" 4K Monitor - $389.00",
]:
    c.drawString(90, y, line)
    y -= 16

y -= 12
c.setFont("Helvetica-Bold", 12)
c.drawString(72, y, "Subtotal: $1,222.50")
y -= 16
c.drawString(72, y, "Tax (7%): $85.58")
y -= 16
c.drawString(72, y, "Total Amount: $1,308.08")

c.showPage()
c.save()
print("Wrote", PATH)
PY

LABEL Author="generate-harbor-tasks"
LABEL Description="LlamaCloud parse-then-extract chain task environment with a pre-generated sample invoice PDF and llama-cloud v2 Python SDK installed."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - llama-cloud (v2 LlamaCloud Python SDK), pydantic, reportlab installed via pip3
#   - /home/user/myproject: project root for the task
#   - /home/user/myproject/data/invoice.pdf: pre-generated sample invoice PDF used as the task input
