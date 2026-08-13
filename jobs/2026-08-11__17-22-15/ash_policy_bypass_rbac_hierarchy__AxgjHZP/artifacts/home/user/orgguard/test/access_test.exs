defmodule OrgGuard.AccessTest do
  use ExUnit.Case, async: true

  setup do
    # Since storage is shared between processes, we should be careful with concurrent test isolation if needed.
    # However, since ETS is shared and we are running tests, we can generate unique codes/emails or run sequentially.
    # To be perfectly safe, let's run sequential or use unique prefixes for our fixtures.
    :ok
  end

  defp unique_email, do: "user-#{System.unique_integer([:positive])}@example.com"
  defp unique_code, do: "org-#{System.unique_integer([:positive])}"

  test "hierarchical RBAC permission resolution and capabilities" do
    # Create org units: Root -> Child -> Grandchild
    {:ok, root} = OrgGuard.Access.create_org_unit(%{code: unique_code(), name: "Root"}, authorize?: false)
    {:ok, child} = OrgGuard.Access.create_org_unit(%{code: unique_code(), name: "Child", parent_id: root.id}, authorize?: false)
    {:ok, grandchild} = OrgGuard.Access.create_org_unit(%{code: unique_code(), name: "Grandchild", parent_id: child.id}, authorize?: false)

    # Create users
    {:ok, u_viewer} = OrgGuard.Access.create_user(%{email: unique_email(), status: :active, global_role: :member}, authorize?: false)
    {:ok, u_editor} = OrgGuard.Access.create_user(%{email: unique_email(), status: :active, global_role: :member}, authorize?: false)
    {:ok, _u_admin} = OrgGuard.Access.create_user(%{email: unique_email(), status: :active, global_role: :member}, authorize?: false)

    # 1. Viewer role at Root -> should inherit down to child and grandchild
    {:ok, _} = OrgGuard.Access.create_role_assignment(%{user_id: u_viewer.id, org_unit_id: root.id, role: :viewer, effect: :grant}, authorize?: false)

    assert OrgGuard.Policy.Helper.has_capability?(u_viewer, root.id, :read)
    assert OrgGuard.Policy.Helper.has_capability?(u_viewer, child.id, :read)
    assert OrgGuard.Policy.Helper.has_capability?(u_viewer, grandchild.id, :read)

    refute OrgGuard.Policy.Helper.has_capability?(u_viewer, root.id, :write)
    refute OrgGuard.Policy.Helper.has_capability?(u_viewer, child.id, :write)

    # 2. Editor role at Child -> should inherit to grandchild, but not root
    {:ok, _} = OrgGuard.Access.create_role_assignment(%{user_id: u_editor.id, org_unit_id: child.id, role: :editor, effect: :grant}, authorize?: false)

    refute OrgGuard.Policy.Helper.has_capability?(u_editor, root.id, :read)
    assert OrgGuard.Policy.Helper.has_capability?(u_editor, child.id, :read)
    assert OrgGuard.Policy.Helper.has_capability?(u_editor, child.id, :write)
    assert OrgGuard.Policy.Helper.has_capability?(u_editor, grandchild.id, :read)
    assert OrgGuard.Policy.Helper.has_capability?(u_editor, grandchild.id, :write)

    # 3. Deny at Child for Editor
    # Let's grant Editor at Root, but Deny at Child
    {:ok, u_denied} = OrgGuard.Access.create_user(%{email: unique_email(), status: :active, global_role: :member}, authorize?: false)
    {:ok, _} = OrgGuard.Access.create_role_assignment(%{user_id: u_denied.id, org_unit_id: root.id, role: :editor, effect: :grant}, authorize?: false)
    {:ok, _} = OrgGuard.Access.create_role_assignment(%{user_id: u_denied.id, org_unit_id: child.id, role: :editor, effect: :deny}, authorize?: false)

    # At Root: holds editor
    assert OrgGuard.Policy.Helper.has_capability?(u_denied, root.id, :write)
    # At Child: denied editor (explicit deny stops search)
    refute OrgGuard.Policy.Helper.has_capability?(u_denied, child.id, :write)
    # At Grandchild: also denied because nearest ancestor with assignment is Child, which has deny
    refute OrgGuard.Policy.Helper.has_capability?(u_denied, grandchild.id, :write)

    # 4. Re-grant at Grandchild after Deny at Child
    {:ok, _} = OrgGuard.Access.create_role_assignment(%{user_id: u_denied.id, org_unit_id: grandchild.id, role: :editor, effect: :grant}, authorize?: false)
    # At Grandchild: nearest assignment is Grandchild (grant), so holds editor!
    assert OrgGuard.Policy.Helper.has_capability?(u_denied, grandchild.id, :write)
  end

  test "break-glass actor bypasses all policies even if suspended" do
    {:ok, root} = OrgGuard.Access.create_org_unit(%{code: unique_code(), name: "Root"}, authorize?: false)
    {:ok, doc} = OrgGuard.Access.create_document(%{title: "Secret", budget_cents: 1000, org_unit_id: root.id}, authorize?: false)

    {:ok, bg_user} = OrgGuard.Access.create_user(%{email: unique_email(), status: :suspended, global_role: :break_glass}, authorize?: false)

    # Can read
    assert {:ok, fetched} = OrgGuard.Access.get_document(doc.id, actor: bg_user)
    assert fetched.title == "Secret"
    assert fetched.budget_cents == 1000

    # Can list
    assert {:ok, docs} = OrgGuard.Access.list_documents(actor: bg_user)
    assert Enum.any?(docs, &(&1.id == doc.id))

    # Can update
    assert {:ok, updated} = OrgGuard.Access.update_document(doc, %{title: "Updated Secret", budget_cents: 2000}, actor: bg_user)
    assert updated.title == "Updated Secret"
    assert updated.budget_cents == 2000

    # Can create
    assert {:ok, new_doc} = OrgGuard.Access.create_document(%{title: "New Secret", budget_cents: 500, org_unit_id: root.id}, actor: bg_user)
    assert new_doc.title == "New Secret"

    # Can relocate
    {:ok, target_unit} = OrgGuard.Access.create_org_unit(%{code: unique_code(), name: "Target"}, authorize?: false)
    assert {:ok, relocated} = OrgGuard.Access.relocate_document(new_doc.id, target_unit.id, actor: bg_user)
    assert relocated.org_unit_id == target_unit.id

    # Can destroy
    assert :ok = OrgGuard.Access.destroy_document(relocated, actor: bg_user)
  end

  test "suspended non-break-glass actor is forbidden from everything" do
    {:ok, root} = OrgGuard.Access.create_org_unit(%{code: unique_code(), name: "Root"}, authorize?: false)
    {:ok, doc} = OrgGuard.Access.create_document(%{title: "Secret", budget_cents: 1000, org_unit_id: root.id}, authorize?: false)

    {:ok, user} = OrgGuard.Access.create_user(%{email: unique_email(), status: :suspended, global_role: :member}, authorize?: false)
    # Give them unit_admin role (which has all capabilities)
    {:ok, _} = OrgGuard.Access.create_role_assignment(%{user_id: user.id, org_unit_id: root.id, role: :unit_admin, effect: :grant}, authorize?: false)

    # Get fails with Forbidden (or even NotFound for single read, but let's check Ash.Error.Forbidden)
    # Wait, the prompt says: "For any other actor whose status is :suspended, every document operation fails with Ash.Error.Forbidden — including list reads and fetches by id"
    assert {:error, %Ash.Error.Forbidden{}} = OrgGuard.Access.get_document(doc.id, actor: user)
    assert {:error, %Ash.Error.Forbidden{}} = OrgGuard.Access.list_documents(actor: user)
    assert {:error, %Ash.Error.Forbidden{}} = OrgGuard.Access.create_document(%{title: "Fail", budget_cents: 10, org_unit_id: root.id}, actor: user)
    assert {:error, %Ash.Error.Forbidden{}} = OrgGuard.Access.update_document(doc, %{title: "Fail"}, actor: user)
    assert {:error, %Ash.Error.Forbidden{}} = OrgGuard.Access.destroy_document(doc, actor: user)
    assert {:error, %Ash.Error.Forbidden{}} = OrgGuard.Access.relocate_document(doc.id, root.id, actor: user)
  end

  test "reads are filtered correctly" do
    {:ok, root1} = OrgGuard.Access.create_org_unit(%{code: unique_code(), name: "Root1"}, authorize?: false)
    {:ok, root2} = OrgGuard.Access.create_org_unit(%{code: unique_code(), name: "Root2"}, authorize?: false)

    {:ok, doc1} = OrgGuard.Access.create_document(%{title: "Doc1", budget_cents: 100, org_unit_id: root1.id}, authorize?: false)
    {:ok, doc2} = OrgGuard.Access.create_document(%{title: "Doc2", budget_cents: 200, org_unit_id: root2.id}, authorize?: false)

    {:ok, user} = OrgGuard.Access.create_user(%{email: unique_email(), status: :active, global_role: :member}, authorize?: false)
    # Grant viewer at Root1
    {:ok, _} = OrgGuard.Access.create_role_assignment(%{user_id: user.id, org_unit_id: root1.id, role: :viewer, effect: :grant}, authorize?: false)

    # list_documents should return doc1, but not doc2
    assert {:ok, docs} = OrgGuard.Access.list_documents(actor: user)
    doc_ids = Enum.map(docs, & &1.id)
    assert doc1.id in doc_ids
    refute doc2.id in doc_ids

    # get_document doc1 succeeds
    assert {:ok, fetched1} = OrgGuard.Access.get_document(doc1.id, actor: user)
    assert fetched1.title == "Doc1"

    # get_document doc2 fails with NotFound
    assert {:error, error} = OrgGuard.Access.get_document(doc2.id, actor: user)
    assert match?(%Ash.Error.Query.NotFound{}, error) or (is_struct(error) and Enum.any?(Map.get(error, :errors, []), &match?(%Ash.Error.Query.NotFound{}, &1)))
  end

  test "updates and budget confidentiality" do
    {:ok, root} = OrgGuard.Access.create_org_unit(%{code: unique_code(), name: "Root"}, authorize?: false)
    {:ok, doc} = OrgGuard.Access.create_document(%{title: "Doc", budget_cents: 100, org_unit_id: root.id}, authorize?: false)

    # 1. User with viewer role only (has read, lacks write, lacks view_budget)
    {:ok, u_viewer} = OrgGuard.Access.create_user(%{email: unique_email(), status: :active, global_role: :member}, authorize?: false)
    {:ok, _} = OrgGuard.Access.create_role_assignment(%{user_id: u_viewer.id, org_unit_id: root.id, role: :viewer, effect: :grant}, authorize?: false)

    # Can read doc, but budget_cents is masked with ForbiddenField
    assert {:ok, fetched_v} = OrgGuard.Access.get_document(doc.id, actor: u_viewer)
    assert fetched_v.title == "Doc"
    assert %Ash.ForbiddenField{field: :budget_cents, type: :attribute} = fetched_v.budget_cents

    # Cannot update
    assert {:error, %Ash.Error.Forbidden{}} = OrgGuard.Access.update_document(doc, %{title: "New Title"}, actor: u_viewer)

    # 2. User with editor role (has read, has write, lacks view_budget)
    {:ok, u_editor} = OrgGuard.Access.create_user(%{email: unique_email(), status: :active, global_role: :member}, authorize?: false)
    {:ok, _} = OrgGuard.Access.create_role_assignment(%{user_id: u_editor.id, org_unit_id: root.id, role: :editor, effect: :grant}, authorize?: false)

    # Can read doc, but budget_cents is masked
    assert {:ok, fetched_e} = OrgGuard.Access.get_document(doc.id, actor: u_editor)
    assert %Ash.ForbiddenField{} = fetched_e.budget_cents

    # Can update title
    assert {:ok, updated_e} = OrgGuard.Access.update_document(doc, %{title: "Editor Title"}, actor: u_editor)
    assert updated_e.title == "Editor Title"

    # Cannot update budget_cents
    assert {:error, %Ash.Error.Forbidden{}} = OrgGuard.Access.update_document(doc, %{budget_cents: 999}, actor: u_editor)

    # 3. User with auditor role (has read, lacks write, has view_budget)
    {:ok, u_auditor} = OrgGuard.Access.create_user(%{email: unique_email(), status: :active, global_role: :member}, authorize?: false)
    {:ok, _} = OrgGuard.Access.create_role_assignment(%{user_id: u_auditor.id, org_unit_id: root.id, role: :auditor, effect: :grant}, authorize?: false)

    # Can read doc, budget_cents is NOT masked
    assert {:ok, fetched_a} = OrgGuard.Access.get_document(doc.id, actor: u_auditor)
    assert fetched_a.budget_cents == 100

    # Cannot update
    assert {:error, %Ash.Error.Forbidden{}} = OrgGuard.Access.update_document(doc, %{title: "Auditor Title"}, actor: u_auditor)
  end

  test "creates and destroys" do
    {:ok, root} = OrgGuard.Access.create_org_unit(%{code: unique_code(), name: "Root"}, authorize?: false)

    {:ok, u_editor} = OrgGuard.Access.create_user(%{email: unique_email(), status: :active, global_role: :member}, authorize?: false)
    {:ok, _} = OrgGuard.Access.create_role_assignment(%{user_id: u_editor.id, org_unit_id: root.id, role: :editor, effect: :grant}, authorize?: false)

    # Editor can create document
    assert {:ok, doc} = OrgGuard.Access.create_document(%{title: "Editor Doc", budget_cents: 100, org_unit_id: root.id}, actor: u_editor)
    assert doc.title == "Editor Doc"

    # Editor cannot destroy document (requires delete capability which editor lacks)
    assert {:error, %Ash.Error.Forbidden{}} = OrgGuard.Access.destroy_document(doc, actor: u_editor)

    # Admin can destroy document
    {:ok, u_admin} = OrgGuard.Access.create_user(%{email: unique_email(), status: :active, global_role: :member}, authorize?: false)
    {:ok, _} = OrgGuard.Access.create_role_assignment(%{user_id: u_admin.id, org_unit_id: root.id, role: :unit_admin, effect: :grant}, authorize?: false)

    assert :ok = OrgGuard.Access.destroy_document(doc, actor: u_admin)
  end

  test "relocate requires relocate capability at both current and target units" do
    {:ok, root1} = OrgGuard.Access.create_org_unit(%{code: unique_code(), name: "Root1"}, authorize?: false)
    {:ok, root2} = OrgGuard.Access.create_org_unit(%{code: unique_code(), name: "Root2"}, authorize?: false)

    {:ok, doc} = OrgGuard.Access.create_document(%{title: "Doc", budget_cents: 100, org_unit_id: root1.id}, authorize?: false)

    # 1. User has no roles -> fails
    {:ok, user1} = OrgGuard.Access.create_user(%{email: unique_email(), status: :active, global_role: :member}, authorize?: false)
    assert {:error, %Ash.Error.Forbidden{}} = OrgGuard.Access.relocate_document(doc.id, root2.id, actor: user1)

    # 2. User has unit_admin role (which has relocate capability) only at root1 -> fails
    {:ok, user2} = OrgGuard.Access.create_user(%{email: unique_email(), status: :active, global_role: :member}, authorize?: false)
    {:ok, _} = OrgGuard.Access.create_role_assignment(%{user_id: user2.id, org_unit_id: root1.id, role: :unit_admin, effect: :grant}, authorize?: false)
    assert {:error, %Ash.Error.Forbidden{}} = OrgGuard.Access.relocate_document(doc.id, root2.id, actor: user2)

    # 3. User has unit_admin role only at root2 -> fails (since they can't relocate from root1)
    {:ok, user3} = OrgGuard.Access.create_user(%{email: unique_email(), status: :active, global_role: :member}, authorize?: false)
    {:ok, _} = OrgGuard.Access.create_role_assignment(%{user_id: user3.id, org_unit_id: root2.id, role: :unit_admin, effect: :grant}, authorize?: false)
    assert {:error, %Ash.Error.Forbidden{}} = OrgGuard.Access.relocate_document(doc.id, root2.id, actor: user3)

    # 4. User has unit_admin role at both root1 and root2 -> succeeds!
    {:ok, user4} = OrgGuard.Access.create_user(%{email: unique_email(), status: :active, global_role: :member}, authorize?: false)
    {:ok, _} = OrgGuard.Access.create_role_assignment(%{user_id: user4.id, org_unit_id: root1.id, role: :unit_admin, effect: :grant}, authorize?: false)
    {:ok, _} = OrgGuard.Access.create_role_assignment(%{user_id: user4.id, org_unit_id: root2.id, role: :unit_admin, effect: :grant}, authorize?: false)
    assert {:ok, relocated} = OrgGuard.Access.relocate_document(doc.id, root2.id, actor: user4)
    assert relocated.org_unit_id == root2.id
  end

  test "can_*? introspection helpers" do
    {:ok, root} = OrgGuard.Access.create_org_unit(%{code: unique_code(), name: "Root"}, authorize?: false)
    {:ok, doc} = OrgGuard.Access.create_document(%{title: "Doc", budget_cents: 100, org_unit_id: root.id}, authorize?: false)

    {:ok, user} = OrgGuard.Access.create_user(%{email: unique_email(), status: :active, global_role: :member}, authorize?: false)
    {:ok, _} = OrgGuard.Access.create_role_assignment(%{user_id: user.id, org_unit_id: root.id, role: :editor, effect: :grant}, authorize?: false)

    # Introspection works correctly
    assert OrgGuard.Access.can_update_document?(user, doc)
    refute OrgGuard.Access.can_destroy_document?(user, doc)
    assert OrgGuard.Access.can_create_document?(user, %{org_unit_id: root.id})
    refute OrgGuard.Access.can_relocate_document?(user, doc.id, root.id)

    # Works with nil actors
    refute OrgGuard.Access.can_update_document?(nil, doc)
    refute OrgGuard.Access.can_destroy_document?(nil, doc)
    refute OrgGuard.Access.can_create_document?(nil, %{org_unit_id: root.id})
  end
end
