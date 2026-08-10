# Multimodal Asset Extraction from a PDF with Docling

## Background
You are building the document-ingestion stage of a Retrieval-Augmented Generation pipeline. Downstream consumers need not only the text of a source PDF but also every structured and visual asset it contains: its tables (as both machine-readable data and rich markup), crops of every figure, high-resolution renders of every page, and a Markdown rendering whose images live as real files on disk (so they can be served independently) rather than being inlined.

You must implement this extraction using **Docling** (`docling` version `2.107.0`), which is pre-installed together with all of its default AI models. The environment is fully offline: no network access, no external APIs, and no model downloads are permitted — only the models already baked into the image may be used.

## Requirements
- Convert the input PDF at `assets/report.pdf` (relative to the project path) into Docling's structured document model and mine its multimodal assets.
- Every **table** in the document must be exported in **both** of the following formats:
  - `output/table_<n>.csv` — the table's tabular data as CSV.
  - `output/table_<n>.html` — the same table as an HTML `<table>`.
- Every **picture / figure** in the document must be exported as a **cropped raster image** (only the figure region, not the whole page) to `output/picture_<n>.png`.
- Every **page** of the document must be rendered to `output/page_<n>.png` at **2x scale (approximately 144 DPI)** — i.e. at a materially higher resolution than the pipeline's default page rendering.
- Produce `output/document.md`: the full Markdown serialization of the converted document in which images are **externally referenced** — the Markdown must point to image files stored on disk (standard Markdown image references) and must **NOT** embed images as inline base64 `data:` URIs.

## Implementation Hints
- Project path: `/home/user/project`
- Input document: `/home/user/project/assets/report.pdf` (already present; do not modify or regenerate it).
- Command: `python main.py` (run from the project path). Running it must (re)produce all outputs described below from scratch.
- All generated artifacts must be written under `/home/user/project/output/`.
- Indices `<n>` are **1-based** and follow the document's natural reading order: `table_1`, `table_2`, … for tables in the order they appear; `picture_1`, `picture_2`, … for figures in the order they appear. For pages, `<n>` is the 1-based page number (`page_1` for the first page, and so on).
- For every table index `n` that exists, **both** `output/table_<n>.csv` and `output/table_<n>.html` must exist and be non-empty; `output/table_<n>.html` must contain an HTML table (a `<table>` element).
- Each `output/picture_<n>.png` must be a valid PNG containing only the cropped figure (substantially smaller than a full rendered page).
- Each `output/page_<n>.png` must be a valid PNG whose pixel dimensions reflect the 2x (~144 DPI) render — clearly larger than a default (~72 DPI) render of the same page would produce.
- `output/document.md` must contain at least one Markdown image reference whose target is a file path (not a `data:` URI), the referenced image file(s) must actually exist on disk, and the file must contain no base64 `data:image` payloads.
- The offline, pre-baked Docling models must be used; do not attempt any network access or model downloads.
