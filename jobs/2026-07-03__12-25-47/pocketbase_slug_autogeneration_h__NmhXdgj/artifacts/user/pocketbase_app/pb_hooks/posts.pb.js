/// <reference path="../pb_data/types.d.ts" />

onRecordCreateRequest(function (e) {
    var title = e.record.get("title");
    if (!title || String(title).trim() === "") {
        throw new BadRequestError("Title cannot be empty");
    }
    var slug = String(title)
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-+|-+$/g, "");
    e.record.set("slug", slug);
    e.next();
}, "posts");
