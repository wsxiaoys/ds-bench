defmodule OrgGuard.Access.RBAC do
  @moduledoc """
  In-memory RBAC hierarchy and capability resolver.
  """
  require Ash.Query

  @role_capabilities %{
    viewer: [:read],
    editor: [:read, :write],
    auditor: [:read, :view_budget],
    unit_admin: [:read, :write, :delete, :relocate, :view_budget]
  }

  def get_authorized_org_unit_ids(nil, _required_capability), do: []

  def get_authorized_org_unit_ids(actor, required_capability) do
    # Break glass can do anything, so they have access to all org units
    if actor.global_role == :break_glass do
      OrgGuard.Access.OrgUnit
      |> Ash.read!(authorize?: false)
      |> Enum.map(& &1.id)
    else
      org_units = Ash.read!(OrgGuard.Access.OrgUnit, authorize?: false)
      parent_map = Map.new(org_units, fn unit -> {unit.id, unit.parent_id} end)

      role_assignments =
        OrgGuard.Access.RoleAssignment
        |> Ash.Query.filter(user_id == ^actor.id)
        |> Ash.read!(authorize?: false)

      assignments_map = Enum.group_by(role_assignments, fn ass -> {ass.org_unit_id, ass.role} end)

      org_units
      |> Enum.filter(fn unit ->
        path = get_path(unit.id, parent_map)

        roles_held =
          [:viewer, :editor, :auditor, :unit_admin]
          |> Enum.filter(fn role -> holds_role?(path, role, assignments_map) end)

        capabilities =
          roles_held
          |> Enum.flat_map(fn role -> Map.get(@role_capabilities, role, []) end)

        required_capability in capabilities
      end)
      |> Enum.map(& &1.id)
    end
  end

  def get_path(unit_id, parent_map) do
    Stream.iterate(unit_id, fn id -> Map.get(parent_map, id) end)
    |> Stream.take_while(& &1)
    |> Enum.to_list()
  end

  def holds_role?(path, role, assignments_map) do
    stopping_unit_assignments =
      Enum.find_value(path, fn unit_id ->
        case Map.get(assignments_map, {unit_id, role}) do
          nil -> nil
          [] -> nil
          assignments -> assignments
        end
      end)

    case stopping_unit_assignments do
      nil ->
        false

      assignments ->
        has_deny? = Enum.any?(assignments, &(&1.effect == :deny))
        not has_deny?
    end
  end
end
