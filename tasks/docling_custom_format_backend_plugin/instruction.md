# Teach Docling a New Input Format (RCP/1.0)

## Background

Docling is preinstalled in this container (`import docling`, distribution `docling-slim` 2.115.0, `docling-core` 2.87.1, Python 3.12) together with all of its model weights. **The container has no network access**: nothing may be downloaded, and no external or cloud service may be contacted. Only preinstalled packages may be used.

A lab publishes its protocols in a small in-house plain-text format called **RCP/1.0** (`.rcp`). Downstream teams want those protocols in the same document model, exports and chunk stream that Docling already produces for its natively supported formats, so RCP must become a first-class Docling input format rather than a side-channel parser.

## The RCP/1.0 format

An RCP file is UTF-8 text with LF line endings and is read line by line.

1. The **first line** must be exactly `%RCP/1.0`.
2. Then comes the **header block**: every line has the form `<key>=<value>`, where `<key>` matches `[a-z][a-z0-9_]*` and `<value>` is the rest of the line with surrounding whitespace stripped. The header block ends at the first line that is exactly `%%`. Keys `id` and `title` are required and must have a non-empty value; other keys are allowed and carry no meaning. A repeated key is an error.
3. Everything after the `%%` line is the **body**. Blank lines (empty or whitespace-only) carry no content; they only terminate the block they follow. Every other body line must be exactly one of:
   * `S<n>> <text>` with `<n>` in `1`..`6` — a section heading of level `<n>`.
   * `P> <text>` — a paragraph.
   * `N> <text>` — an ordered step. A run of consecutive `N>` lines is one ordered list.
   * `B> <text>` — a bullet. A run of consecutive `B>` lines is one unordered list.
   * `A> <text>` — an annotation.
   * `F> <ref> :: <caption>` — a figure reference with a caption.
   * A line starting with `|` — one table row. A run of consecutive table-row lines is one table. The cells of a row are obtained by dropping the leading `|`, then dropping one trailing `|` if present, then splitting on `|` and stripping each cell. The first row of a table is its column-header row, and every row of the same table must yield the same number of cells.

A file that violates any rule above (bad magic line, malformed or unterminated header, repeated header key, missing/empty `id` or `title`, unrecognized body line, ragged table) is **malformed**.

## Requirements

Fixtures live under `/home/user/project/corpus` (`clean/`, `mixed/`, `malformed/`, `unsupported/`); they are inputs, not templates for your output.

### 1. RCP as a Docling input format

Docling's own conversion entry point must handle `.rcp` inputs. Expose `build_converter()` in `/home/user/project/rcp_plugin.py`; it must return a `docling.document_converter.DocumentConverter` instance that:

* converts `.rcp` documents given as a filesystem path **and** as an in-memory Docling document stream named `<something>.rcp`, reporting conversion success and returning a Docling document;
* still converts natively supported Markdown (`.md`) documents successfully through the same converter instance;
* reports a conversion **failure** status for a malformed `.rcp` file instead of letting an exception escape, when the caller asks for errors not to be raised;
* does **not** report success for any other input format (e.g. `.csv`).

A converted RCP document must carry the following structure:

* Its document name is the header `id` value.
* Its body starts with a single title element whose text is the header `title` value.
* Each `S<n>>` line becomes a section-heading element whose heading level equals `<n>` and whose text is the line's text. A heading is nested inside the closest preceding heading of a smaller level (if any); every content element is nested inside the closest preceding heading.
* Each `P>` line becomes a plain text element with that text.
* Each `A>` line becomes a plain text element whose text is exactly `NOTE: ` followed by the annotation text.
* Each run of `N>` lines becomes one enumerated (ordered) list, each run of `B>` lines one non-enumerated list, with one list item per line, in file order, carrying the line's text.
* Each table block becomes one table element with `num_rows` equal to the number of rows in the block, `num_cols` equal to the number of cells per row, cell texts as parsed, and the cells of the first row flagged as column headers.
* Each `F>` line becomes one picture element whose caption text is the caption from that line.
* Nothing else is added to the document.

### 2. Unified batch CLI

`/home/user/project/rcp_convert.py`, run from `/home/user/project` as

```
python rcp_convert.py --input-dir <INPUT_DIR> --output-dir <OUTPUT_DIR>
```

converts a mixed directory in one pass. Both options are required.

* Inputs are the regular files **directly** inside `<INPUT_DIR>` whose name ends in `.rcp` or `.md`, processed in ascending file-name order. Subdirectories and every other file are ignored.
* `<OUTPUT_DIR>` is created when missing and receives:
  * `markdown/<stem>.md` — the Markdown export of the converted document (leading/trailing whitespace is not significant);
  * `json/<stem>.json` — the document's JSON serialization, loadable back into an equivalent Docling document;
  * `chunks.jsonl` — one JSON object per line, produced by Docling's hierarchical chunking of each converted document, in chunker order, grouped per input file in the same ascending file-name order. Each object has exactly the keys `file` (input file name), `chunk_index` (integer, restarting at 0 for each input file), `headings` (list of strings, the chunk's heading path, empty when there is none), `text` (the chunk text) and `num_chars` (integer, the number of characters in `text`);
  * `summary.json` — a JSON object with exactly the keys `schema_version` (integer `1`), `counts` and `documents`. `counts` has exactly the keys `total`, `succeeded` and `failed` (integers). `documents` is a list, ordered by `file` ascending, with one object per input file having exactly the keys `file` (file name), `format` (`"rcp"` or `"md"`), `status` (`"success"` or `"failure"`), `num_headings` (number of section-heading elements in the converted document), `num_list_items` (number of list items), `num_tables`, `num_pictures`, `num_chunks` (number of chunk objects written for this file) and `sha256` (lowercase hex SHA-256 of the input file's bytes).
* A file that fails to convert gets `"status": "failure"`, zeros in all five numeric fields, no `markdown/` or `json/` output and no line in `chunks.jsonl`; the run still processes every other file.
* The last line printed on stdout is exactly `converted=<succeeded> failed=<failed> total=<total>`.
* Exit code `0` when every input converted, `1` when at least one input failed to convert, `2` when `<INPUT_DIR>` does not exist or is not a directory (in that case nothing else is required). A Python traceback must never reach stderr.
* Re-running the command with the same input and output directories must rewrite byte-identical output files.

## Implementation Hints

* Project path: `/home/user/project`; both `rcp_plugin.py` and `rcp_convert.py` live directly in it, and `rcp_plugin` must be importable as a top-level module with `/home/user/project` on `sys.path`.
* Command: `python rcp_convert.py --input-dir <INPUT_DIR> --output-dir <OUTPUT_DIR>`, run with `/home/user/project` as the working directory.
* Conversion, exports and chunking must be produced by Docling itself from the converted document; hand-written Markdown/JSON/chunk emitters that bypass Docling's conversion entry point are not acceptable.
* Everything must run offline on CPU.

