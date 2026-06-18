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

RUN mkdir -p /home/user/myproject/input

# Generate a deterministic 3-page sample PDF so the executor can verify that
# target_pages="1-2" really limits parsing to the first two pages.
RUN python3 - <<'PY'
from reportlab.lib.pagesizes import LETTER
from reportlab.pdfgen import canvas

path = "/home/user/myproject/input/sample.pdf"
c = canvas.Canvas(path, pagesize=LETTER)
pages = [
    ("Page One - Introduction", [
        "Welcome to the LlamaCloud Parse demo document.",
        "This first page introduces the structure of the report.",
        "It contains plain prose suitable for the cost_effective tier.",
    ]),
    ("Page Two - Key Findings", [
        "Section 2 summarizes the key findings of the analysis.",
        "Revenue grew by 12 percent compared to the previous quarter.",
        "Customer satisfaction scores reached an all-time high.",
    ]),
    ("Page Three - Appendix", [
        "This page is intentionally past the requested page range.",
        "If parsing is correctly limited to pages 1 and 2,",
        "the content of this page should not appear in the output.",
    ]),
]
for title, lines in pages:
    c.setFont("Helvetica-Bold", 18)
    c.drawString(72, 720, title)
    c.setFont("Helvetica", 12)
    y = 680
    for line in lines:
        c.drawString(72, y, line)
        y -= 24
    c.showPage()
c.save()
PY

LABEL Author="generate-harbor-tasks"
LABEL Description="LlamaCloud Parse v2 (Python SDK) environment with a 3-page sample PDF for page-range tasks."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - llama-cloud (v2 Python SDK) for the LlamaCloud Parse task
#   - reportlab to generate the sample PDF at build time
#   - /home/user/myproject: project directory for the task
#   - /home/user/myproject/input/sample.pdf: 3-page sample PDF input
