# Real-Time Polling App with TanStack Start

## Background
Build a full-stack real-time polling / voting application using **TanStack Start** (React, `@tanstack/react-start`, version `1.133.x` or newer). Anyone can create a poll with a question and several options, vote once, and watch results update **live** across every open client. All data lives in a local **SQLite** database file on disk; the app must run entirely offline with no external services or network calls.

## Requirements
- A TanStack Start application that persists all polls, options, and votes in a **SQLite** database file (survives a full server process restart).
- Create a poll with a question and two or more options.
- Vote for a single option of a poll. Each vote increments that option's count **atomically** so that concurrent votes are never lost.
- **One vote per client**: after a client casts a vote on a poll, any further vote attempt on that same poll by that same client must be rejected server-side and must not change any count. A client is identified by a persistent identifier the server assigns and stores in an HTTP cookie (so it survives navigation and reloads within the same browser context).
- **Live results**: on a poll's page the results (each option's vote count, its percentage, and the running total) update in real time for every connected client whenever anyone votes, **without a manual page reload**.
- A home page that lists existing polls with links to their poll pages.

## Implementation Hints
- Project path: `/home/user/polls`
- The project's `package.json` must declare `@tanstack/react-start` as a dependency, and the app must be a TanStack Start app.
- Start command: `npm run start` — this command MUST start the app listening on **port 4519** on `localhost`. The grader runs exactly this command from the project root and waits for the port to accept connections. The server must keep running until terminated.
- Port: `4519` (do not use any other port).
- The app must expose the following JSON HTTP API. All request and response bodies are `application/json`. The canonical **poll object** shape used in every response is:

  ```json
  {
    "id": string,
    "question": string,
    "totalVotes": number,
    "options": [ { "id": string, "text": string, "votes": number } ]
  }
  ```

  - `POST /api/polls` — create a poll.

    ```json
    // Request
    { "question": string, "options": string[] }
    ```

    On success return **201** and the created poll object (every option's `votes` is `0`, `totalVotes` is `0`; option order matches the request order). If `question` is empty or fewer than 2 non-empty options are provided, return **400** with `{ "error": string }`.

  - `GET /api/polls/:id` — return **200** and the poll object, or **404** with `{ "error": string }` if it does not exist.

  - `POST /api/polls/:id/vote` — cast a vote.

    ```json
    // Request
    { "optionId": string }
    ```

    - If the poll or option does not exist, return **404** with `{ "error": string }`.
    - If the requesting client has **not** yet voted on this poll: increment the chosen option's count, assign/persist the client's identifier via an HTTP cookie (`Set-Cookie` on the response), and return **200** with the updated poll object.
    - If the requesting client has **already** voted on this poll (as identified by its cookie): return **409** with `{ "error": string }` and change no counts.
    - A request that arrives with no client-identifier cookie is treated as a brand-new client.

- Poll page route: `GET /poll/<id>` must render a full HTML page for the poll with `id` `<id>`. On this page the following DOM contract MUST hold (the grader relies on it):
  - A running total element with attribute `data-testid="total-votes"` whose text contains the integer total number of votes for the poll.
  - For each option with id `<optionId>`:
    - A clickable vote control with attribute `data-testid="vote-<optionId>"`.
    - An element with attribute `data-testid="count-<optionId>"` whose text contains that option's integer vote count.
    - An element with attribute `data-testid="percent-<optionId>"` whose text contains that option's percentage of the total as an integer immediately followed by `%` (e.g. `100%`). The percentage is `0` when the total is `0`, otherwise `round(votes / total * 100)`.
  - When the current client attempts to vote a second time on this poll, an element with attribute `data-testid="vote-error"` becomes visible on the page.
  - After any client votes, the counts, percentages, and total shown to every other client currently viewing this poll page must update within 5 seconds **without** that client reloading the page.
- Home page route: `GET /` must return **200** and list existing polls, each linking to its `/poll/<id>` page.
- The app must run fully offline: only local SQLite / in-memory / local HTTP is allowed. No external APIs or network access.

