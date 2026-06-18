FROM ubuntu:24.04

RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep && \
    pip3 install --break-system-packages \
        pytest-json-ctrf \
        "llama-cloud>=2.7,<3" \
        reportlab \
        requests && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN mkdir -p /home/user && chmod 0755 /home/user
RUN mkdir -p /home/user/myproject

# Generate a small multi-page PDF for the task input.
RUN python3 - <<'PY'
from reportlab.lib.pagesizes import LETTER
from reportlab.pdfgen import canvas

OUT = "/home/user/myproject/input.pdf"

pages = [
    {
        "title": "Quarterly Operations Summary",
        "lines": [
            "ACME Robotics delivered 1,284 industrial units in Q3 2026,",
            "an increase of 18.6% year-over-year. Manufacturing throughput",
            "rose to 94.2% utilization, exceeding the 88% target set in March.",
            "Net revenue from the robotics segment reached $42.7M, while",
            "operating costs held steady at $28.1M, yielding a 34.2% margin.",
            "Customer satisfaction surveys returned an average score of 4.7/5",
            "across 312 enterprise accounts in North America and Europe.",
        ],
    },
    {
        "title": "Research and Development Highlights",
        "lines": [
            "The vision-systems team open-sourced its calibration toolkit",
            "and published two peer-reviewed papers on neural depth estimation.",
            "Prototype build P-44 achieved 0.18 mm positioning accuracy under",
            "stress tests, surpassing the design specification of 0.25 mm.",
            "The autonomous-navigation working group migrated to ROS 2 Iron",
            "and reduced average planning latency from 142 ms to 87 ms.",
            "Twelve provisional patents were filed during the quarter.",
        ],
    },
    {
        "title": "Outlook and Risks",
        "lines": [
            "We expect Q4 deliveries to grow 12-15% sequentially as the new",
            "Tucson assembly line ramps to full capacity. Supply-chain risk",
            "remains elevated for high-precision LiDAR modules; alternate",
            "sourcing from two new vendors is being qualified this quarter.",
            "Currency headwinds from the EUR/USD pair could reduce reported",
            "revenue by approximately 1.4% if current rates persist.",
            "We reiterate full-year guidance of $165M-$172M in segment revenue.",
        ],
    },
]

c = canvas.Canvas(OUT, pagesize=LETTER)
width, height = LETTER
for page in pages:
    c.setFont("Helvetica-Bold", 18)
    c.drawString(72, height - 90, page["title"])
    c.setFont("Helvetica", 12)
    y = height - 130
    for line in page["lines"]:
        c.drawString(72, y, line)
        y -= 18
    c.setFont("Helvetica-Oblique", 10)
    c.drawString(72, 60, "ACME Robotics - Internal - Q3 2026 Report")
    c.showPage()
c.save()
print(f"Wrote {OUT}")
PY

LABEL Author="generate-harbor-tasks"
LABEL Description="LlamaCloud (LlamaParse) Python SDK task environment for parsing a PDF and extracting per-page screenshot images."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - llama-cloud>=2.7 (Python v2 SDK) for LlamaCloud Parse API
#   - reportlab for generating the input PDF at build time
#   - requests for downloading image assets in verification helpers if needed
#   - /home/user/myproject: working directory
#   - /home/user/myproject/input.pdf: 3-page sample PDF used as parse input
