# Build FROM the official Docling CPU image: torch, docling, docling-serve and
# ALL default model weights (layout, tableformer fast+accurate, ...) are already
# baked in, so the build performs no model downloads and the container runs the
# table-structure recognizer fully offline.
FROM ghcr.io/docling-project/docling-serve-cpu:latest

ARG POCHI_VERSION

# --- System deps: CentOS 9 Stream uses dnf, not apt-get ---
# Stay as root (UID 0) for the whole image so the harness, Pochi CLI, pytest and
# the agent all have unrestricted access. HOME must be reset explicitly: the base
# image exports HOME=/opt/app-root/src, which would otherwise redirect the Pochi
# installer away from /root.
USER 0
ENV HOME=/root
# NOTE: git, wget and curl already ship in the base image - do not reinstall them.
RUN dnf config-manager --set-enabled crb \
    && dnf install -y https://dl.fedoraproject.org/pub/epel/epel-release-latest-9.noarch.rpm \
    && dnf install -y --nodocs --setopt=install_weak_deps=False ripgrep \
    && dnf clean all \
    && rm -rf /var/cache/dnf \
    && curl -fsSL https://getpochi.com/install.sh | bash -s ${POCHI_VERSION} \
    && ln -s /root/.pochi/bin/pochi /usr/local/bin/pochi \
    && python -m pip install --no-cache-dir pytest pytest-json-ctrf reportlab

# --- Runtime configuration: point Docling at the pre-baked, read-only weights ---
ENV DOCLING_ARTIFACTS_PATH="/opt/app-root/src/.cache/docling/models"
ENV HF_HUB_OFFLINE=1
ENV TRANSFORMERS_OFFLINE=1

# --- Harbor project directory (must live under /home/user) ---
RUN mkdir -p /home/user/tfbench && chmod -R 0755 /home/user

# --- Deterministic fixture builder (PDFs + machine readable ground truth) ---
RUN mkdir -p /opt/corpus_builder && cat >/opt/corpus_builder/build_corpus.py <<'PYEOF'
"""Deterministic builder for the table-structure benchmark corpus.

Renders small PDFs whose table geometry is known exactly and emits the matching
machine readable ground truth. Used at image build time to create
/home/user/tfbench/corpus and re-usable by tooling that needs extra fixtures.
"""

import argparse
import json
import os

from reportlab.lib.pagesizes import LETTER
from reportlab.pdfgen import canvas

PAGE_WIDTH, PAGE_HEIGHT = LETTER

LEFT_MARGIN = 72.0
TOP_START = 720.0
ROW_HEIGHT = 24.0
FONT_SIZE = 10.0
HEADING_SIZE = 14.0
FONT_REGULAR = "Helvetica"
FONT_BOLD = "Helvetica-Bold"


def _place_cells(rows):
    """Assign grid coordinates to every cell, honouring row/column spans."""
    occupied = set()
    placed = []
    num_cols = 0
    for row_index, row in enumerate(rows):
        col = 0
        for spec in row:
            while (row_index, col) in occupied:
                col += 1
            row_span = int(spec.get("rowspan", 1))
            col_span = int(spec.get("colspan", 1))
            for d_row in range(row_span):
                for d_col in range(col_span):
                    occupied.add((row_index + d_row, col + d_col))
            placed.append(
                {
                    "row": row_index,
                    "col": col,
                    "row_span": row_span,
                    "col_span": col_span,
                    "text": spec.get("text", ""),
                }
            )
            num_cols = max(num_cols, col + col_span)
            col += col_span
    return placed, len(rows), num_cols


