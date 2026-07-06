/// <reference path="../pb_data/pb_hooks/types.d.ts" />

// Sanitize the email field on every new user record creation request:
// - trim leading/trailing whitespace
// - lowercase the value
//
// Only the built-in "users" collection is targeted. Other auth collections
// (e.g. _superusers) and any custom collections are left untouched.

onRecordCreateRequest(function (e) {
    if (e.collection.name !== "users") {
        e.next();
        return;
    }

    var record = e.record;
    var original = record.get("email");

    if (typeof original === "string") {
        var sanitized = original.replace(/^\s+|\s+$/g, "").toLowerCase();
        if (sanitized !== original) {
            record.set("email", sanitized);
        }
    }

    e.next();
}, "users");
