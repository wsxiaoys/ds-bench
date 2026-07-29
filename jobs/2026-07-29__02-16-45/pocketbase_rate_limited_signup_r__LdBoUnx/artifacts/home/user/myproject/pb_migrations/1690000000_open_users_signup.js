/// <reference path="../pb_data/types.d.ts" />

// Makes the built-in "users" auth collection publicly signup-able, i.e.
// allows unauthenticated clients to create new user records via
// POST /api/collections/users/records using a body like:
//   { "email": "...", "password": "...", "passwordConfirm": "..." }
migrate((app) => {
  const collection = app.findCollectionByNameOrId("users");

  // keep a copy of the previous rule so the down migration can restore it
  collection.createRule = "";

  app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("users");

  // restore to superuser-only create (PocketBase default for auth collections)
  collection.createRule = null;

  app.save(collection);
});
