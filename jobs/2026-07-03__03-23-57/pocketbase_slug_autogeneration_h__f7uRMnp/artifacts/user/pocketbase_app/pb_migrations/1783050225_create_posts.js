migrate((app) => {
  const collection = new Collection({
    name: "posts",
    type: "base",
    createRule: "",
    listRule: "",
    viewRule: "",
    fields: [
      {
        name: "title",
        type: "text",
        required: false,
      },
      {
        name: "slug",
        type: "text",
        required: false,
      }
    ]
  });
  app.save(collection);
}, (app) => {
  try {
    const collection = app.findCollectionByNameOrId("posts");
    app.delete(collection);
  } catch (e) {}
});
