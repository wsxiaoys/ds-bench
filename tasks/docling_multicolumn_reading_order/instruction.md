# Reconstruct Multi-Column Human Reading Order from Layout Provenance

## Background
Scientific papers, magazines and reports are frequently typeset in multiple text columns, sometimes mixing full-width spanning elements (a title, a banner) with 2-column body text, and always decorated with running page headers, page footers and page numbers. When such a PDF is parsed, the raw geometry of every text block (its page, its bounding box, the page dimensions) is available, but a naive top-to-bottom / left-to-right scan interleaves the columns and destroys the intended reading flow.

You are given a locally generated, multi-page PDF (`assets/report.pdf`, already present in the project) that contains 2-column pages, a mixed page with a full-width spanning title above a 2-column body, and a single-column page, plus running headers/footers/page-numbers. Using the document library `docling` (version `2.107.0`, already installed) you must parse the PDF **fully offline** and, relying only on layout provenance (bounding boxes and page geometry), reconstruct the true human reading order across columns.

## Requirements
- Parse `assets/report.pdf` with `docling` running fully offline (all model weights are pre-baked into the image; no network access is available at run time).
- For every page, determine how many body text columns the page has, assign each body text element to a column, and order the elements into the correct human reading order: any full-width spanning element first (top-to-bottom), then the entire leftmost column top-to-bottom, then the next column to its right, and so on.
- Running page headers, page footers and standalone page numbers must be excluded from the reconstructed reading order entirely.
- Emit a machine-readable per-page description and a single linearized plain-text rendering of the whole document in true reading order.

## Implementation Hints
- Project path: `/home/user/reading_order`
- Input document: `assets/report.pdf` (resolved against the project path; already generated).
- Command: `python3 main.py` (runnable from the project path; it must be re-runnable and deterministic, regenerating all outputs from scratch each time).
- The conversion must run without any network access. The pre-baked model artifacts are available in the image and referenced by the `DOCLING_ARTIFACTS_PATH` environment variable that is already set.
- Write two output files under `/home/user/reading_order/output/` (create the directory if needed):
  - `output/pages.json` — a UTF-8 JSON object with a single top-level key `"pages"` whose value is a list of page objects ordered by ascending page number. Each page object has exactly these keys:
    - `"page_no"`: integer, 1-based page number.
    - `"column_count"`: integer >= 1, the number of body text columns detected on that page (full-width spanning elements do not count as a column).
    - `"elements"`: a list of the page's kept text elements in reading order. Each element object has exactly these keys:
      - `"id"`: string, the element's `DoclingDocument` self-reference (e.g. `"#/texts/12"`).
      - `"column"`: integer, 0-based column index, `0` = leftmost. Full-width spanning elements use column `0`.
      - `"bbox"`: a list of four numbers `[l, t, r, b]` in PDF points using a top-left coordinate origin, so that `l < r` and `t < b` (smaller `t` means higher up the page).
  - `output/reading_order.txt` — a UTF-8 plain-text file: the text of every kept element, taken across all pages in ascending page order and, within each page, in the exact same order as that page's `"elements"` list, joined by a single newline (`\n`) between consecutive elements.
- Ordering invariants that the reconstructed order must satisfy, per page: the `"column"` values in `"elements"` are non-decreasing (all of one column is emitted before any element of a column further right), and within a single column the elements are ordered by increasing `"bbox"` top coordinate (top-to-bottom).
- Every `"bbox"` must lie within its page's dimensions (within a small rounding tolerance).

