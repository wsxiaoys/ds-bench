/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  // -----------------------------------------------------------------
  // 1. organizations
  // -----------------------------------------------------------------
  const organizations = new Collection({
    name: "organizations",
    type: "base",
    listRule: "@request.auth.id != \"\"",
    viewRule: "@request.auth.id != \"\"",
    createRule: "@request.auth.id != \"\"",
    updateRule: "@request.auth.id != \"\"",
    deleteRule: "@request.auth.id != \"\"",
    fields: [
      {
        name: "name",
        type: "text",
        required: true,
        min: 1,
        max: 200,
      },
    ],
  });
  app.save(organizations);

  // -----------------------------------------------------------------
  // 2. organization_members
  // -----------------------------------------------------------------
  const organizationMembers = new Collection({
    name: "organization_members",
    type: "base",
    listRule: "@request.auth.id != \"\"",
    viewRule: "@request.auth.id != \"\"",
    createRule: "@request.auth.id != \"\"",
    updateRule: "@request.auth.id != \"\"",
    deleteRule: "@request.auth.id != \"\"",
    fields: [
      {
        name: "user",
        type: "relation",
        required: true,
        collectionId: "_pb_users_auth_",
        cascadeDelete: true,
        minSelect: 1,
        maxSelect: 1,
      },
      {
        name: "organization",
        type: "relation",
        required: true,
        collectionId: organizations.id,
        cascadeDelete: true,
        minSelect: 1,
        maxSelect: 1,
      },
      {
        name: "role",
        type: "select",
        required: true,
        values: ["owner", "editor", "viewer"],
        maxSelect: 1,
      },
    ],
  });
  app.save(organizationMembers);

  // -----------------------------------------------------------------
  // 3. documents
  // -----------------------------------------------------------------
  // List/View rule:
  //   A user can read a document only if there is an
  //   organization_members record linking them to the document's
  //   organization (regardless of role).
  //
  // Create rule:
  //   A user can create a document only if they have an `owner` or
  //   `editor` role in the organization they are assigning the
  //   document to (i.e. @request.body.organization).
  //
  // Update rule:
  //   A user can update a document only if they have an `owner` or
  //   `editor` role in the document's current organization.
  //
  // Delete rule:
  //   A user can delete a document only if they have an `owner`
  //   role in the document's current organization.
  // -----------------------------------------------------------------
  const documents = new Collection({
    name: "documents",
    type: "base",
    listRule:
      "@request.auth.id != \"\" && " +
      "@collection.organization_members.user.id ?= @request.auth.id && " +
      "@collection.organization_members.organization.id ?= organization",
    viewRule:
      "@request.auth.id != \"\" && " +
      "@collection.organization_members.user.id ?= @request.auth.id && " +
      "@collection.organization_members.organization.id ?= organization",
    createRule:
      "@request.auth.id != \"\" && " +
      "@request.body.organization != \"\" && " +
      "@collection.organization_members.user.id ?= @request.auth.id && " +
      "@collection.organization_members.organization.id ?= @request.body.organization && " +
      "(@collection.organization_members.role ?= \"owner\" || " +
      " @collection.organization_members.role ?= \"editor\")",
    updateRule:
      "@request.auth.id != \"\" && " +
      "@collection.organization_members.user.id ?= @request.auth.id && " +
      "@collection.organization_members.organization.id ?= organization && " +
      "(@collection.organization_members.role ?= \"owner\" || " +
      " @collection.organization_members.role ?= \"editor\")",
    deleteRule:
      "@request.auth.id != \"\" && " +
      "@collection.organization_members.user.id ?= @request.auth.id && " +
      "@collection.organization_members.organization.id ?= organization && " +
      "@collection.organization_members.role ?= \"owner\"",
    fields: [
      {
        name: "title",
        type: "text",
        required: true,
        min: 1,
        max: 500,
      },
      {
        name: "content",
        type: "text",
        max: 100000,
      },
      {
        name: "organization",
        type: "relation",
        required: true,
        collectionId: organizations.id,
        cascadeDelete: true,
        minSelect: 1,
        maxSelect: 1,
      },
    ],
  });
  app.save(documents);
}, (app) => {
  // Rollback migrations
  try {
    app.delete(app.findCollectionByNameOrId("documents"));
  } catch (_) {}

  try {
    app.delete(app.findCollectionByNameOrId("organization_members"));
  } catch (_) {}

  try {
    app.delete(app.findCollectionByNameOrId("organizations"));
  } catch (_) {}
});
