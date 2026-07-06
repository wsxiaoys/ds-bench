/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  // Only create the collection if it doesn't already exist, so that the
  // migration is safe to run even if the schema was applied out-of-band.
  let collection;
  try {
    collection = app.findCollectionByNameOrId("tasks");
  } catch (e) {
    collection = new Collection({
      name: "tasks",
      type: "base",
      fields: [
        {
          name: "title",
          type: "text",
          required: true,
        },
        {
          name: "done",
          type: "bool",
        },
        {
          name: "due",
          type: "date",
        },
      ],
    });
    app.save(collection);
  }
}, (app) => {
  let collection = app.findCollectionByNameOrId("tasks");
  app.delete(collection);
});
