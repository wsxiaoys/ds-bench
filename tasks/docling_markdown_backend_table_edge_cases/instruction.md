# Offline GFM Table Edge-Case Audit with Docling

## Background

A documentation-ingestion team feeds hand-written Markdown into a docling-based pipeline. Real-world Markdown tables are messy: pipes at the edges are optional, header cells are bold or links, rows are ragged, cells contain escaped pipes, and paragraphs that merely mention a `|` must never be mistaken for tables. The team needs a reproducible audit that reports, per document, exactly what a GFM-conformant reader should see, materialized through docling's Markdown backend (docling 2.x, `InputFormat.MD`).

The corpus lives in `assets/corpus` inside the project. It is fixed at image build time and contains valid UTF-8 documents plus one file that is not valid UTF-8. Everything must run fully offline: the environment has no network access at run time.

## Requirements

Build a command-line audit program that converts every Markdown document of a corpus directory with docling and writes a single deterministic JSON report describing:

- every GFM table, normalized to a rectangular grid with per-column alignments;
- every fenced code block with the code language docling detected for it;
- every embedded image, honouring a caller-supplied byte cap on embedded image data;
- every non-table source line that contains a pipe character;
- every corpus file that could not be processed.

## Implementation Hints

- Project path: `/home/user/md_table_audit`
- Command: `python main.py --corpus <corpus_dir> --out <report_path> --max-image-bytes <int>`; all three options are required, the process must exit with status `0` on success, must create the parent directories of `<report_path>`, and must overwrite an existing report.
- The program must be re-runnable with different `--corpus`, `--out` and `--max-image-bytes` values; nothing may be hard-coded to one corpus or one cap.
- Documents are the `*.md` files located directly in `<corpus_dir>` (no recursion), processed in ascending file-name order. A file whose bytes are not valid UTF-8 must not abort the run: it is reported as failed with reason `decode_error` and is excluded from `documents`.
- The conversion itself must be performed by docling's Markdown backend on the real document content; the reported tables must exist as real `TableItem`s of the `DoclingDocument` your program produced.
- No network access at run time.

### Report format

`<report_path>` is UTF-8 JSON with exactly these top-level keys:

```json
{
  "schema_version": "1.0",
  "max_image_bytes": <int, echo of the CLI value>,
  "documents": [<document object>, ...],
  "failed": [{"name": <string>, "reason": "decode_error"}, ...],
  "totals": {
    "documents": <int>, "failed": <int>, "tables": <int>,
    "table_cells": <int>, "code_blocks": <int>,
    "images": <int>, "images_decoded": <int>
  }
}
```

`documents` and `failed` are ordered by `name` ascending, where `name` is the file name without the `.md` suffix. `totals.table_cells` is the sum of every table's `cell_count`, `totals.images_decoded` counts images with `"decoded": true`; the other totals are plain counts.

A document object has exactly these keys:

```json
{
  "name": <string>,
  "tables": [<table object>, ...],
  "pipe_prose": [<string>, ...],
  "code_blocks": [{"index": <int>, "language": <string>, "chars": <int>}, ...],
  "images": [{"index": <int>, "data_bytes": <int|null>, "decoded": <bool>,
              "width": <int|null>, "height": <int|null>,
              "reason": <string|null>}, ...],
  "image_size_warnings": <int>
}
```

A table object has exactly these keys:

```json
{
  "index": <int>, "self_ref": <string>, "num_rows": <int>, "num_cols": <int>,
  "cell_count": <int>, "docling_cell_count": <int>,
  "alignments": [<string>, ...], "grid": [[<string>, ...], ...]
}
```

`tables`, `code_blocks` and `images` are in document order and their `index` is their 0-based position in that list.

### Table recognition (GFM)

Lines inside fenced code blocks (fences are lines whose stripped form starts with ```` ``` ````) are never part of a table and never produce prose entries. Outside fences, a table block starts at a line `H` when `H` is non-blank, does not start with `#` or a fence, contains at least one pipe, and the immediately following line `D` splits into the same number of cells as `H` with every cell matching `^:?-+:?$` after trimming. The table's body rows are the lines after `D`, up to (excluding) the first blank line, end of file, line starting with `#`, or fence line.

Rows are split on pipe characters that are not preceded by a backslash. If the trimmed line starts with an unescaped pipe, its leading empty cell is dropped; if it ends with an unescaped pipe, its trailing empty cell is dropped. A `\|` sequence is a literal pipe belonging to the cell text.

Each cell's reported text is derived from the raw cell by replacing every `[text](url)` link with `text`, deleting every `*` and backtick character, collapsing whitespace runs to a single space, and stripping. Empty cells are reported as `""`.

`num_cols` is the number of cells of `H`; `num_rows` is `1 +` the number of body rows; `grid[0]` is the header row. Body rows with fewer cells than `num_cols` are padded on the right with `""`, and cells beyond `num_cols` are dropped, so `grid` is always exactly `num_rows` x `num_cols` and `cell_count` is `num_rows * num_cols`.

`alignments` has `num_cols` entries derived from the cells of `D`: `"center"` when the trimmed cell starts and ends with `:`, `"left"` when it only starts with `:`, `"right"` when it only ends with `:`, `"none"` otherwise.

`self_ref` and `docling_cell_count` must be read back from the docling `TableItem` / `TableData` that carries the table (`self_ref` is therefore of the form `#/tables/<index>`), and `docling_cell_count` must equal `cell_count`. The reported `grid` must be the cell texts of that same `TableData` in row-major order, after undoing any transport-safe encoding you applied to make the content survive the backend.

`pipe_prose` lists, in source order, the stripped text of every source line that contains at least one pipe character and is neither inside a fenced code block nor part of a recognized table block.

### Code blocks and images

`code_blocks` covers only fenced code blocks, in document order; `language` is the code-language label docling assigned to that block, as its label string value (for example `Python`, `SQL`, `unknown`); `chars` is the number of characters of the block's code content (fence lines and info string excluded, no trailing newline).

`images` covers every Markdown image of the document, in document order. `data_bytes` is the size in bytes of the decoded payload of a `data:` URI image, or `null` for an image whose source is not a base64 `data:` URI. Embedded image data must actually be decoded during the conversion, subject to the `--max-image-bytes` cap: for a decoded image, `decoded` is `true`, `width` and `height` are the decoded pixel dimensions and `reason` is `null`; for an image the conversion refused to decode because its data exceeds the cap, `decoded` is `false`, `width` and `height` are `null` and `reason` is `"size_limit"`; for an image whose source is not a base64 `data:` URI, `decoded` is `false`, `width` and `height` are `null` and `reason` is `"unsupported_source"`.

`image_size_warnings` is the number of warning events raised while converting that document whose message contains `exceeds size limit`; every such event must be counted, so repeated identical warnings must not be suppressed.