def _draw_table(pdf, element, top):
    rows = element["rows"]
    col_widths = [float(width) for width in element["col_widths"]]
    row_height = float(element.get("row_height", ROW_HEIGHT))
    bordered = bool(element.get("bordered", True))
    header_rows = int(element.get("header_rows", 1))

    placed, num_rows, num_cols = _place_cells(rows)
    if len(col_widths) != num_cols:
        raise ValueError(
            "col_widths has %d entries but the grid has %d columns" % (len(col_widths), num_cols)
        )

    offsets = [LEFT_MARGIN]
    for width in col_widths:
        offsets.append(offsets[-1] + width)

    pdf.setLineWidth(0.75)
    gt_cells = []
    for cell in placed:
        x0 = offsets[cell["col"]]
        x1 = offsets[cell["col"] + cell["col_span"]]
        y1 = top - cell["row"] * row_height
        y0 = top - (cell["row"] + cell["row_span"]) * row_height
        if bordered:
            pdf.rect(x0, y0, x1 - x0, y1 - y0, stroke=1, fill=0)
        is_header = cell["row"] < header_rows
        pdf.setFont(FONT_BOLD if is_header else FONT_REGULAR, FONT_SIZE)
        text_y = y0 + (y1 - y0 - FONT_SIZE) / 2.0 + 2.0
        if cell["text"]:
            pdf.drawString(x0 + 6.0, text_y, cell["text"])
        gt_cells.append(
            {
                "row": cell["row"],
                "col": cell["col"],
                "row_span": cell["row_span"],
                "col_span": cell["col_span"],
                "text": cell["text"],
                "is_header": is_header,
            }
        )

    gt_cells.sort(key=lambda item: (item["row"], item["col"]))
    table_gt = {
        "page_no": 1,
        "num_rows": num_rows,
        "num_cols": num_cols,
        "cells": gt_cells,
    }
    return table_gt, top - num_rows * row_height


def write_document(pdf_path, doc_id, elements):
    """Render `elements` into `pdf_path` and return the ground truth mapping."""
    directory = os.path.dirname(os.path.abspath(pdf_path))
    if directory:
        os.makedirs(directory, exist_ok=True)

    pdf = canvas.Canvas(pdf_path, pagesize=LETTER)
    pdf.setTitle(doc_id)
    pdf.setAuthor("tfbench corpus builder")
    pdf.setSubject("table structure benchmark fixture")
    pdf.setCreator("tfbench")
    pdf.setProducer("tfbench")

    cursor = TOP_START
    tables = []
    for element in elements:
        kind = element.get("type")
        if kind == "heading":
            pdf.setFont(FONT_BOLD, float(element.get("size", HEADING_SIZE)))
            pdf.drawString(LEFT_MARGIN, cursor, element["text"])
            cursor -= 34.0
        elif kind == "paragraph":
            pdf.setFont(FONT_REGULAR, FONT_SIZE)
            pdf.drawString(LEFT_MARGIN, cursor, element["text"])
            cursor -= 26.0
        elif kind == "table":
            table_gt, cursor = _draw_table(pdf, element, cursor)
            table_gt["table_index"] = len(tables)
            tables.append(
                {
                    "table_index": table_gt["table_index"],
                    "page_no": table_gt["page_no"],
                    "num_rows": table_gt["num_rows"],
                    "num_cols": table_gt["num_cols"],
                    "cells": table_gt["cells"],
                }
            )
            cursor -= 44.0
        else:
            raise ValueError("unknown element type: %r" % (kind,))

    pdf.showPage()
    pdf.save()

    return {
        "doc_id": doc_id,
        "pdf": os.path.basename(pdf_path),
        "page_count": 1,
        "tables": tables,
    }


def _cells(*texts):
    return [{"text": text} for text in texts]


