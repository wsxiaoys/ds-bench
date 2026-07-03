onRecordCreateRequest((e) => {
  try {
    const title = e.record.get("title");
    if (!title) {
      throw new BadRequestError("Title cannot be empty");
    }

    console.log("Global keys: ", Object.getOwnPropertyNames(this));
    console.log("Global keys (global): ", typeof global !== "undefined" ? Object.getOwnPropertyNames(global) : "no global");

    const slug = $String.slugify(title);
    e.record.set("slug", slug);

    return e.next();
  } catch (err) {
    console.log("Error in hook: ", err);
    throw err;
  }
}, "posts");
