FROM ubuntu:24.04

# Base OS packages + Python deps for the verifier + Node.js 22 (LTS) for the TS SDK.
RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep \
        gnupg && \
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends nodejs && \
    pip3 install --break-system-packages \
        pytest-json-ctrf \
        httpx \
        reportlab && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Standard user directory.
RUN mkdir -p /home/user && chmod 0755 /home/user

# Pre-create the TS project, install the v2 LlamaCloud TS SDK + Zod + tsx, and
# generate the deterministic 12-row "products.pdf" the agent must extract from.
RUN mkdir -p /home/user/myproject/data && \
    cd /home/user/myproject && \
    cat >package.json <<'EOF'
{
  "name": "per-table-row-extract-ts",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "dependencies": {
    "@llamaindex/llama-cloud": "^2.4.1",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "tsx": "^4.19.2",
    "typescript": "^5.6.3",
    "@types/node": "^22.9.0"
  }
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
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  }
}
EOF

RUN cd /home/user/myproject && npm install --no-audit --no-fund --loglevel=error

# Deterministic 12-row product catalogue PDF.
RUN cat >/tmp/make_pdf.py <<'PYEOF'
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet

rows = [
    ["P001", "Espresso",       "Beverages", 3.50,  100],
    ["P002", "Latte",          "Beverages", 4.25,   80],
    ["P003", "Granola Bar",    "Snacks",    2.10,  200],
    ["P004", "Chocolate Cookie","Snacks",   1.75,  150],
    ["P005", "Cheese Pizza",   "Meals",    12.99,   30],
    ["P006", "Veggie Wrap",    "Meals",     8.50,   45],
    ["P007", "Caesar Salad",   "Meals",     9.99,   25],
    ["P008", "Bottled Water",  "Beverages", 1.25,  500],
    ["P009", "Mineral Water",  "Beverages", 1.75,  300],
    ["P010", "Apple Juice",    "Beverages", 3.25,  120],
    ["P011", "Trail Mix",      "Snacks",    4.50,   90],
    ["P012", "Mixed Nuts",     "Snacks",    5.75,   60],
]

styles = getSampleStyleSheet()
doc = SimpleDocTemplate(
    "/home/user/myproject/data/products.pdf",
    pagesize=letter,
    leftMargin=40, rightMargin=40, topMargin=40, bottomMargin=40,
)

flow = []
flow.append(Paragraph("Acme Foods 2026 Product Catalogue", styles["Title"]))
flow.append(Spacer(1, 12))
flow.append(Paragraph(
    "The table below lists every SKU currently available from Acme Foods. "
    "Each row contains the product code, product name, product category, "
    "unit price in US dollars, and current stock count.",
    styles["BodyText"],
))
flow.append(Spacer(1, 18))

header = ["Product Code", "Product Name", "Category", "Price (USD)", "Stock"]
data = [header] + [[str(c) for c in r] for r in rows]

tbl = Table(data, hAlign="LEFT", colWidths=[90, 140, 90, 80, 60])
tbl.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#404040")),
    ("TEXTCOLOR",  (0, 0), (-1, 0), colors.white),
    ("FONTNAME",   (0, 0), (-1, 0), "Helvetica-Bold"),
    ("FONTSIZE",   (0, 0), (-1, -1), 10),
    ("BOTTOMPADDING", (0, 0), (-1, 0), 6),
    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.whitesmoke, colors.HexColor("#eaeaea")]),
    ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ("ALIGN",  (3, 1), (4, -1), "RIGHT"),
]))
flow.append(tbl)
flow.append(Spacer(1, 18))
flow.append(Paragraph(
    "All prices listed in USD. Stock counts reflect units on hand at the close of business "
    "on the last day of the fiscal quarter and are refreshed daily.",
    styles["BodyText"],
))

doc.build(flow)
PYEOF
RUN python3 /tmp/make_pdf.py && rm /tmp/make_pdf.py

LABEL Author="generate-harbor-tasks"
LABEL Description="LlamaCloud TS SDK per_table_row extraction task: Node 22 + @llamaindex/llama-cloud + a 12-row product PDF."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - additional pip3 packages: httpx (used by tests/test_final_state.py), reportlab (build-time PDF generator)
#   - Node.js 22 (LTS) for running the TS SDK with `npx tsx`
#   - /home/user/myproject: pre-initialized npm project with @llamaindex/llama-cloud v2 + zod + tsx installed
#   - /home/user/myproject/data/products.pdf: deterministic 12-row product catalogue PDF (P001..P012)
