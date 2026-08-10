# Typesense Collection Builder Admin UI

## Background
Build a self-service **admin web application** that lets an operator create a brand-new [Typesense](https://typesense.org) collection end-to-end from the browser: design its schema with a form, bulk-import a messy dataset, and immediately search the freshly-created collection. A Typesense **v26.0** server is already running locally and is reachable at `http://127.0.0.1:8108`; its admin API key is provided in the file `/etc/typesense-api-key`. Your app must talk to that live server (no mocking, no in-memory fake).

## Requirements
The app is a single page served at `GET /` that drives three ordered stages against the real Typesense server:

1. **Schema builder → create collection.** The operator adds fields one at a time (each field has a name, a type, and two independent flags: *facet* and *optional*), then creates the collection. The set of supported field types the form must offer is exactly: `string`, `int`, `float`, `bool`, `string[]`. When the collection is created, the app must persist it in Typesense with the field types mapped so that a form type of `int` becomes a Typesense `int32` field and every other form type is stored under its identical Typesense type name.
2. **Bulk import of dirty data.** The operator pastes newline-delimited JSON documents and imports them into the created collection. Some rows are *dirty*: values whose JSON type does not match the declared field type but which can be converted (e.g. a number provided as a quoted string) MUST be converted and successfully indexed; rows that cannot be converted, or that omit a field that the schema requires, MUST be rejected without aborting the rest of the batch. After importing, the UI must display the count of successfully-imported documents and the count of rejected rows, and these counts must reflect what actually landed in Typesense.
3. **Search.** The operator types a query and runs a full-text search against the created collection over its text fields, and the matching documents are rendered live.

The app must also be safe against bad input: submitting an invalid schema (for example, two fields with the same name, or a type outside the supported set) must surface a visible error and must NOT create any collection in Typesense.

## Implementation Hints
- Project path: /home/user/admin-ui
- Implement the app as a Node.js application (Node.js 20 is preinstalled). Start command: `bash /home/user/admin-ui/start.sh` — this script must launch your web server in the foreground.
- Port: 3000 (bind to 127.0.0.1). The page is served at `GET /`.
- The Typesense server is at `http://127.0.0.1:8108`; authenticate with the key in the file `/etc/typesense-api-key`.
- A copy of the dirty dataset the grader will import through your UI is provided for reference at `/home/user/dataset/products.jsonl` (newline-delimited JSON, one document per line).
- **Run-id scoping (required).** Read the run-id from the file `/logs/artifacts/run-id`. The collection-name field in the form holds a *base* name; the collection actually created in Typesense MUST be named `<base>_<run-id>` (the base, an underscore, then the exact run-id string). Every stage (import, search) operates on that same run-id-scoped collection.
- The single page must expose these DOM elements with exactly these `id`s (used to drive the app):
  - Schema builder: text input `collection-name` (the base name); text input `field-name`; a `select` with id `field-type` whose option values are exactly `string`, `int`, `float`, `bool`, `string[]`; checkbox `field-facet`; checkbox `field-optional`; button `add-field` that appends the current field to a pending list rendered in container `field-list`; button `create-collection` that creates the collection from the pending fields; element `schema-status` that shows a success message on success and an error message on failure.
  - Import: textarea `import-data` (holds the newline-delimited JSON); button `import-docs`; element `imported-count` that displays the number of successfully-imported documents; element `rejected-count` that displays the number of rejected rows; element `import-status` for status/error text.
  - Search: text input `search-query`; button `search-btn`; results container `search-results` in which each matching document is rendered as a descendant element carrying the CSS class `hit`, and each such `hit` element displays that document's `title` value.
- On a failed collection creation, `schema-status` must contain a human-readable error and no collection may exist in Typesense for that base name.

