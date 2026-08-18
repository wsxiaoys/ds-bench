# PollRoom: Realtime, Database-Backed Poll Voting over WebSockets

## Background

`/home/user/app` contains a freshly created, minimal **Wasp 0.25.0** project (dependencies already installed). Turn it into **PollRoom**: a multi-user voting app where polls are created over HTTP and voted on in real time over WebSockets, with every subscriber receiving live, personalized results.

All poll, option and vote data must live in the app's database. Keep the project's existing SQLite datasource and its `DATABASE_URL` configuration exactly as they are, and make sure the database schema is migrated so the app starts cleanly.

## Requirements

### 1. Authentication

- Enable Wasp's username & password authentication with the user entity named `User`.
- Wasp's default auth HTTP endpoints must stay available and unchanged: `POST /auth/username/signup` and `POST /auth/username/login` (accepting `{"username": string, "password": string}`).
- The poll page requires an authenticated user; unauthenticated visitors of that page must end up on `/login`.

### 2. Data model (`schema.prisma`)

Define at least these models, with exactly these model names and field names (extra fields are allowed):

- `Poll`: `id` (Int, autoincrement, primary key), `slug` (String, unique), `question` (String), `isClosed` (Boolean, default `false`), `revision` (Int, default `0`), `creatorId` (Int, relation to `User`).
- `PollOption`: `id` (Int, autoincrement, primary key), `pollId` (Int, relation to `Poll`), `label` (String), `position` (Int). A poll may never contain two options with the same `position`, enforced by a database-level unique constraint over (`pollId`, `position`).
- `Vote`: `id` (Int, autoincrement, primary key), `pollId` (Int, relation to `Poll`), `optionId` (Int, relation to `PollOption`), `userId` (Int, relation to `User`). A user may never hold more than one vote in the same poll, enforced by a database-level unique constraint over (`pollId`, `userId`).

`revision` is the poll's mutation counter. It starts at `0` when the poll is created and increases by exactly `1` for every *accepted* mutation of that poll (a new vote, a changed vote, a retracted vote, or the poll being closed). Rejected requests and no-op requests must never change it. Concurrent accepted mutations must never lose an increment: after N accepted mutations the poll's `revision` must equal N.

### 3. HTTP API

#### `POST /api/polls`

Creates a poll owned by the authenticated user. The caller authenticates with the session id returned by the login endpoint, sent as `Authorization: Bearer <sessionId>`.

Request body:

```json
{ "slug": string, "question": string, "options": string[] }
```

Responses:

- `401` with body `{"error": "UNAUTHENTICATED"}` when the request carries no valid session.
- `400` with body `{"error": "INVALID_PAYLOAD"}` when `slug` does not match `^[a-z0-9-]{1,32}$`, or `question` is not a non-empty string, or `options` is not an array of 2 to 8 non-empty strings, or `options` contains duplicate values.
- `409` with body `{"error": "SLUG_TAKEN"}` when a poll with that `slug` already exists.
- `201` with body:

```json
{
  "slug": string,
  "question": string,
  "isClosed": false,
  "revision": 0,
  "creator": string,
  "options": [{ "id": number, "label": string, "position": number }]
}
```

`creator` is the username of the authenticated caller. Options are stored in request order, receive `position` values `0, 1, 2, ...` in that order, and are returned ordered by `position` ascending.

Validation is checked in the order given above (`401`, then `400`, then `409`), and a rejected request must not create anything.

#### `GET /api/polls/:slug/results`

Public endpoint, must work with no authentication at all.

- `404` with body `{"error": "POLL_NOT_FOUND"}` when no poll has that slug.
- `200` with body:

```json
{
  "slug": string,
  "question": string,
  "isClosed": boolean,
  "revision": number,
  "totalVotes": number,
  "leaderOptionId": number | null,
  "options": [
    { "id": number, "label": string, "position": number, "votes": number, "voters": string[] }
  ]
}
```

- `options` is ordered by `position` ascending.
- `votes` is the number of votes currently held by that option; `totalVotes` is the sum over all options.
- `voters` is the list of usernames of the users currently voting for that option, sorted ascending by Unicode code point.
- `leaderOptionId` is `null` when the poll has no votes; otherwise it is the `id` of the option with the most votes, ties broken in favor of the smallest `position`.

### 4. WebSocket protocol

The app must expose Wasp's WebSocket support on the server (same origin/port as the HTTP server). All events below use a single JSON object as their only argument.

Events accepted from clients:

| Event | Payload |
| --- | --- |
| `poll:subscribe` | `{ "slug": string }` |
| `poll:unsubscribe` | `{ "slug": string }` |
| `poll:vote` | `{ "slug": string, "optionId": number }` |
| `poll:retract` | `{ "slug": string }` |
| `poll:close` | `{ "slug": string }` |

Events emitted by the server:

- `poll:state`, whose payload is **personalized per receiving connection**:

