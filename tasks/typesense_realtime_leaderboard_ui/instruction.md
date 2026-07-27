# Realtime Leaderboard Web App backed by Typesense

## Background
Build a live leaderboard web application whose ranking is stored in and derived from a **Typesense** search engine (native server, v26.0). A Typesense server is already running locally and reachable at `http://127.0.0.1:8108`; its admin API key is provided in the file `/etc/typesense-api-key`. Your application is the only writer of gameplay scores, but score updates may arrive from many clients at the same time.

The app renders a ranked table of players, lets a user submit a score change through a form, and keeps every connected browser's ranking up to date automatically (no manual page reload) as scores change.

## Requirements
- Persist all leaderboard state in Typesense. On startup, if the collection does not yet exist, create it and seed it with the initial roster below. The rendered leaderboard and every rank number must be derived from live Typesense state, not from an in-process cache or the seed file.
- Show a leaderboard ranked by `score` descending. Ties in `score` are broken by player `name` in ascending (A→Z, case-sensitive lexicographic) order. Every row shows an explicit 1-based rank number; because the tie-break yields a total order, ranks are strictly sequential `1, 2, 3, …` with no gaps or duplicates.
- Provide a form that submits an **additive** score change (a signed integer `delta`) for a chosen player. Applying `delta` adds it to that player's current stored score (it does not replace the score).
- The visible ranking must re-sort and renumber automatically whenever any player's score changes — including changes triggered by other clients — within 10 seconds and without a full page reload.
- Concurrency correctness: when many additive updates for the same player arrive concurrently, none may be lost. After all updates complete, a player's stored score MUST equal the initial score plus the exact sum of every applied `delta`.

### Initial roster (seed exactly these five players)
| player_id | name  | score |
| --------- | ----- | ----- |
| p1        | Alice | 100   |
| p2        | Bob   | 100   |
| p3        | Carol | 90    |
| p4        | Dave  | 80    |
| p5        | Eve   | 70    |

## Implementation Hints
- Project path: `/home/user/leaderboard`
- Start command: `bash /home/user/leaderboard/start.sh` (run with the project path as the working directory). This command must launch the web app and block while it serves.
- Port: the web app listens on `8080` (bind to `0.0.0.0`).
- Typesense: connect to host `127.0.0.1`, port `8108`, protocol `http`, using the API key from the file `/etc/typesense-api-key`.
- Typesense storage contract (the grader queries Typesense directly): use a collection named exactly `leaderboard`. Store each player as one document whose `id` equals the `player_id`, with a string field `name` and an integer field `score`.
- HTTP API:
  - `GET /` — returns the leaderboard HTML page.
  - `GET /api/leaderboard` — returns status `200` and a JSON array ordered from best to worst rank; each element has exactly the keys `rank` (1-based integer), `player_id` (string), `name` (string), and `score` (integer).
  - `POST /api/score` — accepts a JSON body `{"player_id": string, "delta": integer}`, atomically adds `delta` to that player's stored score, and returns status `200` with the updated player as JSON `{"player_id": string, "name": string, "score": integer}`. If `player_id` does not exist, return status `404`. If the body is missing `player_id`, missing `delta`, or `delta` is not an integer, return status `400`.
- Browser/DOM contract (the rendered page is graded by a headless browser):
  - A container element with attribute `data-testid="leaderboard"` holds one row element per player.
  - Each row has the attribute `data-player-id="<player_id>"`, and rows appear in the DOM in ranked order (rank 1 first).
  - Each row contains a descendant with `data-testid="rank"` whose text is the 1-based rank number, a descendant with `data-testid="name"` whose text is the player name, and a descendant with `data-testid="score"` whose text is the current integer score.
  - The update form provides a text input `data-testid="player-id-input"`, a numeric input `data-testid="delta-input"`, and a submit control `data-testid="submit-score"`. Submitting it applies the additive update to the named player and the ranking updates live.

