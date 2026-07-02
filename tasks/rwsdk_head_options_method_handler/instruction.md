# RedwoodSDK: HTTP Method Routing

## Background
A RedwoodSDK project is pre-installed at `/home/user/myapp`. In RedwoodSDK, `HEAD` requests are **not** automatically mapped to `GET` handlers — they must be declared explicitly. Implement a small REST surface that demonstrates explicit method handling and configures the automatic `OPTIONS` behaviour.

## Requirements
Add an `/api/items` route to `defineApp([...])` that handles the following methods:
- `GET`: status 200, JSON body `{"items": ["alpha", "beta", "gamma"]}`.
- `HEAD`: status 200, no response body, response header `X-Items-Count: 3`.
- `POST`: status 201, JSON body `{"created": true}`.
- `DELETE`: status 204, no response body.
- `OPTIONS` (default RedwoodSDK behaviour): status 204, response header `Allow` must include `GET`, `HEAD`, `POST`, and `DELETE`.
- Any other method (e.g. `PUT`, `PATCH`): status 405.

Also, add a second route `/api/no-options` that explicitly disables the automatic OPTIONS handling (via the route `config`) so that `OPTIONS /api/no-options` returns 405. A `GET /api/no-options` request must still return status 200 with body `ok`.

