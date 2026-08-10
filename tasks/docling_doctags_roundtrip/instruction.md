# DocTags Round-Trip Fidelity Pipeline (Docling)

## Background
Docling (`docling` **v2.107.0**) parses documents into a unified `DoclingDocument` model and can serialize that model to its native **DocTags** representation, a compact tag-based format designed to losslessly carry document structure (headings, paragraphs, tables, and pictures). A serialization format is only trustworthy if it can be parsed back into an equivalent document. Your job is to build a command-line pipeline that proves this by performing a full **round trip** on a fixture PDF and quantifying whether the reconstructed document is structurally equivalent to the original.

All AI models are pre-baked into the image and the pipeline must run **fully offline** (no network access at runtime).

## Requirements
Build a CLI program that, given one PDF:
1. Converts the PDF into a `DoclingDocument` (the **original** document).
2. Serializes the original document to the **DocTags** representation and writes it verbatim to a fixed file.
3. **Reconstructs** a brand-new `DoclingDocument` by parsing that DocTags file back in (the **reconstructed** document). The reconstructed document MUST be produced from the contents of the written DocTags file — not from the original in-memory document object.
4. Re-exports the reconstructed document to Markdown at a fixed path.
5. Emits a JSON comparison report that quantifies structural equivalence between the original and the reconstructed documents.

## Implementation Hints
- Project path: `/home/user/project`
- A fixture PDF already exists at `/home/user/project/assets/report.pdf`. It contains a document title, multiple section headings (including a nested subsection), body paragraphs, one bordered multi-row/multi-column table, and one embedded figure with a caption.
- Command (run from the project path): `python main.py <input_pdf_path>` where `<input_pdf_path>` is a single positional argument giving the path to the PDF to process (e.g. `python main.py assets/report.pdf`).
- On success the program MUST exit with code `0` and create exactly these three artifacts (paths relative to the project path):
  - `out/original.doctags` — the DocTags serialization of the original document, written verbatim (it must contain the DocTags structural tags emitted for the table and for the picture).
  - `out/reconstructed.md` — the Markdown export of the reconstructed document.
  - `out/comparison_report.json` — the comparison report described below.
- If the positional argument is missing, or the referenced file does not exist, the program MUST exit with code `2`, MUST NOT write any artifact under `out/`, and MUST NOT emit a Python traceback.
- The comparison report at `out/comparison_report.json` MUST be a JSON object with exactly these top-level keys: `original`, `reconstructed`, `match`, `equivalent`.
  - `original` and `reconstructed` are each an object with exactly the integer keys `texts`, `tables`, `pictures`, `headings`, where:
    - `texts` = the total number of text items in that document.
    - `tables` = the number of table items in that document.
    - `pictures` = the number of picture items in that document.
    - `headings` = the number of section-header items in that document (the document title is NOT a section header and MUST NOT be counted).
  - `match` is an object with exactly the boolean keys `texts`, `tables`, `pictures`, `headings`; each is `true` iff the corresponding count in `original` equals the count in `reconstructed`.
  - `equivalent` is a boolean that is `true` iff all four values in `match` are `true`.
- The counts under `reconstructed` MUST be derived from the reconstructed document (the one parsed back from `out/original.doctags`), so that skipping the parse-back step cannot produce a correct report.

