# Filtered Realtime Subscription with the PocketBase JS SDK

## Goal
A PocketBase v0.31.0 server is already running locally with a pre-seeded `messages` collection (fields: `chat`, `body`). Build a Node.js CLI that uses the official `pocketbase` npm package (JS SDK) to open a realtime SSE subscription on the `messages` collection that only delivers events whose `chat` field equals the chat id passed on the command line.

## Implementation Hints
- **Project Path**: Create your solution in `/home/user/myproject/subscribe.js`. Make sure to initialize the project and install the official `pocketbase` npm package.
- **CLI Usage**: The script must be runnable as `node subscribe.js --chat <chatId>`.
- **PocketBase Connection**: Connect to the local server at `http://127.0.0.1:8090`. Authenticate using the superuser credentials provided in the environment variables `PB_ADMIN_EMAIL` and `PB_ADMIN_PASSWORD`.
- **Realtime Filtering**: Use PocketBase's server-side filtering features to ensure that only events matching the requested `chat` ID are delivered.
- **Output Format**: For every realtime event received, write exactly one JSON object on its own line to `stdout` with the shape `{"action": "create|update|delete", "record": { ...record fields including id and chat... }}`. Make sure to flush/write each line immediately.
- **Output Constraints**: Only print the JSON event lines to `stdout`. Any logs, debug output, or other messages must be sent to `stderr` or suppressed.
- **Graceful Shutdown**: The script must handle `SIGTERM` signals. Upon receiving `SIGTERM`, it must close the subscription, clean up any resources, and exit with status `0` within 3 seconds.

