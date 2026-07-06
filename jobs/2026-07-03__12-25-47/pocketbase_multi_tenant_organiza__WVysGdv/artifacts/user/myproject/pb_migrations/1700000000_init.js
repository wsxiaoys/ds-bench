/// <reference path="../pb_data/types.d.ts" />

migrate((txApp) => {
  // Create organizations collection
  const organizations = new Collection({
    name: "organizations",
    type: "base",
    fields: [
      {
        name: "name",
        type: "text",
        required: true,
      },
    ],
  });
  txApp.save(organizations);

  // Create organization_members collection
  const organizationMembers = new Collection({
    name: "organization_members",
    type: "base",
    fields: [
      {
        name: "user",
        type: "relation",
        required: true,
        collectionId: "_pb_users_auth_",
        cascadeDelete: true,
        maxSelect: 1,
      },
      {
        name: "organization",
        type: "relation",
        required: true,
        collectionId: organizations.id,
        cascadeDelete: true,
        maxSelect: 1,
      },
      {
        name: "role",
        type: "select",
        required: true,
        maxSelect: 1,
        values: ["owner", "editor", "viewer"],
      },
    ],
  });
  txApp.save(organizationMembers);

  // Create documents collection
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
        collectionId: organizations.id,
        cascadeDelete: true,
        maxSelect: 1,
      },
    ],
    listRule:
      '@request.auth.id != "" && @collection.organization_members.user ?= @request.auth.id && @collection.organization_members.organization ?= organization',
    viewRule:
      '@request.auth.id != "" && @collection.organization_members.user ?= @request.auth.id && @collection.organization_members.organization ?= organization',
    createRule:
      '@request.auth.id != "" && @collection.organization_members.user ?= @request.auth.id && @collection.organization_members.organization ?= @request.body.organization && (@collection.organization_members.role = "owner" || @collection.organization_members.role = "editor")',
    updateRule:
      '@request.auth.id != "" && @collection.organization_members.user ?= @request.auth.id && @collection.organization_members.organization ?= organization && (@collection.organization_members.role = "owner" || @collection.organization_members.role = "editor")',
    deleteRule:
      '@request.auth.id != "" && @collection.organization_members.user ?= @request.auth.id && @collection.organization_members.organization ?= organization && @collection.organization_members.role = "owner"',
  });
  txApp.save(documents);
}, (txApp) => {
  try { txApp.delete(txApp.findCollectionByNameOrId("documents")); } catch (_) {}
  try { txApp.delete(txApp.findCollectionByNameOrId("organization_members")); } catch (_) {}
  try { txApp.delete(txApp.findCollectionByNameOrId("organizations")); } catch (_) {}
});
