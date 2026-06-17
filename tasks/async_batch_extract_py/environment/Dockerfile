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

# Generate three deterministic sample invoice PDFs at build time using reportlab.
# Each invoice has a distinct vendor name and invoice number to make extraction
# results easy to distinguish in downstream tasks.
RUN python3 - <<'PY'
from reportlab.lib.pagesizes import LETTER
from reportlab.pdfgen import canvas

INVOICES = [
    {
        "path": "/home/user/myproject/data/invoice_a.pdf",
        "vendor": "Acme Office Supplies, Inc.",
        "number": "INV-2024-00042",
        "date": "2024-08-15",
        "bill_to": "Globex Corporation, 1 Main St., Springfield",
        "lines": [
            "1. Ergonomic Office Chair - $245.00",
            "2. Standing Desk (Adjustable) - $499.00",
            "3. Wireless Keyboard and Mouse Combo - $89.50",
            "4. 27\" 4K Monitor - $389.00",
        ],
        "subtotal": "$1,222.50",
        "tax": "$85.58",
        "total": "$1,308.08",
    },
    {
        "path": "/home/user/myproject/data/invoice_b.pdf",
        "vendor": "Bluewave Logistics LLC",
        "number": "INV-2024-00777",
        "date": "2024-09-03",
        "bill_to": "Initech Corp., 200 Tech Ave., Austin",
        "lines": [
            "1. Pallet Shipping (5 pallets) - $1,250.00",
            "2. Customs Clearance Fee - $180.00",
            "3. Cargo Insurance - $95.40",
        ],
        "subtotal": "$1,525.40",
        "tax": "$106.78",
        "total": "$1,632.18",
    },
    {
        "path": "/home/user/myproject/data/invoice_c.pdf",
        "vendor": "Citrus Catering Co.",
        "number": "INV-2024-01231",
        "date": "2024-10-12",
        "bill_to": "Stark Industries, 10880 Malibu Point, Malibu",
        "lines": [
            "1. Corporate Lunch (50 guests) - $850.00",
            "2. Beverage Station - $220.00",
            "3. Dessert Platter - $145.00",
            "4. Service Staff (2 servers, 3h) - $180.00",
        ],
        "subtotal": "$1,395.00",
        "tax": "$97.65",
        "total": "$1,492.65",
    },
]

for inv in INVOICES:
    c = canvas.Canvas(inv["path"], pagesize=LETTER)
    width, height = LETTER
    y = height - 72
    c.setFont("Helvetica-Bold", 18)
    c.drawString(72, y, "INVOICE")
    y -= 28

    c.setFont("Helvetica", 11)
    c.drawString(72, y, f"Vendor: {inv['vendor']}")
    y -= 16
    c.drawString(72, y, f"Invoice Number: {inv['number']}")
    y -= 16
    c.drawString(72, y, f"Invoice Date: {inv['date']}")
    y -= 16
    c.drawString(72, y, f"Bill To: {inv['bill_to']}")
    y -= 28

    c.setFont("Helvetica-Bold", 12)
    c.drawString(72, y, "Line Items")
    y -= 18
    c.setFont("Helvetica", 11)
    for line in inv["lines"]:
        c.drawString(90, y, line)
        y -= 16

    y -= 12
    c.setFont("Helvetica-Bold", 12)
    c.drawString(72, y, f"Subtotal: {inv['subtotal']}")
    y -= 16
    c.drawString(72, y, f"Tax (7%): {inv['tax']}")
    y -= 16
    c.drawString(72, y, f"Total Amount: {inv['total']}")

    c.showPage()
    c.save()
    print("Wrote", inv["path"])
PY

LABEL Author="generate-harbor-tasks"
LABEL Description="LlamaCloud async batch extract task environment with three pre-generated sample invoice PDFs and the llama-cloud v2 Python SDK installed."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - llama-cloud (v2 LlamaCloud Python SDK), pydantic, reportlab installed via pip3
#   - /home/user/myproject: project root for the task
#   - /home/user/myproject/data/invoice_a.pdf, invoice_b.pdf, invoice_c.pdf: pre-generated sample invoice PDFs used as task input
