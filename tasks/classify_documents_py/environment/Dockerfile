FROM ubuntu:24.04

RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep && \
    pip3 install --break-system-packages \
        pytest-json-ctrf \
        "llama-cloud>=2.7,<3" \
        reportlab && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN mkdir -p /home/user && chmod 0755 /home/user
RUN mkdir -p /home/user/myproject/fixtures

# Generate the synthetic invoice and contract PDF fixtures used by the
# verification steps. They are produced deterministically at image build time
# using reportlab so the LlamaCloud Classifier has rich, realistic text to
# work with.
RUN python3 - <<'PY'
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    PageBreak,
)
from reportlab.lib import colors

styles = getSampleStyleSheet()
heading = ParagraphStyle(
    "heading",
    parent=styles["Heading1"],
    alignment=1,
    fontSize=20,
    spaceAfter=18,
)
section = ParagraphStyle(
    "section",
    parent=styles["Heading2"],
    fontSize=12,
    spaceAfter=8,
)
body = styles["BodyText"]


# ---------- Invoice PDF ----------
invoice_path = "/home/user/myproject/fixtures/invoice_sample.pdf"
doc = SimpleDocTemplate(
    invoice_path, pagesize=LETTER,
    topMargin=0.6 * inch, bottomMargin=0.6 * inch,
    leftMargin=0.7 * inch, rightMargin=0.7 * inch,
)

story = []
story.append(Paragraph("INVOICE", heading))
story.append(Paragraph("Invoice Number: INV-2025-001", body))
story.append(Paragraph("Invoice Date: 2025-04-15", body))
story.append(Paragraph("Due Date: 2025-05-15", body))
story.append(Spacer(1, 12))

story.append(Paragraph("From:", section))
story.append(Paragraph("Acme Supplies Co.<br/>123 Market Street<br/>Springfield, IL 62701", body))
story.append(Spacer(1, 8))

story.append(Paragraph("Bill To:", section))
story.append(Paragraph("Globex Corporation<br/>500 Industrial Way<br/>Chicago, IL 60601<br/>Attn: Accounts Payable", body))
story.append(Spacer(1, 12))

story.append(Paragraph("Line Items:", section))
data = [
    ["Description", "Quantity", "Unit Price", "Amount"],
    ["Premium widgets, 10-pack", "20", "$15.00", "$300.00"],
    ["Industrial gaskets, 4 in.", "50", "$2.50", "$125.00"],
    ["Maintenance service hours", "8", "$95.00", "$760.00"],
    ["Shipping & handling", "1", "$45.00", "$45.00"],
]
table = Table(data, colWidths=[3.0 * inch, 1.0 * inch, 1.2 * inch, 1.2 * inch])
table.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, 0), colors.lightgrey),
    ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
    ("ALIGN", (1, 1), (-1, -1), "RIGHT"),
]))
story.append(table)
story.append(Spacer(1, 12))

totals = [
    ["Subtotal", "$1,230.00"],
    ["Sales Tax (8%)", "$98.40"],
    ["Total Due", "$1,328.40"],
]
tot_table = Table(totals, colWidths=[4.2 * inch, 1.2 * inch])
tot_table.setStyle(TableStyle([
    ("ALIGN", (0, 0), (-1, -1), "RIGHT"),
    ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
    ("LINEABOVE", (0, -1), (-1, -1), 0.75, colors.black),
]))
story.append(tot_table)
story.append(Spacer(1, 18))
story.append(Paragraph(
    "Payment Terms: Net 30. Please remit payment via ACH or check to "
    "Acme Supplies Co. Reference invoice number INV-2025-001 on all "
    "correspondence.", body))

doc.build(story)


# ---------- Contract PDF ----------
contract_path = "/home/user/myproject/fixtures/contract_sample.pdf"
doc = SimpleDocTemplate(
    contract_path, pagesize=LETTER,
    topMargin=0.6 * inch, bottomMargin=0.6 * inch,
    leftMargin=0.7 * inch, rightMargin=0.7 * inch,
)