```json
{
  "slug": string,
  "question": string,
  "isClosed": boolean,
  "revision": number,
  "totalVotes": number,
  "leaderOptionId": number | null,
  "myVoteOptionId": number | null,
  "options": [
    { "id": number, "label": string, "position": number, "votes": number, "voters": string[] }
  ]
}
```

  All fields follow the same rules as `GET /api/polls/:slug/results`; `myVoteOptionId` is the id of the option the *receiving* connection's user currently votes for in this poll, or `null` if that user has no vote in it.

- `poll:error`, with payload `{ "code": string, "message": string }`, where `message` is a non-empty human-readable string. It is delivered only to the connection that sent the offending event, and it never changes any stored state.

Behaviour:

- `poll:subscribe` makes the connection a subscriber of that poll and replies with `poll:state` to that connection only. Subscribing again while already subscribed is allowed and behaves the same way. A connection may be subscribed to several polls at once.
- `poll:unsubscribe` removes the connection from that poll's subscribers and emits nothing back. The connection must stop receiving that poll's broadcasts.
- `poll:vote` records (or moves) the calling user's single vote in that poll onto `optionId`. If the user already votes for that exact option, the request is a no-op: `revision` must not change and `poll:state` must be sent to the requesting connection only. Otherwise the mutation is accepted.
- `poll:retract` removes the calling user's vote from that poll.
- `poll:close` marks the poll closed. Only the poll's creator may close it. A closed poll accepts no further votes or retractions, but stays readable and subscribable.
- Every accepted mutation (`poll:vote` that changes state, `poll:retract`, `poll:close`) must send an up-to-date, individually personalized `poll:state` to **every** connection currently subscribed to that poll, including the connection that triggered it and including several connections belonging to the same user. Connections that are not subscribed to that poll must receive nothing.

Error codes, checked in this exact precedence order for every event:

1. `UNAUTHENTICATED` — the connection has no authenticated user.
2. `INVALID_PAYLOAD` — the payload is missing, is not an object, `slug` is not a non-empty string, or (for `poll:vote`) `optionId` is not an integer number.
3. `POLL_NOT_FOUND` — no poll exists with that slug.
4. `NOT_SUBSCRIBED` — for `poll:vote`, `poll:retract` and `poll:close`: the connection has not subscribed to that poll (`poll:subscribe` and `poll:unsubscribe` never produce this code).

Then, per event:

- `poll:vote`: `POLL_CLOSED` when the poll is closed, then `OPTION_NOT_FOUND` when `optionId` is not an option of that poll.
- `poll:retract`: `POLL_CLOSED` when the poll is closed, then `NO_ACTIVE_VOTE` when the user holds no vote in that poll.
- `poll:close`: `NOT_POLL_CREATOR` when the caller is not the poll's creator, then `ALREADY_CLOSED` when the poll is already closed.

### 5. Poll page (client)

A page mounted at the route path `/poll/:slug`, requiring authentication, that renders live poll results using the WebSocket protocol above and updates itself without a page reload whenever anybody else votes, retracts or closes the poll.

For an existing poll the page must render these elements, identified by their `data-testid` attribute:

- `poll-question`: the poll's question text.
- `poll-status`: exactly `open` or `closed`.
- `poll-revision`: the current `revision`, digits only.
- `poll-total-votes`: the current `totalVotes`, digits only.
- `poll-leader`: the current `leaderOptionId`, digits only, or exactly `none` when there is none.
- `poll-my-vote`: the id of the option the logged-in user currently votes for, digits only, or exactly `none`.
- For every option, in `position` ascending document order: `option-label-<optionId>` (its label), `option-votes-<optionId>` (its vote count, digits only), `option-voters-<optionId>` (its voters' usernames joined with `,` and no spaces, in the same order as the protocol defines, or an empty string when nobody voted for it), and a clickable element `option-vote-<optionId>` that casts the logged-in user's vote for that option.
- A clickable element `poll-retract` that retracts the logged-in user's vote in this poll.

For a slug that has no poll, the page must render an element with `data-testid` `poll-missing` and none of the elements listed above.

### 6. Login page (client)

A page mounted at the route path `/login` containing a username field with `data-testid` `login-username`, a password field with `data-testid` `login-password`, and a clickable element with `data-testid` `login-submit`. Submitting valid credentials logs the user in and keeps them logged in on subsequent navigation within the app.

## Implementation Hints

- Project path: `/home/user/app`.
- Start command: `wasp start`, executed from the project path. It must bring up the whole app with the server on port `3001` and the client on port `3000`; the app is verified through both of them while it runs in development mode.
- Keep Wasp `0.25.0` and the existing SQLite datasource; the schema changes you make must be migrated (the app must start without pending-migration errors).
- HTTP responses of the two endpoints above must be JSON with exactly the documented keys and status codes; no other route may be changed.
- The WebSocket server must be reachable on the same host and port as the HTTP server, on the default Socket.IO path, and the events, payload keys, sorting rules, tie-break rule and error codes above must be honoured literally.
- The vote counts, voter lists, leader, revision and per-user vote reported over HTTP and over WebSocket must always agree with each other and with what is stored in the database.

