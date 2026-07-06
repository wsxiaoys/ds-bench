migrate((app) => {
  // Find users collection ID
  const usersCollection = app.findCollectionByNameOrId("users");
  const usersCollectionId = usersCollection.id;

  // Create projects collection
  const projectsCollection = new Collection({
    name: "projects",
    type: "base",
    listRule: "@request.auth.id != '' && members.id ?= @request.auth.id",
    viewRule: "@request.auth.id != '' && members.id ?= @request.auth.id",
    createRule: "@request.auth.id != ''",
    updateRule: "@request.auth.id != '' && members.id ?= @request.auth.id",
    deleteRule: "@request.auth.id != '' && members.id ?= @request.auth.id",
    fields: [
      {
        name: "name",
        type: "text",
        required: true,
      },
      {
        name: "members",
        type: "relation",
        required: true,
        collectionId: usersCollectionId,
        maxSelect: 9999999, // multi-select with no upper bound
      }
    ]
  });

  app.save(projectsCollection);

  // Create tasks collection
  const tasksCollection = new Collection({
    name: "tasks",
    type: "base",
    listRule: "@request.auth.id != '' && project.members.id ?= @request.auth.id",
    viewRule: "@request.auth.id != '' && project.members.id ?= @request.auth.id",
    createRule: "@request.auth.id != '' && project.members.id ?= @request.auth.id",
    updateRule: "@request.auth.id != '' && project.members.id ?= @request.auth.id",
    deleteRule: "@request.auth.id != '' && project.members.id ?= @request.auth.id",
    fields: [
      {
        name: "title",
        type: "text",
        required: true,
      },
      {
        name: "description",
        type: "text",
        required: false,
      },
      {
        name: "project",
        type: "relation",
        required: true,
        collectionId: projectsCollection.id,
        maxSelect: 1, // single-relation
      }
    ]
  });

  app.save(tasksCollection);
}, (app) => {
  // Rollback migration
  try {
    const tasksCollection = app.findCollectionByNameOrId("tasks");
    app.delete(tasksCollection);
  } catch (e) {}

  try {
    const projectsCollection = app.findCollectionByNameOrId("projects");
    app.delete(projectsCollection);
  } catch (e) {}
});
