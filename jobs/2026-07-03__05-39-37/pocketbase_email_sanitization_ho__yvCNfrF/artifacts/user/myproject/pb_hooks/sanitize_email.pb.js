/// <reference path="../pb_data/types.d.ts" />

// Sanitize the "email" field on every new record created in the
// built-in "users" collection: strip leading/trailing whitespace and
// lowercase the value before it is persisted.
//
// The third argument ("users") is a hook tag that restricts this handler
// to the "users" collection only, so other auth collections such as
// "_superusers" are never touched. An explicit in-handler check is kept
// as a defensive guard.
onRecordCreateRequest((e) => {
    if (e.collection && e.collection.name === "users" && e.record) {
        var email = e.record.getString("email") || "";
        e.record.set("email", email.trim().toLowerCase());
    }
    // Propagate the chain - required by the post-v0.23 hook API,
    // otherwise the create operation is silently blocked.
    return e.next();
}, "users");