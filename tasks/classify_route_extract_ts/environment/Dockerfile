FROM ubuntu:24.04

RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep && \
    curl -fsSL https://deb.nodesource.com/setup_24.x | bash - && \
    apt-get install -y --no-install-recommends nodejs && \
    pip3 install --break-system-packages pytest-json-ctrf "llama-cloud>=2.7,<3" reportlab && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN mkdir -p /home/user && chmod 0755 /home/user

# Create the starter project: package.json, tsconfig, and the inputs folder.
RUN mkdir -p /home/user/myproject/inputs && \
    cd /home/user/myproject && \
    cat >package.json <<'EOF'
{
  "name": "classify-route-extract",
  "version": "1.0.0",
  "type": "module",
  "private": true
}
EOF

RUN cd /home/user/myproject && \
    cat >tsconfig.json <<'EOF'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "Bundler",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  }
}
EOF

# Generate four synthetic but realistic PDFs:
#   - acme_invoice.pdf and globex_invoice.pdf: commercial invoices with
#     invoice number, vendor, line items, and a clear grand total.
#   - services_contract.pdf and nda_contract.pdf: legal agreements with two
#     named parties, an effective date, and a term clause.
RUN cat >/tmp/make_inputs.py <<'PYEOF'
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
from reportlab.lib import colors

styles = getSampleStyleSheet()
title_style = ParagraphStyle(
    "title", parent=styles["Title"], fontSize=20, leading=24, spaceAfter=18
)
h1 = ParagraphStyle(
    "h1", parent=styles["Heading1"], fontSize=14, leading=18, spaceAfter=12
)
body = ParagraphStyle(
    "body", parent=styles["BodyText"], fontSize=11, leading=15, spaceAfter=8
)
small = ParagraphStyle(
    "small", parent=styles["BodyText"], fontSize=10, leading=13, spaceAfter=6
)


def _build_invoice(path, vendor, invoice_number, invoice_date, bill_to, line_items, grand_total):
    story = []
    story.append(Paragraph(vendor, title_style))
    story.append(Paragraph("COMMERCIAL INVOICE", h1))
    story.append(Spacer(1, 0.1 * inch))
    story.append(Paragraph(f"Invoice Number: <b>{invoice_number}</b>", body))
    story.append(Paragraph(f"Invoice Date: {invoice_date}", body))
    story.append(Paragraph(f"Bill To: {bill_to}", body))
    story.append(Spacer(1, 0.2 * inch))
    data = [["Description", "Quantity", "Unit Price (USD)", "Total (USD)"]]
    for li in line_items:
        data.append([li["description"], str(li["quantity"]), f"{li['unit_price']:.2f}", f"{li['total']:.2f}"])
    data.append(["", "", "Grand Total (USD)", f"{grand_total:.2f}"])
    tbl = Table(data, colWidths=[3.2 * inch, 1.0 * inch, 1.4 * inch, 1.2 * inch])
    tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.lightgrey),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.black),
        ("INNERGRID", (0, 0), (-1, -1), 0.25, colors.grey),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTNAME", (2, -1), (-1, -1), "Helvetica-Bold"),
        ("ALIGN", (1, 1), (-1, -1), "RIGHT"),
    ]))
    story.append(tbl)
    story.append(Spacer(1, 0.2 * inch))
    story.append(Paragraph(
        f"Please remit payment within 30 days. The grand total due is "
        f"${grand_total:,.2f} USD. Wire transfers should reference invoice "
        f"number {invoice_number}.",
        small,
    ))
    SimpleDocTemplate(
        path,
        pagesize=LETTER,
        leftMargin=0.75 * inch,
        rightMargin=0.75 * inch,
        topMargin=0.75 * inch,
        bottomMargin=0.75 * inch,
        title=f"{vendor} Invoice {invoice_number}",
        author=vendor,
    ).build(story)


def _build_contract(path, agreement_title, party_a, party_b, effective_date, term_text, body_paragraphs):
    story = []
    story.append(Paragraph(agreement_title, title_style))
    story.append(Spacer(1, 0.15 * inch))
    story.append(Paragraph(
        f"This Agreement (the \"Agreement\") is entered into and made "
        f"effective as of {effective_date} (the \"Effective Date\") by and "
        f"between <b>{party_a}</b> (\"Party A\") and <b>{party_b}</b> "
        f"(\"Party B\"). Party A and Party B are each referred to herein as "
        f"a \"Party\" and collectively as the \"Parties\".",
        body,
    ))
    story.append(Spacer(1, 0.15 * inch))
    story.append(Paragraph("1. Term", h1))
    story.append(Paragraph(
        f"This Agreement shall commence on the Effective Date "
        f"({effective_date}) and continue in full force and effect for a "
        f"term of {term_text}, unless earlier terminated in accordance with "
        f"the provisions herein.",
        body,
    ))
    for i, (heading, text) in enumerate(body_paragraphs, start=2):
        story.append(Paragraph(f"{i}. {heading}", h1))
        story.append(Paragraph(text, body))
    story.append(Spacer(1, 0.2 * inch))
    story.append(Paragraph("Signatures", h1))
    story.append(Paragraph(
        f"IN WITNESS WHEREOF, the Parties have caused this Agreement to be "
        f"executed by their duly authorized representatives as of the "
        f"Effective Date, {effective_date}.",
        body,
    ))
    story.append(Paragraph(f"Party A: {party_a}", body))
    story.append(Paragraph(f"Party B: {party_b}", body))
    SimpleDocTemplate(
        path,
        pagesize=LETTER,
        leftMargin=0.85 * inch,
        rightMargin=0.85 * inch,
        topMargin=0.75 * inch,
        bottomMargin=0.75 * inch,
        title=agreement_title,
        author=f"{party_a} / {party_b}",
    ).build(story)