CORPUS = {
    "grid_basic": [
        {"type": "heading", "text": "Regional Sales Summary"},
        {
            "type": "table",
            "bordered": True,
            "header_rows": 1,
            "col_widths": [110.0, 90.0, 120.0, 90.0],
            "rows": [
                _cells("Region", "Units Sold", "Revenue (USD)", "Net  Margin"),
                _cells("North", "1200", "$45,300", "12.5%"),
                _cells("South", "980", "$31,120", "9.8%"),
                _cells("East", "1543", "$58,940", "14.2%"),
                _cells("West", "762", "$22,015", "7.4%"),
            ],
        },
    ],
    "merged_header": [
        {"type": "heading", "text": "Quarterly Shipments by Product"},
        {
            "type": "table",
            "bordered": True,
            "header_rows": 2,
            "col_widths": [110.0, 75.0, 75.0, 75.0, 75.0],
            "rows": [
                [
                    {"text": "Product", "rowspan": 2},
                    {"text": "FY 2023", "colspan": 2},
                    {"text": "FY 2024", "colspan": 2},
                ],
                _cells("Q1", "Q2", "Q1", "Q2"),
                _cells("Widget", "120", "135", "150", "162"),
                _cells("Gadget", "88", "91", "97", "104"),
                _cells("Doohickey", "45", "52", "61", "70"),
            ],
        },
    ],
    "borderless": [
        {"type": "heading", "text": "Service Level Comparison"},
        {
            "type": "table",
            "bordered": False,
            "header_rows": 1,
            "col_widths": [150.0, 110.0, 110.0],
            "rows": [
                _cells("Metric", "Baseline", "Current"),
                _cells("Latency p95", "220 ms", "180 ms"),
                _cells("Error rate", "1.8%", "0.9%"),
                _cells("Throughput", "410 rps", "505 rps"),
            ],
        },
    ],
    "footer_numeric": [
        {"type": "heading", "text": "Appendix A - Line Items"},
        {
            "type": "table",
            "bordered": True,
            "header_rows": 1,
            "col_widths": [150.0, 90.0, 130.0],
            "rows": [
                _cells("Item", "Qty", "Amount\u00a0(USD)"),
                _cells("Cable", "12", "240.00"),
                _cells("Adapter", "7", "133.50"),
                _cells("Mount", "3", "87.00"),
                [{"text": "Total", "colspan": 2}, {"text": "460.50"}],
            ],
        },
        {"type": "heading", "text": "Appendix B - Notes"},
        {
            "type": "table",
            "bordered": True,
            "header_rows": 1,
            "col_widths": [150.0, 220.0],
            "rows": [
                _cells("Note", "Detail"),
                _cells("A", "Checked"),
                _cells("B", ""),
            ],
        },
    ],
}


def build_corpus(out_dir):
    gt_dir = os.path.join(out_dir, "ground_truth")
    os.makedirs(gt_dir, exist_ok=True)
    summary = {}
    for doc_id in sorted(CORPUS):
        pdf_path = os.path.join(out_dir, doc_id + ".pdf")
        truth = write_document(pdf_path, doc_id, CORPUS[doc_id])
        with open(os.path.join(gt_dir, doc_id + ".json"), "w", encoding="utf-8") as handle:
            json.dump(truth, handle, indent=2, ensure_ascii=False)
            handle.write("\n")
        summary[doc_id] = [
            (table["num_rows"], table["num_cols"], len(table["cells"])) for table in truth["tables"]
        ]
    return summary


def main():
    parser = argparse.ArgumentParser(description="Build the tfbench table corpus")
    parser.add_argument("--out", default="/home/user/tfbench/corpus")
    args = parser.parse_args()
    summary = build_corpus(args.out)
    for doc_id in sorted(summary):
        print(doc_id, summary[doc_id])


if __name__ == "__main__":
    main()
PYEOF

RUN python /opt/corpus_builder/build_corpus.py --out /home/user/tfbench/corpus \
    && chmod -R 0755 /home/user/tfbench \
    && ls -l /home/user/tfbench/corpus

WORKDIR /home/user/tfbench

LABEL Author="generate-harbor-tasks"
LABEL Description="Offline Docling table-structure benchmark environment: docling CPU image with pre-baked TableFormer weights plus a generated PDF corpus and machine readable ground truth in /home/user/tfbench/corpus."

CMD ["/bin/bash", "-c", "trap : TERM INT; sleep infinity & wait"]

# Container contents:
#   - base image ghcr.io/docling-project/docling-serve-cpu:latest (CentOS 9 Stream,
#     Python 3.12 venv on PATH, docling + torch CPU + all default model weights)
#   - dnf packages: ripgrep (git, curl and wget already ship in the base image)
#   - pip packages: pytest, pytest-json-ctrf, reportlab (fixture rendering)
#   - Pochi CLI symlinked to /usr/local/bin/pochi
#   - DOCLING_ARTIFACTS_PATH / HF_HUB_OFFLINE / TRANSFORMERS_OFFLINE force offline model loading
#   - /opt/corpus_builder/build_corpus.py: deterministic PDF + ground truth fixture builder
#   - /home/user/tfbench: project directory (WORKDIR)
#   - /home/user/tfbench/corpus: 4 benchmark PDFs (5 tables) + corpus/ground_truth/*.json

COPY test_initial_state.py /bootstrap/test_initial_state.py

# Setup entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
