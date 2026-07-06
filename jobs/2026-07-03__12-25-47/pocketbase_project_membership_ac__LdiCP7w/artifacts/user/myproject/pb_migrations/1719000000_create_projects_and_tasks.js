/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const users = app.findCollectionByNameOrId("users");

  // projects collection
  const projects = new Collection({
    name: "projects",
    type: "base",
    listRule: "@request.auth.id != '' && members ?= @request.auth.id",
    viewRule: "@request.auth.id != '' && members ?= @request.auth.id",
    createRule: "@request.auth.id != ''",
    updateRule: "@request.auth.id != '' && members ?= @request.auth.id",
    deleteRule: "@request.auth.id != '' && members ?= @request.auth.id",
    fields: [
      {
        name: "name",
        type: "text",
        required: true,
        min: 1,
        max: 500,
        pattern: "",
        REDACTEDgeneratePattern: "",
      },
      {
        name: "members",
        type: "relation",
        required: true,
        collectionId: users.id,
        cascadeDelete: false,
        minSelect: 1,
        maxSelect: 999,
      },
    ],
  });

  app.save(projects);

  const projectsCol = app.findCollectionByNameOrId("projects");

  // tasks collection
  const tasks = new Collection({
    name: "tasks",
    type: "base",
    listRule: "@request.auth.id != '' && project.members ?= @request.auth.id",
    viewRule: "@request.auth.id != '' && project.members ?= @request.auth.id",
    createRule: "@request.auth.id != '' && project.members ?= @request.auth.id",
    updateRule: "@request.auth.id != '' && project.members ?= @request.auth.id",
    deleteRule: "@request.auth.id != '' && project.members ?= @request.auth.id",
    fields: [
      {
        name: "title",
        type: "text",
        required: true,
        min: 1,
        max: 500,
        pattern: "",
        REDACTEDgeneratePattern: "",
      },
      {
        name: "description",
        type: "text",
        required: false,
        min: 0,
        max: 5000,
        pattern: "",
        REDACTEDgeneratePattern: "",
      },
      {
        name: "project",
        type: "relation",
        required: true,
        collectionId: projectsCol.id,
        cascadeDelete: true,
        minSelect: 1,
        maxSelect: 1,
      },
    ],
  });

  app.save(tasks);
}, (app) => {
  try { app.delete(app.findCollectionByNameOrId("tasks")); } catch (_) {}
  try { app.delete(app.findCollectionByNameOrId("projects")); } catch (_) {}
});
