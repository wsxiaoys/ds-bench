FROM ubuntu:24.04

RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep && \
    curl -fsSL https://deb.nodesource.com/setup_24.x | bash - && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends nodejs && \
    pip3 install --break-system-packages pytest-json-ctrf requests reportlab && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN mkdir -p /home/user && chmod 0755 /home/user
RUN mkdir -p /home/user/parse-task

# Generate a small, deterministic 1-page text PDF used as the parse input.
RUN python3 - <<'PYEOF'
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas

path = "/home/user/parse-task/sample.pdf"
c = canvas.Canvas(path, pagesize=letter)
c.setTitle("LlamaCloud Parse Sample Document")
c.setFont("Helvetica-Bold", 18)
c.drawString(72, 720, "LlamaCloud Parse Sample Document")
c.setFont("Helvetica", 12)
lines = [
    "This is a small sample PDF used to exercise the LlamaCloud Parse API.",
    "",
    "Goals of this document:",
    "  - Demonstrate uploading a PDF with the @llamaindex/llama-cloud TypeScript SDK.",
    "  - Demonstrate running a parse job at the cost_effective tier.",
    "  - Demonstrate writing the markdown output and job metadata to disk.",
    "",
    "The document deliberately uses plain text and no complex tables or images,",
    "so the cost_effective tier is appropriate.",
]
y = 680
for line in lines:
    c.drawString(72, y, line)
    y -= 18
c.showPage()
c.save()
print("Wrote", path)
PYEOF

LABEL Author="generate-harbor-tasks"
LABEL Description="LlamaCloud Parse TypeScript SDK task: Node.js v24, Python verifier tooling, a prebuilt sample.pdf, and an empty TypeScript project workspace at /home/user/parse-task."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - additional pip3 packages: requests (for verifier HTTP calls to the LlamaCloud REST API), reportlab (build-time only, to generate sample.pdf)
#   - Node.js v24 (for npm/npx/tsx and @llamaindex/llama-cloud TypeScript SDK)
#   - /home/user/parse-task: empty project workspace (the executor will populate parse.ts, package.json, node_modules, and output/)
#   - /home/user/parse-task/sample.pdf: prebuilt 1-page text PDF used as the parse input
