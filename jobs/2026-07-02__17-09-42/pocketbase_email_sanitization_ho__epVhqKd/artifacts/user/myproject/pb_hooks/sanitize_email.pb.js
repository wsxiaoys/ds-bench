/// <reference path="../pb_data/types.d.ts" />

// Sanitize the `email` field on every incoming user-record creation request.
//
// Rules:
//  - Only target the built-in `users` collection (skip `_superusers` etc.).
//  - Trim surrounding whitespace and lowercase the value before persisting.
//  - Run synchronously (the embedded Goja engine does not support Promises).

onRecordCreateRequest((e) => {
    // Hard guard so we never touch other auth collections (e.g. _superusers).
    if (e.record && e.record.collection() && e.record.collection().name === "users") {
        const email = e.record.get("email");
        if (typeof email === "string") {
            e.record.set("email", email.trim().toLowerCase());
        }
    }

    // Always propagate the chain so the request proceeds.
    return e.next();
}, "users");