/// <reference path="../pb_data/types.d.ts" />

// Creates the `projects` base collection and the `tasks` base collection,
// wiring API rules so that membership in a project transitively grants
// access to that project's tasks.

migrate(
  (app) => {
    const users = app.findCollectionByNameOrId("users");

    // --- projects ---
    const projects = new Collection({
      type: "base",
      name: "projects",
      listRule:   "@request.auth.id != '' && members.id ?= @request.auth.id",
      viewRule:   "@request.auth.id != '' && members.id ?= @request.auth.id",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != '' && members.id ?= @request.auth.id",
      deleteRule: "@request.auth.id != '' && members.id ?= @request.auth.id",
      fields: [
        {
          name:     "name",
          type:     "text",
          required: true,
          min:      1,
        },
        {
          name:        "members",
          type:        "relation",
          required:    true,
          collectionId: users.id,
          minSelect:   1,
          maxSelect:   100,
        },
      ],
    });
    app.save(projects);

    // --- tasks ---
    const tasks = new Collection({
      type: "base",
      name: "tasks",
      listRule:   "@request.auth.id != '' && project.members.id ?= @request.auth.id",
      viewRule:   "@request.auth.id != '' && project.members.id ?= @request.auth.id",
      createRule: "@request.auth.id != '' && project.members.id ?= @request.auth.id",
      updateRule: "@request.auth.id != '' && project.members.id ?= @request.auth.id",
      deleteRule: "@request.auth.id != '' && project.members.id ?= @request.auth.id",
      fields: [
        {
          name:     "title",
          type:     "text",
          required: true,
          min:      1,
        },
        {
          name: "description",
          type: "text",
        },
        {
          name:        "project",
          type:        "relation",
          required:    true,
          collectionId: projects.id,
          maxSelect:   1,
        },
      ],
    });
    app.save(tasks);
  },
  (app) => {
    // Rollback: delete the collections in reverse dependency order.
    try {
      app.delete(app.findCollectionByNameOrId("tasks"));
    } catch (_) {}
    try {
      app.delete(app.findCollectionByNameOrId("projects"));
    } catch (_) {}
  },
);