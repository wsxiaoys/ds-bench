# Multilingual Catalog Search UI

## Background
You are building a small **multilingual catalog search** web application backed by a **local Typesense v26.0** search server. The catalog contains the same conceptual items described in three languages (English, French, German). Users pick a language from a selector and search within that language; the results must reflect the linguistic conventions of the selected language.

## Requirements
Build a web application that indexes the provided catalog into the local Typesense server and exposes a search UI plus a JSON search endpoint. The application must satisfy **all** of the behaviors below:

- **Language-scoped search.** A language selector controls which language the search runs against. A query word that appears only in one language's text for an item must return that item when its language is selected, and must **not** return that item when a different language (whose text does not contain the word) is selected. Changing the selected language re-runs the current query and updates the visible results accordingly.
- **Morphological (root/inflection) matching within a language.** Within the selected language, a query written in the base/root form of a word must also match items whose text for that language contains only an inflected form of that same word (e.g. a plural, a gerund, or a conjugated verb form), and vice-versa. This must hold for words whose inflected form differs from the root by more than a couple of characters (i.e. it cannot be satisfied by prefix or typo tolerance alone), and it must be applied using the correct rules for the selected language. Unrelated words must **not** match.
- **Accent/diacritic-insensitive English matching (both directions).** For the English language, search must be insensitive to accent marks in both directions: an unaccented query must match an item whose English text contains the accented form of the word, and an accented query must match an item whose English text contains the unaccented form.
- **Startup indexing.** On startup the application must ensure the Typesense collection exists and that every record from the seeded dataset is indexed (idempotently), so search works immediately after the server starts.

## Implementation Hints
- **Project path:** `/home/user/catalog-search`
- **Start command:** `npm start` (run from the project path). The HTTP server must listen on `0.0.0.0:3000`.
- **Port:** `3000`
- **Local Typesense server:** A Typesense **v26.0** server binary is installed at `/usr/local/bin/typesense-server`. During verification it is started on `127.0.0.1:8108`. Your application must connect to Typesense at host `127.0.0.1`, port `8108`, protocol `http`, using the API key read from the file `/etc/typesense-api-key`. (You may start the server yourself the same way while developing.)
- **Seeded dataset:** `/home/user/catalog-search/data/catalog.json` is a JSON array of catalog records. Each record has exactly these keys:
  - `id` (string) — unique item id
  - `name_en` (string) — the item's name in English
  - `name_fr` (string) — the item's name in French
  - `name_de` (string) — the item's name in German

  The three names describe the same conceptual item in the three languages. Index all records so that the behaviors above hold.

- **Search endpoint:** `GET /api/search?q=<query>&lang=<en|fr|de>`
  - `lang` selects the language the query runs against. Treat a missing/unknown `lang` as `en`.
  - Returns HTTP `200` with a JSON body of the shape:

    ```json
    {
      "hits": [
        { "id": "string", "name": "string" }
      ]
    }
    ```

    where each hit's `name` is the matched item's name **in the requested language** (`name_<lang>`). When `q` is empty or whitespace-only, `hits` must be an empty array.

- **Search page:** `GET /` must return an HTML page containing exactly these controls:
  - A language selector `<select id="language-select">` whose options have `value="en"`, `value="fr"`, and `value="de"`; English (`en`) is selected by default.
  - A text input `<input id="search-input">`.
  - A results list `<ul id="results">`. Each result is rendered as a child `<li class="result-item" data-doc-id="<id>">` whose visible text contains the matched item's name in the currently selected language.
  - Whenever the text input value changes or the selected language changes, the page must query `/api/search` with the current query and selected language and re-render `#results` to contain exactly one `.result-item` per hit (and no `.result-item` elements when there are no hits or the input is empty).