# --- invoices -----------------------------------------------------------------
_build_invoice(
    "/home/user/myproject/inputs/acme_invoice.pdf",
    vendor="ACME Industrial Supplies, Inc.",
    invoice_number="INV-2024-00781",
    invoice_date="2024-03-15",
    bill_to="Northwind Logistics LLC, 200 Harbor Way, Seattle, WA",
    line_items=[
        {"description": "Heavy-duty pallet jack",       "quantity": 2,  "unit_price": 425.00, "total": 850.00},
        {"description": "Industrial safety gloves (pk 12)", "quantity": 10, "unit_price": 32.50, "total": 325.00},
        {"description": "Steel storage shelving unit",  "quantity": 4,  "unit_price": 199.99, "total": 799.96},
        {"description": "Forklift propane tank refill", "quantity": 6,  "unit_price": 45.00,  "total": 270.00},
    ],
    grand_total=2244.96,
)

_build_invoice(
    "/home/user/myproject/inputs/globex_invoice.pdf",
    vendor="Globex Cloud Services, LLC",
    invoice_number="GLX-INV-99021",
    invoice_date="2024-04-01",
    bill_to="Initech Holdings, 1500 Tech Park Dr., Austin, TX",
    line_items=[
        {"description": "Premium support plan (monthly)", "quantity": 1, "unit_price": 1200.00, "total": 1200.00},
        {"description": "Standard compute instance",      "quantity": 8, "unit_price": 95.00,  "total": 760.00},
        {"description": "Managed object storage (TB)",    "quantity": 5, "unit_price": 23.00,  "total": 115.00},
    ],
    grand_total=2075.00,
)

# --- contracts ----------------------------------------------------------------
_build_contract(
    "/home/user/myproject/inputs/services_contract.pdf",
    agreement_title="MASTER SERVICES AGREEMENT",
    party_a="Stellar Consulting Group, Inc.",
    party_b="Vertex Manufacturing Co.",
    effective_date="2024-01-10",
    term_text="12 months",
    body_paragraphs=[
        ("Scope of Services", "Party A shall provide professional consulting "
         "services to Party B in connection with the modernization of its "
         "internal IT systems, including software architecture review, "
         "implementation planning, and supervised deployment."),
        ("Fees and Payment", "Party B shall pay Party A the fees set forth in "
         "the applicable Statement of Work within thirty (30) days of receipt "
         "of an undisputed invoice."),
        ("Confidentiality", "Each Party agrees to maintain in strict "
         "confidence all Confidential Information disclosed by the other "
         "Party and shall not disclose such information to any third party."),
        ("Termination", "Either Party may terminate this Agreement for "
         "convenience upon thirty (30) days' written notice to the other "
         "Party."),
    ],
)

_build_contract(
    "/home/user/myproject/inputs/nda_contract.pdf",
    agreement_title="MUTUAL NON-DISCLOSURE AGREEMENT",
    party_a="Helios Robotics Corp.",
    party_b="Lumen Aerospace Ltd.",
    effective_date="2024-02-22",
    term_text="24 months",
    body_paragraphs=[
        ("Definition of Confidential Information", "Confidential Information "
         "means all non-public information disclosed by one Party to the "
         "other, whether orally, in writing, or in any other medium, that is "
         "designated as confidential or that reasonably should be understood "
         "to be confidential."),
        ("Obligations of Receiving Party", "Each Party agrees to use the "
         "Confidential Information of the other Party solely for the purpose "
         "of evaluating a potential business relationship and to protect it "
         "with the same degree of care it uses to protect its own "
         "confidential information."),
        ("Return of Materials", "Upon written request, the receiving Party "
         "shall promptly return or destroy all Confidential Information of "
         "the disclosing Party."),
        ("Governing Law", "This Agreement shall be governed by and construed "
         "in accordance with the laws of the State of Delaware."),
    ],
)

# Sanity check at build time.
import os
for f in (
    "/home/user/myproject/inputs/acme_invoice.pdf",
    "/home/user/myproject/inputs/globex_invoice.pdf",
    "/home/user/myproject/inputs/services_contract.pdf",
    "/home/user/myproject/inputs/nda_contract.pdf",
):
    assert os.path.exists(f) and os.path.getsize(f) > 0, f
PYEOF
RUN python3 /tmp/make_inputs.py && rm -f /tmp/make_inputs.py

LABEL Author="generate-harbor-tasks"
LABEL Description="LlamaCloud classify-then-route-then-extract (TypeScript) task environment with four synthetic PDFs (two invoices and two contracts) and Node.js v24."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - Node.js v24 (provides node + npm) for running TypeScript via `npx tsx`
#   - Python `llama-cloud` (v2) SDK used by the verifier to inspect file state
#   - Python `reportlab` used at build time to generate the four synthetic PDFs
#   - /home/user/myproject: starter Node project with package.json + tsconfig.json
#   - /home/user/myproject/inputs/acme_invoice.pdf: synthetic ACME invoice
#   - /home/user/myproject/inputs/globex_invoice.pdf: synthetic Globex invoice
#   - /home/user/myproject/inputs/services_contract.pdf: synthetic MSA
#   - /home/user/myproject/inputs/nda_contract.pdf: synthetic mutual NDA
