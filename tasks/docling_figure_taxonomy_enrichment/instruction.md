# Figure Taxonomy & Caption Cross-Reference Report with Docling

## Background
You are building an offline document-intelligence step for a RAG ingestion pipeline. Given a multi-page PDF that mixes several distinct figures/charts with tables and captions, you must produce a deterministic "figure taxonomy" report: every detected picture is categorized by a document-figure classification model, cross-referenced with its nearest caption, located on the page, and exported as a cropped image.

The environment is fully offline. `docling` `v2.107.0` is pre-installed together with all default model weights (layout, table structure, and the picture/figure classifier). No network access is available at any time; do not download any model or data.

## Requirements
- Convert the input PDF `assets/report.pdf` with Docling, with the picture/figure **classification enrichment** enabled so that every detected picture carries a classification annotation.
- For every detected picture, collect: its predicted class label and the corresponding confidence, the page it appears on, its normalized bounding box, and the nearest caption/associated text (following reading order / provenance).
- Crop and save each picture as its own PNG image, rendered at an image scale of `2.0`.
- Emit a machine-readable taxonomy report (JSON) and a human-readable Markdown summary that groups the figures by their predicted class.

## Implementation Hints
- Project path: `/home/user/project`
- Command: `python3 main.py` (runnable from the project path with no extra arguments; it must be re-runnable and overwrite prior outputs).
- Input document: `assets/report.pdf` (already present under the project path).
- The program MUST run entirely offline using only the locally cached models.
- Write exactly these output artifacts (paths relative to the project path):
  - `output/taxonomy_report.json`
  - `output/taxonomy_summary.md`
  - Cropped picture PNGs under `output/figures/`.
- `output/taxonomy_report.json` MUST be a single JSON object with exactly these top-level keys:
  - `source_pdf` (string): the relative path to the converted PDF, i.e. `assets/report.pdf`.
  - `figure_count` (integer): the total number of pictures detected in the document.
  - `figures` (object): keyed by the figure's zero-based index as a decimal string (`"0"`, `"1"`, ...), assigned in the document reading order in which the pictures occur. It MUST contain exactly `figure_count` entries.
- Each entry in `figures` MUST be a JSON object with exactly these keys:
  - `class_label` (string): the predicted class name of the picture's top (highest-confidence) classification prediction, recorded verbatim as produced by the model (do not rename, translate, or re-case it).
  - `confidence` (number): the confidence of that top prediction, a float in the inclusive range `[0.0, 1.0]`.
  - `page_no` (integer): the 1-based page number on which the picture appears.
  - `bbox` (object): the picture's bounding box normalized against its page dimensions, with exactly the keys `x0`, `y0`, `x1`, `y1`. Every value MUST be a float in `[0.0, 1.0]`, and the box MUST satisfy `x0 < x1` and `y0 < y1` (i.e. `x0,y0` is the minimum corner and `x1,y1` the maximum corner).
  - `caption` (string): the text of the picture's nearest/associated caption. Use the empty string `""` when the picture has no caption.
  - `image_path` (string): the path (relative to the project path) of the cropped PNG saved for this picture; the file MUST exist and be a valid PNG.
- `output/taxonomy_summary.md` MUST be a Markdown document that groups the figures by predicted class: for every distinct `class_label` present in the report it MUST contain that label verbatim, and under/alongside it reference each figure belonging to that class by its zero-based index. Every figure index `0..figure_count-1` MUST appear in the summary.
- Do NOT hardcode class labels; report whatever the model predicts.

