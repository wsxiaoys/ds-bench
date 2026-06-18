FROM ubuntu:24.04

RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep && \
    pip3 install --break-system-packages \
        pytest-json-ctrf \
        "llama-cloud>=2.7" \
        pydantic \
        reportlab && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN mkdir -p /home/user && chmod 0755 /home/user
RUN mkdir -p /home/user/myproject

# Generate the synthetic resume PDF that the executor will extract from.
RUN python3 - <<'PYEOF'
from reportlab.lib.pagesizes import LETTER
from reportlab.pdfgen import canvas

path = "/home/user/myproject/resume.pdf"
c = canvas.Canvas(path, pagesize=LETTER)
width, height = LETTER

y = height - 72
c.setFont("Helvetica-Bold", 18)
c.drawString(72, y, "Alex Johnson")
y -= 24

c.setFont("Helvetica", 11)
c.drawString(72, y, "Email: alex.johnson@example.com")
y -= 16
c.drawString(72, y, "Phone: +1 (415) 555-0143")
y -= 16
c.drawString(72, y, "Location: San Francisco, CA")
y -= 28

c.setFont("Helvetica-Bold", 13)
c.drawString(72, y, "Summary")
y -= 18
c.setFont("Helvetica", 11)
for line in [
    "Senior software engineer with 8+ years of experience building data-intensive",
    "platforms and machine learning systems for distributed environments.",
]:
    c.drawString(72, y, line)
    y -= 14

y -= 14
c.setFont("Helvetica-Bold", 13)
c.drawString(72, y, "Skills")
y -= 18
c.setFont("Helvetica", 11)
skills = [
    "- Python",
    "- Machine Learning",
    "- SQL",
    "- Docker",
    "- Kubernetes",
]
for s in skills:
    c.drawString(82, y, s)
    y -= 14

y -= 14
c.setFont("Helvetica-Bold", 13)
c.drawString(72, y, "Experience")
y -= 18
c.setFont("Helvetica", 11)
for line in [
    "Acme Cloud Systems (2020 - Present) - Staff Engineer",
    "  - Designed a Kubernetes-based feature store serving 5B requests/day.",
    "  - Built Python and SQL pipelines feeding a real-time ML platform.",
    "Globex Data Inc. (2016 - 2020) - Senior Engineer",
    "  - Migrated legacy ETL jobs to Dockerized microservices.",
]:
    c.drawString(72, y, line)
    y -= 14

c.showPage()
c.save()
PYEOF

LABEL Author="generate-harbor-tasks"
LABEL Description="LlamaCloud Extract (Python v2 SDK) task environment with a pre-built sample resume PDF."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - always required apt packages: curl wget ca-certificates git python3 python3-pip python3-pytest bash ripgrep
#   - always required pip3 packages: pytest-json-ctrf
#   - llama-cloud (v2 Python SDK) for the LlamaCloud Extract task
#   - pydantic for defining the Resume extraction schema
#   - reportlab used at build time to generate /home/user/myproject/resume.pdf
#   - /home/user/myproject: project directory containing the synthetic resume.pdf
