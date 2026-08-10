# Complex Table Structure Reconstruction with Docling (TableFormer)

## Background
A vendor supplies a single-page programmatic PDF that contains one **complex table**: it has merged header cells that span multiple columns and multiple rows, plus a regular body of numeric values. Downstream systems need a faithful, machine-readable reconstruction of that table's true grid — flat text dumps that ignore merges are useless to them.

You must build a command-line tool that uses **Docling `v2.107.0`** (pinned; the `docling` Python package and all model weights are already installed and available offline in this environment) to recognise the table's full cell structure — including every spanning cell and the exact text of every cell — and emit two normalized artifacts: a normalized HTML table and an explicit JSON grid model.

The tool must run **fully offline**. Do not attempt any network access.

## Requirements
- Read the input PDF, detect its table, and reconstruct the complete two-dimensional cell grid, preserving all row-spanning and column-spanning cells and the exact text of every cell.
- Emit a **normalized HTML table** that encodes the reconstructed grid, using span attributes to represent merged cells.
- Emit a **JSON grid model** that explicitly encodes, for every logical cell, its grid coordinates, its span sizes, its text, and whether it is a header cell.
- A naive/flat table read that collapses merged cells or drops span information must not be able to satisfy the outputs.

## Implementation Hints
- Project path: `/home/user/project`
- Input PDF: `/home/user/project/assets/complex_table.pdf` (already present in the environment).
- Command (rerunnable): `python main.py --pdf <input_pdf> --html <output_html> --json <output_json>`
  - The tool will be invoked from the project directory as:
    `python main.py --pdf assets/complex_table.pdf --html output/table.html --json output/grid.json`
  - All three flags are required. Paths may be relative to the project directory or absolute. Create parent directories for the outputs if they do not already exist.
  - On success the process must exit with code `0`.
  - If the input PDF path does not exist, the process must write nothing, print a diagnostic to stderr, and exit with code `2`.
- **JSON grid model** (`output/grid.json`): a single UTF-8 JSON object with exactly these top-level keys, in this order:
  - `num_rows` (integer): number of rows in the reconstructed grid.
  - `num_cols` (integer): number of columns in the reconstructed grid.
  - `cells` (array): one object per **logical** cell — i.e. one entry per merged region anchored at its top-left origin, never one entry per covered grid position. Each cell object must contain exactly these keys in this order: `row`, `col`, `rowspan`, `colspan`, `text`, `is_header`.
    - `row`, `col` (integers): 0-based grid coordinates of the cell's top-left origin.
    - `rowspan`, `colspan` (integers, each `>= 1`): number of grid rows/columns the cell occupies.
    - `text` (string): the cell's text, whitespace-trimmed (empty string for a genuinely empty cell).
    - `is_header` (boolean): whether the structure model recognises the cell as a header cell.
  - The `cells` array must be ordered ascending by `row`, then by `col`.
  - Every grid position in `[0, num_rows) x [0, num_cols)` must be covered by exactly one logical cell (no gaps, no overlaps); consequently the sum of `rowspan * colspan` over all cells equals `num_rows * num_cols`.
- **Normalized HTML table** (`output/table.html`): a **well-formed XML document whose single root element is a `<table>`**. Header cells must be `<th>` elements and body cells `<td>` elements. A cell that spans more than one row must carry a `rowspan` attribute equal to its span, and a cell that spans more than one column must carry a `colspan` attribute equal to its span. The grid encoded by the HTML must be identical to the grid described by `output/grid.json`.
- Where the exact segmentation of an ambiguous merged region admits more than one valid representation, you may choose any internally-consistent convention, provided every invariant above (grid dimensions, full non-overlapping coverage, spanning-header spans, and placement of each known value) still holds and the HTML and JSON agree.

