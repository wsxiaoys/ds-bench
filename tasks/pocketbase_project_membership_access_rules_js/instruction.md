# PocketBase Multi-Tenant Membership Access Control (JS Migration)

## Background
[PocketBase](https://pocketbase.io/) is a single-file Go backend that uses an embedded SQLite database. Schema and access control can be provisioned programmatically by dropping a JavaScript migration file into `pb_migrations/`. When the server starts it will automatically apply every new migration inside a transaction.

A PocketBase v0.31.0 binary has been pre-extracted to `/home/user/myproject/pocketbase` and an initial superuser has already been created so the application is fully bootstrapped. Your job is to provision two new application collections - `projects` and `tasks` - and wire their API rules so that membership in a project transitively grants access to that project's tasks. After the migration is in place, start the server.

This exercises PocketBase's relational [API Rules](https://pocketbase.io/docs/api-rules-and-filters/) and the nested-relation join syntax that lets you express multi-tenant access in a single line.

## Requirements
- Add a JavaScript migration file inside `/home/user/myproject/pb_migrations/`. The exact filename is up to you, but it must end with `.js` so PocketBase picks it up at boot.
- The migration MUST create the following two **base** collections (both empty, with the schema below):
  1. `projects` collection:
     - `name`: `text` field, required, non-empty.
     - `members`: multi-`relation` field pointing to the built-in `users` auth collection, required, with no upper bound on number of selected members (i.e. multi-select).
  2. `tasks` collection:
     - `title`: `text` field, required, non-empty.
     - `description`: `text` field, optional.
     - `project`: single-`relation` field pointing to the `projects` collection, required.
- The migration MUST set the API rules on both collections so that membership in a project transitively controls access to its tasks:
  - For `projects`:
    - `listRule` and `viewRule`: only authenticated users that are listed in the project's `members` field can list/view it.
    - `createRule`: any authenticated user can create a project.
    - `updateRule` and `deleteRule`: only authenticated users that are listed in the project's `members` field can update/delete it.
  - For `tasks`:
    - All five rules (`listRule`, `viewRule`, `createRule`, `updateRule`, `deleteRule`) must require the requester to be authenticated AND to be a member of the task's parent project (via the `project` relation's `members` field).
- Guests (unauthenticated requests) MUST NOT be able to list, view, create, update or delete any record from either collection.
- Superusers retain unrestricted access (PocketBase already grants this; do not break it).
- Start the PocketBase server bound to all interfaces on TCP port 8090.

## Implementation Hints
- PocketBase v0.31 uses the JS migration API documented at [JS Migrations](https://pocketbase.io/docs/js-migrations/). A migration file is a single `migrate((app) => { ... }, (app) => { ... })` call; the second callback is the down/rollback.
- Collections are created by instantiating `new Collection({...})` (see [Collections](https://pocketbase.io/docs/collections/)) and saving via `app.save(collection)`. Field definitions follow the `{ name, type, required, ... }` shape, and the relation field type accepts `collectionId` plus `minSelect` / `maxSelect` options. To target the built-in users collection, resolve its id at migration time via `app.findCollectionByNameOrId("users").id`.
- API rules are simple string expressions evaluated by PocketBase. Multi-relation membership can be expressed with the "any-of" operator `?=`. For a back-/nested-relation reference, dot syntax is supported: e.g. `relField.members.id ?= @request.auth.id`. See the [API Rules & Filters](https://pocketbase.io/docs/api-rules-and-filters/) docs.
- Rules left as `null` are locked to superusers only - that is what `guests are blocked` looks like by default. To allow non-superuser access you have to set a non-null string rule.
- The migration must be idempotent enough that PocketBase's automatic application succeeds on a fresh `pb_data` (you do not need to handle re-runs - migrations are recorded in `_migrations` and skipped once applied).
- You do NOT need to write any Go code, JSVM hooks, or client-side code. You also do not need to modify the existing `users` collection.
- To start the PocketBase server from the project directory (`/home/user/myproject`), bind it to all interfaces on port 8090 using: `./pocketbase serve --http=0.0.0.0:8090`.

