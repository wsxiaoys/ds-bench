# Per-Page Layout Provenance Overlay Renderer (Docling)

## Background
You are working with **Docling** (`docling` v2.107.0, running fully offline on CPU) inside a container that already has all default layout/table/OCR model weights pre-baked. A multi-page, machine-readable PDF is provided at `assets/report.pdf` (relative to the project path). Docling can convert this PDF into a structured document whose every element carries layout **provenance** (a page number and a bounding box in the PDF page's own coordinate system) and can additionally render a raster image of every page.

Your job is to build a debugging/QA tool that, for every page of the document, produces an **annotated overlay image** plus a machine-readable **overlay manifest** describing every layout element drawn on that page. The hard part is mapping each element's provenance bounding box from Docling's document/page coordinate system into the rendered raster's pixel coordinate system **correctly**, so the drawn boxes land exactly on top of the content.

## Requirements
- Convert `assets/report.pdf` with Docling, with page-image rendering enabled at an image scale of exactly **2.0**.
- For **each** page of the resulting document, write two artifacts into the `output/` directory (relative to the project path):
  - An **overlay PNG** that is a copy of that page's rendered raster image with one rectangle drawn per layout element, each rectangle drawn in the color assigned to that element's type, so that every box lands on top of the element it describes.
  - An **overlay manifest JSON** listing every element drawn on that page.
- Consider only the document **body** elements whose type is one of the six supported types below. Every such element that has a provenance box on a given page MUST appear in that page's overlay (both the drawn rectangle and the manifest entry).

## Implementation Hints
- Project path: `/home/user/docling_overlay`
- Input document: `/home/user/docling_overlay/assets/report.pdf` (multi-page, machine-readable). Do not modify it.
- Command: `python3 main.py` (run with the project path as the working directory). Running it must (re)generate all artifacts under `/home/user/docling_overlay/output/`.
- The environment is fully offline: the solution MUST NOT access the network or download any model; rely only on the pre-baked local models.
- **Image scale**: page images must be generated at scale `2.0`.
- **Output file naming** (page numbers are Docling's own 1-based page numbers): for a page numbered `N`, write the overlay image to `output/overlay_page_<N>.png` and the manifest to `output/overlay_page_<N>.json`. Produce exactly one PNG and one JSON per page of the document, and nothing spurious for pages that do not exist.
- **Overlay image dimensions**: each `overlay_page_<N>.png` MUST have exactly the same pixel width and height as the raster image Docling renders for page `N` at scale `2.0`.
- **Coordinate convention for manifest boxes**: every bounding box you record is expressed in the overlay image's raster **pixel** space, with the origin at the **top-left** corner, x increasing to the right and y increasing downward. Each box is a list `[x0, y0, x1, y1]` of numbers with `0 <= x0 < x1 <= image_width` and `0 <= y0 < y1 <= image_height`. Boxes must account for the image scale and for any difference between the document/page coordinate origin and the top-left raster origin, so that a recorded box coincides with the element's true location in the rendered page to within **3 pixels** on each edge.
- **Element id / type**: use the element's Docling self-reference string (e.g. `#/texts/4`) as its `id`, and the element's Docling label string as its `type`. Only these six element types are in scope: `text`, `section_header`, `list_item`, `table`, `picture`, `caption`. Elements of any other type must be ignored entirely (no rectangle, no manifest entry).
- **Color mapping** (exact, case-insensitive hex strings) — every element and its drawn rectangle use the color for its type:
  - `text` -> `#1f77b4`
  - `section_header` -> `#d62728`
  - `list_item` -> `#2ca02c`
  - `table` -> `#ff7f0e`
  - `picture` -> `#9467bd`
  - `caption` -> `#8c564b`
  The color assigned to a type must be identical for every element of that type across all pages, and the rectangle drawn on the overlay PNG for an element must be rendered in that same color.
- **Manifest JSON schema**: each `output/overlay_page_<N>.json` is a single JSON object with keys:
  - `page_no`: integer, the Docling page number `N`.
  - `image_width`: integer, the overlay PNG pixel width.
  - `image_height`: integer, the overlay PNG pixel height.
  - `boxes`: an array; each entry is an object with exactly the keys `id` (string), `type` (string, one of the six types), `bbox` (list `[x0, y0, x1, y1]` of numbers in the pixel convention above), and `color` (string hex from the map above).

