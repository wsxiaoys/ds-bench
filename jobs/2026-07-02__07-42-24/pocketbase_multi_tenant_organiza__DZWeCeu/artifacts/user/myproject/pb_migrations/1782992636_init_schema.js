/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  // 1. Create organizations collection
  const organizations = new Collection({
    name: "organizations",
    type: "base",
    fields: [
      {
        name: "name",
        type: "text",
        required: true,
      }
    ]
  });
  app.save(organizations);

  // 2. Create organization_members collection
  const usersCollection = app.findCollectionByNameOrId("users");
  const organizationsCollection = app.findCollectionByNameOrId("organizations");

  const organization_members = new Collection({
    name: "organization_members",
    type: "base",
    fields: [
      {
        name: "user",
        type: "relation",
        required: true,
        collectionId: usersCollection.id,
        maxSelect: 1,
        cascadeDelete: true,
      },
      {
        name: "organization",
        type: "relation",
        required: true,
        collectionId: organizationsCollection.id,
        maxSelect: 1,
        cascadeDelete: true,
      },
      {
        name: "role",
        type: "select",
        required: true,
        values: ["owner", "editor", "viewer"],
        maxSelect: 1,
      }
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_user_org ON organization_members (user, organization)"
    ]
  });
  app.save(organization_members);

  // 3. Create documents collection
  const documents = new Collection({
    name: "documents",
    type: "base",
    fields: [
      {
        name: "title",
        type: "text",
        required: true,
      },
      {
        name: "content",
        type: "text",
      },
      {
        name: "organization",
        type: "relation",
        required: true,
        collectionId: organizationsCollection.id,
        maxSelect: 1,
        cascadeDelete: true,
      }
    ],
    listRule: '@request.auth.id != "" && @collection.organization_members.user ?= @request.auth.id && @collection.organization_members.organization ?= organization',
    viewRule: '@request.auth.id != "" && @collection.organization_members.user ?= @request.auth.id && @collection.organization_members.organization ?= organization',
    createRule: '@request.auth.id != "" && @collection.organization_members.user ?= @request.auth.id && @collection.organization_members.organization ?= @request.body.organization && (@collection.organization_members.role = "owner" || @collection.organization_members.role = "editor")',
    updateRule: '@request.auth.id != "" && @collection.organization_members.user ?= @request.auth.id && @collection.organization_members.organization ?= organization && (@collection.organization_members.role = "owner" || @collection.organization_members.role = "editor")',
    deleteRule: '@request.auth.id != "" && @collection.organization_members.user ?= @request.auth.id && @collection.organization_members.organization ?= organization && @collection.organization_members.role = "owner"'
  });
  app.save(documents);

}, (app) => {
  // Revert operations
  try {
    const documents = app.findCollectionByNameOrId("documents");
    app.delete(documents);
  } catch (e) {}

  try {
    const organization_members = app.findCollectionByNameOrId("organization_members");
    app.delete(organization_members);
  } catch (e) {}

  try {
    const organizations = app.findCollectionByNameOrId("organizations");
    app.delete(organizations);
  } catch (e) {}
});
