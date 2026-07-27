# Build FROM the official CPU image: torch, docling, docling-serve and ALL
# default model weights (layout, tableformer, picture_classifier, rapidocr,
# easyocr) plus Tesseract are already baked in — the build does NO model or
# PyTorch downloads and the pipeline runs fully offline.
FROM ghcr.io/docling-project/docling-serve-cpu:latest

ARG POCHI_VERSION

# --- Stay root for the whole image; reset HOME so installers target /root ---
USER 0
ENV HOME=/root

# --- System deps (CentOS 9 Stream / dnf) + Pochi + Python test tooling ---
# git/wget/curl already ship in the base image (do not reinstall). reportlab is
# needed only at build time to deterministically synthesize the fixture PDF.
RUN dnf config-manager --set-enabled crb \
    && dnf install -y https://dl.fedoraproject.org/pub/epel/epel-release-latest-9.noarch.rpm \
    && dnf install -y --nodocs --setopt=install_weak_deps=False \
        tesseract-langpack-spa ripgrep \
    && dnf clean all \
    && rm -rf /var/cache/dnf \
    && curl -fsSL https://getpochi.com/install.sh | bash -s ${POCHI_VERSION} \
    && ln -s /root/.pochi/bin/pochi /usr/local/bin/pochi \
    && python -m pip install --no-cache-dir pytest pytest-json-ctrf reportlab

# --- Runtime configuration: point the docling library at the pre-baked models
# so the two-pass pipeline runs fully offline (absolute base-image path). ---
ENV DOCLING_ARTIFACTS_PATH="/opt/app-root/src/.cache/docling/models"

# --- Harbor project directory (MUST live under /home/user, never /opt/app-root/src) ---
RUN mkdir -p /home/user/project/assets && chmod -R 0755 /home/user

# --- Deterministic build-time fixture: a 4-page PDF with clean programmatic
# text pages (1, 2, 4) and one image-only page (3) whose sentence has NO text
# layer and is recoverable only via OCR. This is a pure PDF-synthesis step, NOT
# a docling conversion, so it never touches the models or the network. ---
RUN python - <<'PY'
import os
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from PIL import Image, ImageDraw, ImageFont

ASSETS = "/home/user/project/assets"
os.makedirs(ASSETS, exist_ok=True)
PDF_PATH = os.path.join(ASSETS, "source.pdf")
SCAN_PATH = os.path.join(ASSETS, "_scan.png")

W, H = letter  # 612 x 792 points


def get_font(size):
    try:
        return ImageFont.load_default(size=size)  # Pillow >= 10.1 scalable default
    except TypeError:
        for p in (
            "/usr/share/fonts/dejavu-sans-fonts/DejaVuSans.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
            "/usr/share/fonts/liberation-sans/LiberationSans-Regular.ttf",
        ):
            if os.path.exists(p):
                return ImageFont.truetype(p, size)
        return ImageFont.load_default()


def wrap(draw, text, font, max_width):
    words = text.split()
    lines, cur = [], ""
    for w in words:
        trial = (cur + " " + w).strip()
        if draw.textlength(trial, font=font) <= max_width:
            cur = trial
        else:
            if cur:
                lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return "\n".join(lines)


def make_image_page(text, path):
    img = Image.new("RGB", (1654, 2339), "white")  # A4 @ ~200 dpi
    draw = ImageDraw.Draw(img)
    font = get_font(90)
    wrapped = wrap(draw, text, font, 1400)
    draw.multiline_text((130, 320), wrapped, fill="black", font=font, spacing=28)
    img.save(path, "PNG")


c = canvas.Canvas(PDF_PATH, pagesize=letter)

# Page 1 (clean programmatic text)
c.setFont("Helvetica", 14)
c.drawString(72, H - 100, "Annual Report - Section One")
c.drawString(72, H - 140, "The quarterly revenue increased by twelve percent.")
c.drawString(72, H - 180, "Growth was steady across all reporting regions.")
c.showPage()

# Page 2 (clean programmatic text)
c.setFont("Helvetica", 14)
c.drawString(72, H - 100, "Annual Report - Section Two")
c.drawString(72, H - 140, "All figures are reported in United States dollars.")
c.drawString(72, H - 180, "Currency conversions used end of period rates.")
c.showPage()

# Page 3 (image-only, no text layer -> must be OCR'd)
make_image_page("The scanned report total is four hundred dollars.", SCAN_PATH)
c.drawImage(SCAN_PATH, 0, 0, width=W, height=H)
c.showPage()

# Page 4 (clean programmatic text)
c.setFont("Helvetica", 14)
c.drawString(72, H - 100, "Annual Report - Section Four")
c.drawString(72, H - 140, "This concludes the annual summary section.")
c.drawString(72, H - 180, "Further details are available upon request.")
c.showPage()

c.save()
assert os.path.getsize(PDF_PATH) > 0
PY

WORKDIR /home/user/project

LABEL Author="generate-harbor-tasks"
LABEL Description="Offline Docling two-pass OCR-gating task: 4-page fixture PDF with clean programmatic pages and one image-only page requiring OCR."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - Base: ghcr.io/docling-project/docling-serve-cpu:latest (docling v2.107.0,
#     torch CPU, pre-baked layout/tableformer/picture_classifier/rapidocr/easyocr
#     weights, Tesseract eng + spa)
#   - dnf: tesseract-langpack-spa, ripgrep
#   - pip (build-time): pytest, pytest-json-ctrf, reportlab
#   - Pochi CLI at /usr/local/bin/pochi
#   - DOCLING_ARTIFACTS_PATH -> pre-baked offline model cache
#   - /home/user/project: task project dir (WORKDIR)
#   - /home/user/project/assets/source.pdf: deterministic 4-page fixture
#     (pages 1,2,4 clean programmatic text; page 3 image-only, OCR-only text)

COPY test_initial_state.py /bootstrap/test_initial_state.py

# Setup entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
