defmodule OrgGuard.Policy.CanViewBudget do
  use Ash.Policy.FilterCheck

  @impl true
  def describe(_opts), do: "can view budget"

  @impl true
  def filter(nil, _context, _opts), do: expr(false)

  @impl true
  def filter(actor, _context, _opts) do
    if actor.global_role == :break_glass do
      expr(true)
    else
      # Fetch all org units and resolve which ones the actor has :view_budget capability on
      org_units = Ash.read!(OrgGuard.Access.OrgUnit, authorize?: false)
      parent_map = Map.new(org_units, fn unit -> {unit.id, unit.parent_id} end)

      role_assignments =
        OrgGuard.Access.list_role_assignments!(authorize?: false)
        |> Enum.filter(fn assignment -> assignment.user_id == actor.id end)

      assignments_map =
        Enum.group_by(role_assignments, fn assignment ->
          {assignment.org_unit_id, assignment.role}
        end)

      authorized_org_unit_ids =
        org_units
        |> Enum.filter(fn unit ->
          path = OrgGuard.Policy.Helper.build_path(unit.id, parent_map)
          OrgGuard.Policy.Helper.has_role_for_capability?(path, assignments_map, :view_budget)
        end)
        |> Enum.map(& &1.id)

      expr(org_unit_id in ^authorized_org_unit_ids)
    end
  end
end
