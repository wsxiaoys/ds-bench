# Instant Typeahead / Autocomplete Search UI backed by Typesense

## Background
Build a full-stack "search-as-you-type" (typeahead / autocomplete) web application backed by a locally running Typesense v26.0 search server. As the user types into a search box, the app shows a live dropdown of matching city suggestions with the matched text highlighted, supports full keyboard navigation, and opens a detail view for the selected city.

## Requirements
- A single-page search UI served at `GET /` with a text input where the user types a query.
- On input, the app queries the backend and renders a dropdown of at most 8 city suggestions. Search must be prefix-based (a city matches when the typed text is the beginning of a token in its name) and typo-tolerant (a query with one wrong character still surfaces the intended city).
- Each rendered suggestion must display the city name with the portion matching the typed query wrapped in a `<mark>` element.
- Full keyboard interaction on the search box: ArrowDown / ArrowUp move the active (highlighted) suggestion, Enter opens the active suggestion's detail view, Escape closes the dropdown.
- A detail view served at `GET /item/:id` that displays the selected city's name, country, and population.
- The city dataset is provided at `/home/user/typeahead/data/cities.json`. Each record is a JSON object with exactly the keys `id` (string), `name` (string), `country` (string), and `population` (integer). The application must index this dataset into Typesense at startup so that search works against a freshly started, initially empty Typesense server.
- Queries should be debounced so the app does not issue a backend request on every synchronous keystroke.

## Implementation Hints
- Project path: /home/user/typeahead
- Start command: `npm start` (run from the project path). The app must listen on port 3000.
- A Typesense v26.0 server is available at `http://127.0.0.1:8108`; authenticate with the API key from the file `/etc/typesense-api-key`. Do not assume the server already contains any data; the app is responsible for indexing `data/cities.json` on startup.
- Routes:
  - `GET /` — HTML page containing a search `<input>` with `id="q"`.
  - `GET /api/suggest?q=<query>` — returns HTTP 200 with a JSON array of at most 8 suggestion objects, each having exactly the keys `id` (string), `name` (string), `country` (string), and `population` (integer). Results MUST be ordered by `population` descending, breaking ties by `name` ascending. If `q` is missing, empty, or only whitespace, return an empty array `[]`.
  - `GET /item/:id` — HTML detail page for the city whose `id` equals `:id`; the page body must contain that city's name, country, and population. If no city has that id, respond with HTTP status 404.
- Dropdown DOM contract (on the `GET /` page):
  - Suggestions are rendered inside a container element with `id="suggestions"`.
  - Each suggestion is an element with class `suggestion`, in the same order returned by `/api/suggest`.
  - The currently active suggestion (via keyboard navigation) additionally has the class `active`; at most one suggestion is `active` at any time.
  - Each `.suggestion` shows its city name with the substring matching the current query wrapped in a `<mark>` element.
  - When the query is empty or whitespace only, or when the dropdown has been closed (for example after Escape), no `.suggestion` elements are present in the DOM.
- Keyboard behavior while the search input is focused:
  - Pressing ArrowDown when no suggestion is active makes the first suggestion active; subsequent ArrowDown / ArrowUp presses move the active suggestion down / up within the list.
  - Pressing Enter navigates the browser to `/item/<id>` of the currently active suggestion.
  - Pressing Escape closes the dropdown, removing all `.suggestion` elements from the DOM.

