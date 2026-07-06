/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // Resolve the built-in users collection id
    const usersCollectionId = app.findCollectionByNameOrId("users").id;

    // ---------------------------------------------------------------------
    // projects collection
    // ---------------------------------------------------------------------
    const projects = new Collection({
      name: "projects",
      type: "base",
      fields: [
        {
          name: "name",
          type: "text",
          required: true,
          min: 1,
        },
        {
          name: "members",
          type: "relation",
          required: true,
          collectionId: usersCollectionId,
          minSelect: 1,
          // multi-select with effectively no upper bound
          // (PocketBase v0.31 has no truly unlimited option; the
          //  dashboard defaults "Multiple" relations to 999)
          maxSelect: 999,
        },
      ],
      // only authenticated users listed in members can list/view
      listRule: "members.id ?= @request.auth.id",
      viewRule: "members.id ?= @request.auth.id",
      // any authenticated user can create a project
      createRule: "@request.auth.id != ''",
      // only members can update/delete
      updateRule: "members.id ?= @request.auth.id",
      deleteRule: "members.id ?= @request.auth.id",
    });

    app.save(projects);

    // ---------------------------------------------------------------------
    // tasks collection
    // ---------------------------------------------------------------------
    const projectsCollectionId = projects.id;

    const tasks = new Collection({
      name: "tasks",
      type: "base",
      fields: [
        {
          name: "title",
          type: "text",
          required: true,
          min: 1,
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
          collectionId: projectsCollectionId,
          minSelect: 1,
          maxSelect: 1, // single relation
        },
      ],
      // all rules require authentication AND membership in the parent
      // project (via the nested project.members relation). The ?= "any-of"
      // operator implicitly requires a non-empty @request.auth.id since no
      // member record has an empty id, so guests are blocked.
      listRule: "project.members.id ?= @request.auth.id",
      viewRule: "project.members.id ?= @request.auth.id",
      createRule: "project.members.id ?= @request.auth.id",
      updateRule: "project.members.id ?= @request.auth.id",
      deleteRule: "project.members.id ?= @request.auth.id",
    });

    app.save(tasks);
  },
  (app) => {
    // rollback
    try {
      const tasks = app.findCollectionByNameOrId("tasks");
      app.delete(tasks);
    } catch (e) {
      // already gone
    }
    try {
      const projects = app.findCollectionByNameOrId("projects");
      app.delete(projects);
    } catch (e) {
      // already gone
    }
  }
);