story = []
story.append(Paragraph("SERVICES AGREEMENT", heading))
story.append(Paragraph(
    "This Services Agreement (the &quot;Agreement&quot;) is entered into as of "
    "April 15, 2025 (the &quot;Effective Date&quot;), by and between Acme Corp., "
    "a Delaware corporation with its principal place of business at 123 Market "
    "Street, Springfield, IL 62701 (&quot;Client&quot;), and Beta LLC, a New "
    "York limited liability company with its principal place of business at "
    "789 Park Avenue, New York, NY 10021 (&quot;Provider&quot;). Client and "
    "Provider may be referred to herein individually as a &quot;Party&quot; "
    "and collectively as the &quot;Parties&quot;.", body))
story.append(Spacer(1, 12))

story.append(Paragraph("1. Term", section))
story.append(Paragraph(
    "This Agreement shall commence on the Effective Date and continue for a "
    "period of twelve (12) months, unless earlier terminated in accordance "
    "with the provisions of this Agreement. The Agreement may be renewed by "
    "mutual written consent of the Parties.", body))
story.append(Spacer(1, 8))

story.append(Paragraph("2. Services and Payment", section))
story.append(Paragraph(
    "Provider shall perform the professional services described in "
    "Exhibit A (the &quot;Services&quot;) in exchange for the fees set forth "
    "therein. Provider shall invoice Client monthly, and Client shall remit "
    "payment within thirty (30) days of receipt of each invoice.", body))
story.append(Spacer(1, 8))

story.append(Paragraph("3. Confidentiality", section))
story.append(Paragraph(
    "Each Party agrees to maintain in strict confidence all non-public "
    "information disclosed by the other Party in connection with this "
    "Agreement. The obligations of confidentiality shall survive termination "
    "of this Agreement for a period of three (3) years.", body))
story.append(Spacer(1, 8))

story.append(Paragraph("4. Termination", section))
story.append(Paragraph(
    "Either Party may terminate this Agreement upon thirty (30) days prior "
    "written notice to the other Party. In the event of material breach, the "
    "non-breaching Party may terminate immediately upon written notice if "
    "such breach is not cured within fifteen (15) days.", body))
story.append(Spacer(1, 8))

story.append(Paragraph("5. Governing Law", section))
story.append(Paragraph(
    "This Agreement shall be governed by and construed in accordance with "
    "the laws of the State of Delaware, without regard to its conflict of "
    "laws principles.", body))
story.append(Spacer(1, 16))

story.append(Paragraph(
    "IN WITNESS WHEREOF, the Parties have executed this Agreement as of the "
    "Effective Date.", body))
story.append(Spacer(1, 24))

sig = [
    ["CLIENT: Acme Corp.", "PROVIDER: Beta LLC"],
    ["By: ____________________", "By: ____________________"],
    ["Name: Jane Doe", "Name: John Smith"],
    ["Title: Chief Executive Officer", "Title: Managing Partner"],
    ["Date: __________________", "Date: __________________"],
]
sig_table = Table(sig, colWidths=[3.0 * inch, 3.0 * inch])
sig_table.setStyle(TableStyle([
    ("VALIGN", (0, 0), (-1, -1), "TOP"),
]))
story.append(sig_table)

doc.build(story)
PY

LABEL Author="generate-harbor-tasks"
LABEL Description="LlamaCloud Classifier (Python) task environment with the llama-cloud SDK and pre-built invoice/contract PDF fixtures."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - llama-cloud (>=2.7) Python SDK for the LlamaCloud Classifier task
#   - reportlab for generating synthetic PDF fixtures at image-build time
#   - /home/user/myproject: project root the executor will work from
#   - /home/user/myproject/fixtures/invoice_sample.pdf: synthetic invoice fixture
#   - /home/user/myproject/fixtures/contract_sample.pdf: synthetic services agreement fixture
