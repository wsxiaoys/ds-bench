FROM ubuntu:24.04

RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep && \
    curl -fsSL https://deb.nodesource.com/setup_24.x | bash - && \
    apt-get install -y --no-install-recommends nodejs && \
    pip3 install --break-system-packages pytest-json-ctrf reportlab && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN mkdir -p /home/user && chmod 0755 /home/user
RUN mkdir -p /home/user/myproject/invoices

# Seed three invoice PDFs whose ground-truth content the verifier checks.
RUN python3 - <<'PY'
from reportlab.lib.pagesizes import LETTER
from reportlab.pdfgen import canvas

INVOICES = [
    {
        "path": "/home/user/myproject/invoices/acme.pdf",
        "vendor": "Acme Corporation",
        "address": "123 Roadrunner Ave, Albuquerque, NM 87101, USA",
        "invoice_number": "INV-1001",
        "date": "2026-01-15",
        "due_date": "2026-02-15",
        "currency_symbol": "$",
        "currency_code": "USD",
        "line_items": [
            ("Anvil, premium grade", 2, 400.00),
            ("Rocket-powered skates", 1, 234.56),
            ("Rope, 50ft", 4, 50.00),
        ],
        "total": 1234.56,
    },
    {
        "path": "/home/user/myproject/invoices/globex.pdf",
        "vendor": "Globex Industries",
        "address": "742 Evergreen Terrace, Springfield, OR, USA",
        "invoice_number": "INV-2002",
        "date": "2026-02-01",
        "due_date": "2026-03-03",
        "currency_symbol": "EUR ",
        "currency_code": "EUR",
        "line_items": [
            ("Industrial widget kit", 10, 500.00),
            ("Quantum capacitor", 3, 1450.00),
            ("Service contract (annual)", 1, 526.50),
        ],
        "total": 9876.50,
    },
    {
        "path": "/home/user/myproject/invoices/initech.pdf",
        "vendor": "Initech LLC",
        "address": "Office Space Tower, Austin, TX 78701, UK Branch",
        "invoice_number": "INV-3003",
        "date": "2026-03-09",
        "due_date": "2026-04-09",
        "currency_symbol": "GBP ",
        "currency_code": "GBP",
        "line_items": [
            ("TPS report cover sheet pack", 2, 14.00),
            ("Stapler (red Swingline)", 1, 14.00),
        ],
        "total": 42.00,
    },
]

for inv in INVOICES:
    c = canvas.Canvas(inv["path"], pagesize=LETTER)
    width, height = LETTER
    y = height - 60

    c.setFont("Helvetica-Bold", 18)
    c.drawString(50, y, "INVOICE")
    y -= 30

    c.setFont("Helvetica", 12)
    c.drawString(50, y, f"Vendor: {inv['vendor']}")
    y -= 18
    c.drawString(50, y, f"Address: {inv['address']}")
    y -= 18
    c.drawString(50, y, f"Invoice Number: {inv['invoice_number']}")
    y -= 18
    c.drawString(50, y, f"Issue Date: {inv['date']}")
    y -= 18
    c.drawString(50, y, f"Due Date: {inv['due_date']}")
    y -= 18
    c.drawString(50, y, f"Currency: {inv['currency_code']}")
    y -= 30

    c.setFont("Helvetica-Bold", 12)
    c.drawString(50, y, "Description")
    c.drawString(330, y, "Qty")
    c.drawString(390, y, "Unit Price")
    c.drawString(490, y, "Line Total")
    y -= 14
    c.line(50, y, 560, y)
    y -= 16

    c.setFont("Helvetica", 12)
    for desc, qty, unit in inv["line_items"]:
        line_total = qty * unit
        c.drawString(50, y, desc)
        c.drawString(330, y, str(qty))
        c.drawString(390, y, f"{inv['currency_symbol']}{unit:,.2f}")
        c.drawString(490, y, f"{inv['currency_symbol']}{line_total:,.2f}")
        y -= 18

    y -= 14
    c.line(50, y, 560, y)
    y -= 22
    c.setFont("Helvetica-Bold", 14)
    c.drawString(380, y, "TOTAL DUE")
    c.drawString(490, y, f"{inv['currency_symbol']}{inv['total']:,.2f}")

    y -= 40
    c.setFont("Helvetica-Oblique", 10)
    c.drawString(
        50,
        y,
        f"Please remit {inv['currency_symbol']}{inv['total']:,.2f} ({inv['currency_code']}) "
        f"to {inv['vendor']} by {inv['due_date']}.",
    )

    c.showPage()
    c.save()
PY

LABEL Author="generate-harbor-tasks"
LABEL Description="LlamaCloud batch extraction (TypeScript SDK) task environment with Node.js v24 and three seeded invoice PDFs in /home/user/myproject/invoices."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - reportlab pip package (build-time only; used to generate seeded invoice PDFs)
#   - Node.js v24 (>=20 required for @llamaindex/llama-cloud TypeScript SDK)
#   - /home/user/myproject: project directory the executor will work in
#   - /home/user/myproject/invoices/{acme,globex,initech}.pdf: three seeded invoice PDFs
