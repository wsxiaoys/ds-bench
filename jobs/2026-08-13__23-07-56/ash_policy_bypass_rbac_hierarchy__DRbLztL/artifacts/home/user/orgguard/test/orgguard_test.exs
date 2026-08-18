defmodule OrgGuardTest do
  use ExUnit.Case, async: false

  alias OrgGuard.Access
  alias OrgGuard.Access.{User, OrgUnit, RoleAssignment, Document}

  setup do
    for resource <- [User, OrgUnit, RoleAssignment, Document] do
      try do
        :ets.delete_all_objects(resource)
      rescue
        _ -> :ok
      end
    end

    :ok
  end

  test "complete RBAC flow and capabilities" do
    # 1. Create Org Units: Root -> Child -> Grandchild
    root = Access.create_org_unit!(%{code: "ROOT", name: "Root Unit"}, authorize?: false)
    child = Access.create_org_unit!(%{code: "CHILD", name: "Child Unit", parent_id: root.id}, authorize?: false)
    grandchild = Access.create_org_unit!(%{code: "GRANDCHILD", name: "Grandchild Unit", parent_id: child.id}, authorize?: false)

    # 2. Create Users
    bob = Access.create_user!(%{email: "bob@example.com", status: :active, global_role: :member}, authorize?: false)
    alice = Access.create_user!(%{email: "alice@example.com", status: :active, global_role: :member}, authorize?: false)
    suspended_user = Access.create_user!(%{email: "suspended@example.com", status: :suspended, global_role: :member}, authorize?: false)
    _break_glass_user = Access.create_user!(%{email: "bg@example.com", status: :active, global_role: :break_glass}, authorize?: false)
    suspended_bg_user = Access.create_user!(%{email: "sbg@example.com", status: :suspended, global_role: :break_glass}, authorize?: false)

    # 3. Create Documents
    doc_root = Access.create_document!(%{title: "Root Doc", budget_cents: 1000, org_unit_id: root.id}, authorize?: false)
    doc_child = Access.create_document!(%{title: "Child Doc", budget_cents: 5000, org_unit_id: child.id}, authorize?: false)
    doc_grandchild = Access.create_document!(%{title: "Grandchild Doc", budget_cents: 9000, org_unit_id: grandchild.id}, authorize?: false)

    # 4. Assign Roles
    # Bob has viewer on Root
    Access.create_role_assignment!(%{user_id: bob.id, org_unit_id: root.id, role: :viewer, effect: :grant}, authorize?: false)

    # Alice has editor on Child, auditor on Root, and deny editor on Grandchild
    Access.create_role_assignment!(%{user_id: alice.id, org_unit_id: child.id, role: :editor, effect: :grant}, authorize?: false)
    Access.create_role_assignment!(%{user_id: alice.id, org_unit_id: root.id, role: :auditor, effect: :grant}, authorize?: false)
    Access.create_role_assignment!(%{user_id: alice.id, org_unit_id: grandchild.id, role: :editor, effect: :deny}, authorize?: false)

    # Let's assert capabilities using the resolver first
    # Bob:
    # - viewer on Root -> read on [Root, Child, Grandchild]
    assert root.id in OrgGuard.Access.Resolver.allowed_org_units(bob, :read)
    assert child.id in OrgGuard.Access.Resolver.allowed_org_units(bob, :read)
    assert grandchild.id in OrgGuard.Access.Resolver.allowed_org_units(bob, :read)
    refute root.id in OrgGuard.Access.Resolver.allowed_org_units(bob, :write)

    # Alice:
    # - auditor on Root -> read/view_budget on [Root, Child, Grandchild]
    # - editor on Child -> read/write/delete/relocate/view_budget? No, editor only has [read, write]
    #   Wait, editor has [read, write] capabilities!
    #   So Alice has write on Child, read on Child.
    # - deny editor on Grandchild -> editor role is denied at Grandchild.
    #   So at Grandchild, Alice only has auditor (inherited from Root).
    #   Auditor has read, view_budget. So Alice has read, view_budget on Grandchild, but NOT write!
    assert root.id in OrgGuard.Access.Resolver.allowed_org_units(alice, :read)
    assert child.id in OrgGuard.Access.Resolver.allowed_org_units(alice, :read)
    assert grandchild.id in OrgGuard.Access.Resolver.allowed_org_units(alice, :read)

    assert root.id in OrgGuard.Access.Resolver.allowed_org_units(alice, :view_budget)
    assert child.id in OrgGuard.Access.Resolver.allowed_org_units(alice, :view_budget)
    assert grandchild.id in OrgGuard.Access.Resolver.allowed_org_units(alice, :view_budget)

    refute root.id in OrgGuard.Access.Resolver.allowed_org_units(alice, :write)
    assert child.id in OrgGuard.Access.Resolver.allowed_org_units(alice, :write)
    refute grandchild.id in OrgGuard.Access.Resolver.allowed_org_units(alice, :write)

    # Let's assert Document operations via the authorized code interface!

    # --- READS ---
    # Bob can read all documents
    docs = Access.list_documents!(actor: bob)
    assert length(docs) == 3
    # Bob does not have view_budget, so budget_cents should be masked
    for doc <- docs do
      assert %Ash.ForbiddenField{} = doc.budget_cents
    end

    # Alice can read all documents
    alice_docs = Access.list_documents!(actor: alice)
    assert length(alice_docs) == 3
    # Alice has view_budget, so budget_cents should NOT be masked
    assert Enum.find(alice_docs, & &1.id == doc_root.id).budget_cents == 1000
    assert Enum.find(alice_docs, & &1.id == doc_child.id).budget_cents == 5000
    assert Enum.find(alice_docs, & &1.id == doc_grandchild.id).budget_cents == 9000

    # Suspended user cannot read anything
    assert_raise Ash.Error.Forbidden, fn ->
      Access.list_documents!(actor: suspended_user)
    end

    # Break glass user (even suspended) can read everything and see budget_cents unmasked
    bg_docs = Access.list_documents!(actor: suspended_bg_user)
    assert length(bg_docs) == 3
    assert Enum.find(bg_docs, & &1.id == doc_root.id).budget_cents == 1000

    # Fetching single document by ID:
    # Bob can fetch doc_root
    assert {:ok, _} = Access.get_document(doc_root.id, actor: bob)
    # A user with no roles cannot read doc_root
    no_role_user = Access.create_user!(%{email: "norole@example.com"}, authorize?: false)
    assert {:error, %Ash.Error.Invalid{errors: [%Ash.Error.Query.NotFound{}]}} = Access.get_document(doc_root.id, actor: no_role_user)

    # --- CREATES ---
    # Alice has write on child, so she can create a document in child
    assert {:ok, new_doc} = Access.create_document(%{title: "New Doc", budget_cents: 100, org_unit_id: child.id}, actor: alice)
    assert new_doc.title == "New Doc"

    # Alice does not have write on root, so she cannot create a document in root
    assert {:error, %Ash.Error.Forbidden{}} = Access.create_document(%{title: "New Doc Root", budget_cents: 100, org_unit_id: root.id}, actor: alice)

    # --- UPDATES ---
    # Alice has write and view_budget on child, so she can update child doc's title and budget
    assert {:ok, updated_child} = Access.update_document(doc_child, %{title: "Updated Child Doc", budget_cents: 6000}, actor: alice)
    assert updated_child.title == "Updated Child Doc"
    assert updated_child.budget_cents == 6000

    # Alice has write on child, but does Bob?
    # Bob has viewer on Root (inherited down to Child), but viewer only has read, NOT write.
    # So Bob cannot update child doc
    assert {:error, %Ash.Error.Forbidden{}} = Access.update_document(doc_child, %{title: "Bob Update"}, actor: bob)

    # Alice has write on Child, but on Grandchild she is denied editor role.
    # So Alice does NOT have write on Grandchild. She cannot update grandchild doc's title.
    assert {:error, %Ash.Error.Forbidden{}} = Access.update_document(doc_grandchild, %{title: "Alice Update GC"}, actor: alice)

    # What if Bob updates a doc but does not have write? Forbidden.
    # What if Alice updates a doc where she has write but NOT view_budget?
    # Let's create a role/assignment that gives write but NOT view_budget.
    # Editor role has read, write. It does NOT have view_budget.
    # Alice has editor on Child. So she has write but NOT view_budget from editor!
    # Wait, but Alice also has auditor on Root, which gives view_budget! So she has both.
    # Let's create a new user Charlie with ONLY editor on Child.
    charlie = Access.create_user!(%{email: "charlie@example.com"}, authorize?: false)
    Access.create_role_assignment!(%{user_id: charlie.id, org_unit_id: child.id, role: :editor, effect: :grant}, authorize?: false)
    # Charlie has write on Child, but NOT view_budget.
    # Charlie should be able to update title:
    assert {:ok, updated_by_charlie} = Access.update_document(doc_child, %{title: "Charlie Update"}, actor: charlie)
    assert updated_by_charlie.title == "Charlie Update"
    # But Charlie should NOT be able to update budget_cents:
    assert {:error, %Ash.Error.Forbidden{}} = Access.update_document(doc_child, %{budget_cents: 7000}, actor: charlie)

    # --- DESTROYS ---
    # unit_admin has delete. Editor does not.
    # Let's assign unit_admin on Child to Alice
    Access.create_role_assignment!(%{user_id: alice.id, org_unit_id: child.id, role: :unit_admin, effect: :grant}, authorize?: false)
    # Now Alice has unit_admin on Child. So she can delete child doc:
    assert :ok = Access.destroy_document(doc_child, actor: alice)

    # Bob does not have delete, so he cannot delete root doc:
    assert {:error, %Ash.Error.Forbidden{}} = Access.destroy_document(doc_root, actor: bob)

    # --- RELOCATION ---
    # relocate requires relocate capability at both source and target org units.
    # unit_admin has relocate.
    # Let's create a new document in child unit first
    doc_to_move = Access.create_document!(%{title: "To Move", budget_cents: 200, org_unit_id: child.id}, authorize?: false)

    # Alice is unit_admin on Child. But is she unit_admin on Grandchild?
    # unit_admin on Child inherits down to Grandchild!
    # So Alice has relocate capability on both Child and Grandchild.
    # She should be able to relocate doc_to_move from Child to Grandchild:
    assert {:ok, relocated_doc} = Access.relocate_document(doc_to_move.id, grandchild.id, actor: alice)
    assert relocated_doc.org_unit_id == grandchild.id

    # Bob does not have relocate capability on Root or Child.
    # He cannot relocate:
    assert {:error, %Ash.Error.Forbidden{}} = Access.relocate_document(relocated_doc.id, root.id, actor: bob)

    # --- can_*? INTROSPECTION ---
    assert Access.can_create_document?(alice, %{org_unit_id: child.id})
    refute Access.can_create_document?(bob, %{org_unit_id: child.id})
    refute Access.can_create_document?(nil, %{org_unit_id: child.id})
  end
end
