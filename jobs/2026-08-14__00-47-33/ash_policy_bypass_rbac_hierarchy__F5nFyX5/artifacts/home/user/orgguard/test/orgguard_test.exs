defmodule OrgGuardTest do
  use ExUnit.Case

  alias OrgGuard.Access

  setup do
    # Clear ETS tables before each test to ensure a clean state
    # Ash.DataLayer.Ets has tables named after resources or can be cleared
    # Since they are shared ETS tables, let's look at how they are named:
    # Usually, they are named after the resources, e.g. Elixir.OrgGuard.Access.User etc.
    # Let's delete all records using Ash.read! and Ash.destroy!
    # Wait, we can just fetch and destroy or we can do it with authorize?: false
    # Let's destroy all documents, role assignments, org units, and users.
    # To avoid parent-child constraints (though ETS doesn't enforce foreign keys),
    # let's destroy in order: Document, RoleAssignment, OrgUnit, User.
    destroy_all(Access.Document)
    destroy_all(Access.RoleAssignment)
    destroy_all(Access.OrgUnit)
    destroy_all(Access.User)

    :ok
  end

  defp destroy_all(resource) do
    resource
    |> Ash.read!(authorize?: false)
    |> Enum.each(&Ash.destroy!(&1, authorize?: false))
  end

  test "hierarchical permission resolution and document authorization" do
    # 1. Create Org Units
    # Root -> Sub1 -> Sub2
    # Root -> OtherRoot
    {:ok, root} = Access.create_org_unit(%{code: "ROOT", name: "Root Unit"}, authorize?: false)
    {:ok, sub1} = Access.create_org_unit(%{code: "SUB1", name: "Sub Unit 1", parent_id: root.id}, authorize?: false)
    {:ok, sub2} = Access.create_org_unit(%{code: "SUB2", name: "Sub Unit 2", parent_id: sub1.id}, authorize?: false)
    {:ok, other_root} = Access.create_org_unit(%{code: "OTHER", name: "Other Root Unit"}, authorize?: false)

    # 2. Create Users
    {:ok, bg_suspended} = Access.create_user(%{email: "bg_susp@example.com", status: :suspended, global_role: :break_glass}, authorize?: false)
    {:ok, suspended} = Access.create_user(%{email: "susp@example.com", status: :suspended}, authorize?: false)
    {:ok, viewer} = Access.create_user(%{email: "viewer@example.com"}, authorize?: false)
    {:ok, viewer_denied} = Access.create_user(%{email: "viewer_denied@example.com"}, authorize?: false)
    {:ok, editor} = Access.create_user(%{email: "editor@example.com"}, authorize?: false)
    {:ok, admin} = Access.create_user(%{email: "admin@example.com"}, authorize?: false)
    {:ok, no_role} = Access.create_user(%{email: "norole@example.com"}, authorize?: false)

    # 3. Create Role Assignments
    # `viewer` has viewer role at Root (grant)
    {:ok, _} = Access.create_role_assignment(%{user_id: viewer.id, org_unit_id: root.id, role: :viewer, effect: :grant}, authorize?: false)

    # `viewer_denied` has viewer role at Root (grant) but viewer role at Sub2 (deny)
    {:ok, _} = Access.create_role_assignment(%{user_id: viewer_denied.id, org_unit_id: root.id, role: :viewer, effect: :grant}, authorize?: false)
    {:ok, _} = Access.create_role_assignment(%{user_id: viewer_denied.id, org_unit_id: sub2.id, role: :viewer, effect: :deny}, authorize?: false)

    # `editor` has editor role at Sub1 (grant)
    {:ok, _} = Access.create_role_assignment(%{user_id: editor.id, org_unit_id: sub1.id, role: :editor, effect: :grant}, authorize?: false)

    # `admin` has unit_admin role at Root (grant)
    {:ok, _} = Access.create_role_assignment(%{user_id: admin.id, org_unit_id: root.id, role: :unit_admin, effect: :grant}, authorize?: false)

    # 4. Create Documents
    {:ok, doc_root} = Access.create_document(%{title: "Doc Root", budget_cents: 1000, org_unit_id: root.id}, authorize?: false)
    {:ok, doc_sub1} = Access.create_document(%{title: "Doc Sub1", budget_cents: 2000, org_unit_id: sub1.id}, authorize?: false)
    {:ok, doc_sub2} = Access.create_document(%{title: "Doc Sub2", budget_cents: 3000, org_unit_id: sub2.id}, authorize?: false)
    {:ok, doc_other} = Access.create_document(%{title: "Doc Other", budget_cents: 4000, org_unit_id: other_root.id}, authorize?: false)

    # ==========================================
    # TEST: Break-glass
    # ==========================================
    # Break-glass user can read all documents
    bg_docs = Access.list_documents!(actor: bg_suspended)
    assert length(bg_docs) == 4
    # Break-glass user can see budget_cents values
    assert Enum.map(bg_docs, & &1.budget_cents) |> Enum.sort() == [1000, 2000, 3000, 4000]

    # Break-glass user can create document anywhere
    assert {:ok, _} = Access.create_document(%{title: "BG Doc", budget_cents: 100, org_unit_id: other_root.id}, actor: bg_suspended)

    # Break-glass can update, destroy, and relocate
    assert {:ok, updated_bg_doc} = Access.update_document(doc_root, %{title: "Doc Root BG"}, actor: bg_suspended)
    assert updated_bg_doc.title == "Doc Root BG"

    assert {:ok, relocated_bg_doc} = Access.relocate_document(doc_root.id, other_root.id, actor: bg_suspended)
    assert relocated_bg_doc.org_unit_id == other_root.id

    # Reset doc_root org_unit_id for other tests
    {:ok, _} = Access.update_document(doc_root, %{title: "Doc Root"}, authorize?: false)
    {:ok, doc_root} = Access.relocate_document(doc_root.id, root.id, authorize?: false)

    assert :ok = Access.destroy_document(doc_other, actor: bg_suspended)
    # Re-create doc_other
    {:ok, doc_other} = Access.create_document(%{title: "Doc Other", budget_cents: 4000, org_unit_id: other_root.id}, authorize?: false)

    # ==========================================
    # TEST: Suspension
    # ==========================================
    # Suspended user cannot read, create, update, destroy or relocate
    assert_raise Ash.Error.Forbidden, fn ->
      Access.list_documents!(actor: suspended)
    end

    assert_raise Ash.Error.Forbidden, fn ->
      Access.get_document!(doc_root.id, actor: suspended)
    end

    assert_raise Ash.Error.Forbidden, fn ->
      Access.create_document!(%{title: "Fail", budget_cents: 100, org_unit_id: root.id}, actor: suspended)
    end

    assert_raise Ash.Error.Forbidden, fn ->
      Access.update_document!(doc_root, %{title: "Fail"}, actor: suspended)
    end

    assert_raise Ash.Error.Forbidden, fn ->
      Access.destroy_document!(doc_root, actor: suspended)
    end

    assert_raise Ash.Error.Forbidden, fn ->
      Access.relocate_document!(doc_root.id, sub1.id, actor: suspended)
    end

    # ==========================================
    # TEST: Reads
    # ==========================================
    # NoRoleUser cannot read any documents (returns empty list)
    assert Access.list_documents!(actor: no_role) == []
    # nil actor cannot read any documents (returns empty list)
    assert Access.list_documents!(actor: nil) == []

    # Viewer user holds role :viewer at Root -> inherits to Sub1 and Sub2.
    # Viewer can read doc_root, doc_sub1, doc_sub2, but NOT doc_other.
    viewer_docs = Access.list_documents!(actor: viewer)
    assert length(viewer_docs) == 3
    viewer_titles = Enum.map(viewer_docs, & &1.title) |> Enum.sort()
    assert viewer_titles == ["Doc Root", "Doc Sub1", "Doc Sub2"]

    # Fetching allowed document succeeds
    assert {:ok, _} = Access.get_document(doc_root.id, actor: viewer)
    # Fetching disallowed document fails with NotFound
    assert {:error, %Ash.Error.Invalid{errors: [%Ash.Error.Query.NotFound{}]}} =
             Access.get_document(doc_other.id, actor: viewer)

    # ViewerDenied user holds role :viewer at Root, but `:deny` at Sub2.
    # So they can read doc_root, doc_sub1, but NOT doc_sub2.
    vd_docs = Access.list_documents!(actor: viewer_denied)
    assert length(vd_docs) == 2
    vd_titles = Enum.map(vd_docs, & &1.title) |> Enum.sort()
    assert vd_titles == ["Doc Root", "Doc Sub1"]

    # Fetching doc_sub2 for viewer_denied fails with NotFound
    assert {:error, %Ash.Error.Invalid{errors: [%Ash.Error.Query.NotFound{}]}} =
             Access.get_document(doc_sub2.id, actor: viewer_denied)

    # Editor user holds role :editor at Sub1.
    # So they can read doc_sub1, doc_sub2, but NOT doc_root or doc_other.
    editor_docs = Access.list_documents!(actor: editor)
    assert length(editor_docs) == 2
    editor_titles = Enum.map(editor_docs, & &1.title) |> Enum.sort()
    assert editor_titles == ["Doc Sub1", "Doc Sub2"]

    # ==========================================
    # TEST: Creates
    # ==========================================
    # Creating requires write capability.
    # Viewer has only read capability (viewer role).
    assert_raise Ash.Error.Forbidden, fn ->
      Access.create_document!(%{title: "New Doc", budget_cents: 100, org_unit_id: root.id}, actor: viewer)
    end

    # Editor has write capability at Sub1 (and Sub2 by inheritance).
    assert {:ok, new_doc_sub1} = Access.create_document(%{title: "New Sub1 Doc", budget_cents: 100, org_unit_id: sub1.id}, actor: editor)
    assert new_doc_sub1.title == "New Sub1 Doc"

    assert {:ok, new_doc_sub2} = Access.create_document(%{title: "New Sub2 Doc", budget_cents: 100, org_unit_id: sub2.id}, actor: editor)
    assert new_doc_sub2.title == "New Sub2 Doc"

    # Editor does NOT have write capability at Root.
    assert_raise Ash.Error.Forbidden, fn ->
      Access.create_document!(%{title: "New Root Doc", budget_cents: 100, org_unit_id: root.id}, actor: editor)
    end

    # ==========================================
    # TEST: Updates
    # ==========================================
    # Updating requires write capability.
    # Viewer cannot update doc_sub1.
    assert_raise Ash.Error.Forbidden, fn ->
      Access.update_document!(doc_sub1, %{title: "Viewer Update"}, actor: viewer)
    end

    # Editor can update doc_sub1.
    assert {:ok, updated_sub1} = Access.update_document(doc_sub1, %{title: "Editor Update"}, actor: editor)
    assert updated_sub1.title == "Editor Update"

    # Editor cannot update doc_root.
    assert_raise Ash.Error.Forbidden, fn ->
      Access.update_document!(doc_root, %{title: "Editor Root Update"}, actor: editor)
    end

    # ==========================================
    # TEST: Budget Confidentiality (Field Policies)
    # ==========================================
    # `budget_cents` is readable only by view_budget (auditor, unit_admin, or break_glass).
    # Viewer has `:viewer` role (no view_budget capability).
    # Editor has `:editor` role (no view_budget capability).
    # Admin has `:unit_admin` role (has view_budget capability).

    # Viewer reads doc_root: budget_cents must be `%Ash.ForbiddenField{}`.
    viewer_doc_root = Access.get_document!(doc_root.id, actor: viewer)
    assert %Ash.ForbiddenField{field: :budget_cents, type: :attribute} = viewer_doc_root.budget_cents

    # Editor reads doc_sub1: budget_cents must be `%Ash.ForbiddenField{}`.
    editor_doc_sub1 = Access.get_document!(doc_sub1.id, actor: editor)
    assert %Ash.ForbiddenField{field: :budget_cents, type: :attribute} = editor_doc_sub1.budget_cents

    # Admin reads doc_root: budget_cents must be real integer (1000).
    admin_doc_root = Access.get_document!(doc_root.id, actor: admin)
    assert admin_doc_root.budget_cents == 1000

    # Break-glass reads doc_root: budget_cents must be real integer (1000).
    bg_doc_root = Access.get_document!(doc_root.id, actor: bg_suspended)
    assert bg_doc_root.budget_cents == 1000

    # ==========================================
    # TEST: Updates with Budget Changes
    # ==========================================
    # An update that changes budget_cents additionally requires view_budget capability.
    # Editor has write capability at Sub1, but NOT view_budget.
    # So Editor can update title of doc_sub1, but CANNOT update budget_cents of doc_sub1.
    assert {:ok, _} = Access.update_document(doc_sub1, %{title: "Allowed title update"}, actor: editor)

    assert_raise Ash.Error.Forbidden, fn ->
      Access.update_document!(doc_sub1, %{budget_cents: 9999}, actor: editor)
    end

    # Admin has both write and view_budget at Root (and inherited to Sub1).
    # So Admin can update budget_cents of doc_sub1.
    assert {:ok, updated_by_admin} = Access.update_document(doc_sub1, %{budget_cents: 9999}, actor: admin)
    assert updated_by_admin.budget_cents == 9999

    # ==========================================
    # TEST: Destroys
    # ==========================================
    # Destroying requires delete capability (unit_admin).
    # Editor does NOT have delete capability (editor role).
    assert_raise Ash.Error.Forbidden, fn ->
      Access.destroy_document!(doc_sub1, actor: editor)
    end

    # Admin has delete capability.
    assert :ok = Access.destroy_document(doc_sub1, actor: admin)

    # ==========================================
    # TEST: Relocation
    # ==========================================
    # Relocation requires relocate capability (unit_admin) at BOTH current and target.
    # Admin has unit_admin at Root, Sub1, Sub2.
    # OtherRoot has no role assignments for Admin.
    # So Admin has relocate capability at Sub2 and Sub1, but NOT at OtherRoot.

    # 1. Admin relocates doc_sub2 from Sub2 to Sub1 (succeeds)
    assert {:ok, relocated_doc} = Access.relocate_document(doc_sub2.id, sub1.id, actor: admin)
    assert relocated_doc.org_unit_id == sub1.id

    # 2. Admin tries to relocate doc_sub2 from Sub1 to OtherRoot (fails because no capability at OtherRoot)
    assert_raise Ash.Error.Forbidden, fn ->
      Access.relocate_document!(doc_sub2.id, other_root.id, actor: admin)
    end

    # 3. Admin tries to relocate doc_other (at OtherRoot) to Sub1 (fails because no capability at OtherRoot)
    assert_raise Ash.Error.Forbidden, fn ->
      Access.relocate_document!(doc_other.id, sub1.id, actor: admin)
    end

    # ==========================================
    # TEST: `can_*?` introspection
    # ==========================================
    # can_create_document?
    assert Access.can_create_document?(admin, %{org_unit_id: root.id})
    assert not Access.can_create_document?(viewer, %{org_unit_id: root.id})
    assert not Access.can_create_document?(nil, %{org_unit_id: root.id})

    # can_update_document?
    assert Access.can_update_document?(admin, doc_root)
    assert not Access.can_update_document?(viewer, doc_root)
    assert not Access.can_update_document?(nil, doc_root)

    # can_destroy_document?
    assert Access.can_destroy_document?(admin, doc_root)
    assert not Access.can_destroy_document?(editor, doc_root)
    assert not Access.can_destroy_document?(nil, doc_root)

    # can_relocate_document?
    assert Access.can_relocate_document?(admin, doc_sub2.id, sub1.id)
    assert not Access.can_relocate_document?(admin, doc_sub2.id, other_root.id)
    assert not Access.can_relocate_document?(editor, doc_sub2.id, sub1.id)
    assert not Access.can_relocate_document?(nil, doc_sub2.id, sub1.id)
  end
end
