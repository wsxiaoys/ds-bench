# Docling Figure/Table Provenance & Caption Cross-Referencing Tool

## Background
`docling` (pinned to v2.107.0) parses a PDF into a structured `DoclingDocument` that exposes per-element layout provenance (page number and bounding box) and can render page and element images. In this task you build a fully offline command-line tool that annotates every figure and every table in a PDF, pairs each visual element with its caption, and emits page renders, per-element crops, and a single machine-readable annotations file.

The container is fully offline and all Docling model weights are pre-baked into the image. The tool MUST NOT perform any network access.

## Requirements
Build a command-line tool that, in a single run over one PDF, does ALL THREE of the following:
1. Renders every page of the PDF to a PNG raster at a caller-specified scale.
2. For every figure and every table in the document, determines its layout provenance (its 1-based page number and its bounding box) and writes a cropped image of that element.
3. Cross-references every figure and every table with its caption and records the caption text together with the element.

In the input PDF, every figure and every table has exactly one single-line caption positioned immediately beneath the visual element it describes, and a single page may contain more than one visual element. The `caption_text` recorded for an element MUST be the caption that belongs to that specific element.

## Implementation Hints
- Project path: /home/user/project
- The Docling model weights are pre-baked into the image; the tool MUST run fully offline (no downloads, no network).
- Command: `python main.py --pdf <pdf_path> --output-dir <dir> --image-scale <float>`
  - `--pdf`: path to the input PDF (may be given relative to the project directory).
  - `--output-dir`: directory into which all artifacts are written; create it (and any needed subdirectories) if absent.
  - `--image-scale`: a positive float controlling the page/element render scale.
- The evaluation input document is `assets/report.pdf` (relative to the project path). Its pages are US-Letter (width 612.0, height 792.0 PDF points).
- Page renders: write exactly one PNG per page to `<output-dir>/pages/page_<N>.png`, where `<N>` is the 1-based page number.
- Element crops: write exactly one PNG per figure/table to `<output-dir>/crops/<element_type>_p<page_no>_<rank>.png`, where `<element_type>` is `figure` (for pictures) or `table`, `<page_no>` is the 1-based page number, and `<rank>` is the 1-based position of the element among all visual elements on that page ordered top-to-bottom.
- Annotations file: write `<output-dir>/annotations.json` as a single JSON object with exactly these top-level keys, in this order:
  - `source_pdf`: string, the exact value passed to `--pdf`.
  - `image_scale`: number, the scale used.
  - `page_count`: integer, the number of pages in the document.
  - `page_images`: array of strings, each a path relative to `<output-dir>`, ordered by ascending page number.
  - `elements`: array of element objects (described below).
- The `elements` array MUST be ordered by ascending `page_no`, and within a page top-to-bottom (ascending `top` coordinate). Each element object MUST have exactly these keys, in this order:
  - `index`: 0-based integer equal to this element's position in the `elements` array.
  - `element_type`: `figure` for pictures, `table` for tables.
  - `page_no`: 1-based integer page number.
  - `bbox`: object with keys `left`, `top`, `right`, `bottom` (in that order), floats in PDF points expressed in a TOP-LEFT page-coordinate origin (origin at the top-left corner of the page). It MUST satisfy `left` < `right` and `top` < `bottom`, and lie within the page dimensions.
  - `coord_origin`: the exact string `TOPLEFT`.
  - `crop_image_path`: the crop path relative to `<output-dir>` (matching the crops naming convention above).
  - `caption_text`: the exact caption text belonging to this element.
- Exit codes: exit `0` on success; exit `2` if the path given to `--pdf` does not exist; exit `3` if `--image-scale` is not a positive number.

