FROM ubuntu:24.04

RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep && \
    pip3 install --break-system-packages \
        pytest-json-ctrf \
        "llama-cloud>=2,<3" \
        reportlab && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN mkdir -p /home/user && chmod 0755 /home/user

RUN mkdir -p /home/user/extract_task/data

RUN python3 - <<'PY'
from reportlab.lib.pagesizes import LETTER
from reportlab.pdfgen import canvas

pdf_path = "/home/user/extract_task/data/invoice.pdf"
c = canvas.Canvas(pdf_path, pagesize=LETTER)
width, height = LETTER

c.setFont("Helvetica-Bold", 18)
c.drawString(72, height - 72, "INVOICE")

c.setFont("Helvetica", 11)
c.drawString(72, height - 110, "Invoice Number: INV-2026-00042")
c.drawString(72, height - 128, "Issue Date: 2026-03-14")
c.drawString(72, height - 146, "Due Date: 2026-04-13")

c.setFont("Helvetica-Bold", 12)
c.drawString(72, height - 180, "Vendor:")
c.setFont("Helvetica", 11)
c.drawString(72, height - 198, "Acme Cloud Services, Inc.")
c.drawString(72, height - 214, "123 Market Street, San Francisco, CA 94103")
c.drawString(72, height - 230, "billing@acmecloud.example")

c.setFont("Helvetica-Bold", 12)
c.drawString(320, height - 180, "Bill To:")
c.setFont("Helvetica", 11)
c.drawString(320, height - 198, "Globex Corporation")
c.drawString(320, height - 214, "456 Industrial Way, Springfield, IL 62701")

c.setFont("Helvetica-Bold", 11)
c.drawString(72, height - 274, "Description")
c.drawString(330, height - 274, "Quantity")
c.drawString(410, height - 274, "Unit Price")
c.drawString(500, height - 274, "Amount")

c.setFont("Helvetica", 11)
rows = [
    ("LlamaParse Enterprise license (monthly)", "1", "$1,200.00", "$1,200.00"),
    ("Extract API credits (50,000 docs)", "1", "$ 750.00",  "$  750.00"),
    ("Premium support hours",                  "5", "$ 150.00",  "$  750.00"),
]
y = height - 296
for desc, qty, unit, amt in rows:
    c.drawString(72, y, desc)
    c.drawString(330, y, qty)
    c.drawString(410, y, unit)
    c.drawString(500, y, amt)
    y -= 18

c.setFont("Helvetica-Bold", 11)
c.drawString(410, y - 18, "Subtotal:")
c.drawString(500, y - 18, "$2,700.00")
c.drawString(410, y - 36, "Tax (8.875%):")
c.drawString(500, y - 36, "$  239.63")
c.drawString(410, y - 60, "Grand Total:")
c.drawString(500, y - 60, "$2,939.63")

c.setFont("Helvetica-Oblique", 10)
c.drawString(72, 96, "Payment Terms: Net 30. Make checks payable to Acme Cloud Services, Inc.")
c.drawString(72, 82, "Thank you for your business!")

c.showPage()
c.save()
PY

LABEL Author="generate-harbor-tasks"
LABEL Description="LlamaCloud LlamaExtract task: auto-generate a JSON Schema from a prompt and run extraction on a sample invoice PDF using the Python SDK."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - LlamaCloud v2 SDK installed via pip3 (llama-cloud>=2,<3)
#   - reportlab installed via pip3 (used at build time to generate the sample invoice PDF)
#   - /home/user/extract_task: project directory for the task
#   - /home/user/extract_task/data/invoice.pdf: sample invoice PDF for extraction
