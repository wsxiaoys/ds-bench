defmodule OrgGuardTest do
  use ExUnit.Case, async: false

  alias OrgGuard.Access

  setup do
    clear_all_records()
    :ok
  end

  defp clear_all_records do
    for resource <- [Access.User, Access.OrgUnit, Access.RoleAssignment, Access.Document] do
      if :ets.whereis(resource) != :undefined do
        :ets.delete_all_objects(resource)
      end
    end
  end

  test "basic user and org unit creation" do
    user = Access.create_user!(%{email: "test@example.com"}, authorize?: false)
    assert user.email == "test@example.com"
    assert user.status == :active
    assert user.global_role == :member

    org_root = Access.create_org_unit!(%{code: "ROOT", name: "Root Org"}, authorize?: false)
    assert org_root.code == "ROOT"
    assert org_root.parent_id == nil

    org_child =
      Access.create_org_unit!(%{code: "CHILD", name: "Child Org", parent_id: org_root.id},
        authorize?: false
      )

    assert org_child.code == "CHILD"
    assert org_child.parent_id == org_root.id
  end

  test "hierarchical role inheritance and capability resolution" do
    # Root -> Child -> Grandchild
    root = Access.create_org_unit!(%{code: "R", name: "Root"}, authorize?: false)

    child =
      Access.create_org_unit!(%{code: "C", name: "Child", parent_id: root.id}, authorize?: false)

    grandchild =
      Access.create_org_unit!(%{code: "G", name: "Grandchild", parent_id: child.id},
        authorize?: false
      )

    user = Access.create_user!(%{email: "user@example.com"}, authorize?: false)

    # Grant viewer at Root
    Access.create_role_assignment!(
      %{user_id: user.id, org_unit_id: root.id, role: :viewer, effect: :grant},
      authorize?: false
    )

    # Check that user holds :viewer (and thus has :read capability) at all descendants
    assert Access.can_create_document?(user, %{
             title: "Doc",
             budget_cents: 100,
             org_unit_id: grandchild.id
           }) == false

    # Let's create a document at grandchild
    doc =
      Access.create_document!(%{title: "Secret", budget_cents: 100, org_unit_id: grandchild.id},
        authorize?: false
      )

    # Can they read it?
    assert Access.can_update_document?(user, doc) == false
    assert Access.can_destroy_document?(user, doc) == false

    # The list read should return the document
    docs = Access.list_documents!(actor: user)
    assert length(docs) == 1
    assert hd(docs).id == doc.id
    # But budget_cents should be masked since they don't have view_budget capability!
    assert match?(%Ash.ForbiddenField{}, hd(docs).budget_cents)

    # Now let's deny viewer at Child
    Access.create_role_assignment!(
      %{user_id: user.id, org_unit_id: child.id, role: :viewer, effect: :deny},
      authorize?: false
    )

    # Now user should NOT hold viewer at child or grandchild, but still holds it at root!
    docs = Access.list_documents!(actor: user)
    assert docs == []

    # But if we grant viewer again at Grandchild, it should re-establish it!
    Access.create_role_assignment!(
      %{user_id: user.id, org_unit_id: grandchild.id, role: :viewer, effect: :grant},
      authorize?: false
    )

    docs = Access.list_documents!(actor: user)
    assert length(docs) == 1
    assert hd(docs).id == doc.id
  end

  test "break-glass bypasses everything, even suspension" do
    root = Access.create_org_unit!(%{code: "R", name: "Root"}, authorize?: false)

    user =
      Access.create_user!(
        %{email: "bg@example.com", status: :suspended, global_role: :break_glass},
        authorize?: false
      )

    # No role assignments seeded, but break-glass should be able to do everything
    doc =
      Access.create_document!(%{title: "Confidential", budget_cents: 10000, org_unit_id: root.id},
        authorize?: false
      )

    assert Access.can_update_document?(user, doc) == true
    assert Access.can_destroy_document?(user, doc) == true

    # They can read and see budget_cents unmasked
    docs = Access.list_documents!(actor: user)
    assert length(docs) == 1
    assert hd(docs).budget_cents == 10000

    # They can relocate
    target = Access.create_org_unit!(%{code: "T", name: "Target"}, authorize?: false)
    assert Access.can_relocate_document?(user, doc.id, target.id) == true

    updated = Access.relocate_document!(doc.id, target.id, actor: user)
    assert updated.org_unit_id == target.id
  end

  test "suspended user is locked out immediately" do
    root = Access.create_org_unit!(%{code: "R", name: "Root"}, authorize?: false)

    user =
      Access.create_user!(%{email: "suspended@example.com", status: :suspended},
        authorize?: false
      )

    # Even with admin role assignment, a suspended user should be locked out
    Access.create_role_assignment!(
      %{user_id: user.id, org_unit_id: root.id, role: :unit_admin, effect: :grant},
      authorize?: false
    )

    doc =
      Access.create_document!(%{title: "Confidential", budget_cents: 10000, org_unit_id: root.id},
        authorize?: false
      )

    assert Access.can_update_document?(user, doc) == false
    assert Access.can_destroy_document?(user, doc) == false
    assert Access.can_relocate_document?(user, doc.id, root.id) == false

    # Reads should fail or return empty
    assert_raise Ash.Error.Forbidden, fn ->
      Access.list_documents!(actor: user)
    end

    assert_raise Ash.Error.Forbidden, fn ->
      Access.get_document!(doc.id, actor: user)
    end
  end

  test "relocate requires relocate capability at both source and target" do
    u1 = Access.create_org_unit!(%{code: "U1", name: "Unit 1"}, authorize?: false)
    u2 = Access.create_org_unit!(%{code: "U2", name: "Unit 2"}, authorize?: false)

    user = Access.create_user!(%{email: "editor@example.com"}, authorize?: false)

    doc =
      Access.create_document!(%{title: "Doc", budget_cents: 100, org_unit_id: u1.id},
        authorize?: false
      )

    # Case 1: No permissions at all
    assert Access.can_relocate_document?(user, doc.id, u2.id) == false

    # Case 2: relocate capability only at source (Unit 1)
    Access.create_role_assignment!(
      %{user_id: user.id, org_unit_id: u1.id, role: :unit_admin, effect: :grant},
      authorize?: false
    )

    assert Access.can_relocate_document?(user, doc.id, u2.id) == false

    # Case 3: relocate capability only at target (Unit 2)
    clear_all_records()
    u1 = Access.create_org_unit!(%{code: "U1", name: "Unit 1"}, authorize?: false)
    u2 = Access.create_org_unit!(%{code: "U2", name: "Unit 2"}, authorize?: false)
    user = Access.create_user!(%{email: "editor@example.com"}, authorize?: false)

    doc =
      Access.create_document!(%{title: "Doc", budget_cents: 100, org_unit_id: u1.id},
        authorize?: false
      )

    Access.create_role_assignment!(
      %{user_id: user.id, org_unit_id: u2.id, role: :unit_admin, effect: :grant},
      authorize?: false
    )

    assert Access.can_relocate_document?(user, doc.id, u2.id) == false

    # Case 4: relocate capability at both source and target
    Access.create_role_assignment!(
      %{user_id: user.id, org_unit_id: u1.id, role: :unit_admin, effect: :grant},
      authorize?: false
    )

    assert Access.can_relocate_document?(user, doc.id, u2.id) == true

    updated = Access.relocate_document!(doc.id, u2.id, actor: user)
    assert updated.org_unit_id == u2.id
  end

  test "budget confidentiality and field policy" do
    u = Access.create_org_unit!(%{code: "U", name: "Unit"}, authorize?: false)
    user_viewer = Access.create_user!(%{email: "viewer@example.com"}, authorize?: false)
    user_auditor = Access.create_user!(%{email: "auditor@example.com"}, authorize?: false)

    Access.create_role_assignment!(
      %{user_id: user_viewer.id, org_unit_id: u.id, role: :viewer, effect: :grant},
      authorize?: false
    )

    Access.create_role_assignment!(
      %{user_id: user_auditor.id, org_unit_id: u.id, role: :auditor, effect: :grant},
      authorize?: false
    )

    _doc =
      Access.create_document!(%{title: "Doc", budget_cents: 500, org_unit_id: u.id},
        authorize?: false
      )

    # Viewer can read doc but budget is masked
    docs_viewer = Access.list_documents!(actor: user_viewer)
    assert length(docs_viewer) == 1
    assert match?(%Ash.ForbiddenField{}, hd(docs_viewer).budget_cents)

    # Auditor can read doc and budget is unmasked
    docs_auditor = Access.list_documents!(actor: user_auditor)
    assert length(docs_auditor) == 1
    assert hd(docs_auditor).budget_cents == 500
  end
end
