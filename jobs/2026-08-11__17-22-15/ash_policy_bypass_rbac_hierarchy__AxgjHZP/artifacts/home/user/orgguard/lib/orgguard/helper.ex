defmodule OrgGuard.Policy.Helper do
  @moduledoc """
  Helper module for calculating hierarchical RBAC permissions.
  """

  def build_path(unit_id, parent_map) do
    build_path_acc(unit_id, parent_map, MapSet.new())
  end

  defp build_path_acc(nil, _parent_map, _visited), do: []
  defp build_path_acc(unit_id, parent_map, visited) do
    if MapSet.member?(visited, unit_id) do
      []
    else
      visited = MapSet.put(visited, unit_id)
      case Map.fetch(parent_map, unit_id) do
        {:ok, parent_id} -> [unit_id | build_path_acc(parent_id, parent_map, visited)]
        :error -> [unit_id]
      end
    end
  end

  def roles_for_capability(:read), do: [:viewer, :editor, :auditor, :unit_admin]
  def roles_for_capability(:write), do: [:editor, :unit_admin]
  def roles_for_capability(:view_budget), do: [:auditor, :unit_admin]
  def roles_for_capability(:delete), do: [:unit_admin]
  def roles_for_capability(:relocate), do: [:unit_admin]

  def has_role_for_capability?(path, assignments_map, capability) do
    roles = roles_for_capability(capability)
    Enum.any?(roles, fn role ->
      has_role?(path, assignments_map, role)
    end)
  end

  def has_role?(path, assignments_map, role) do
    Enum.reduce_while(path, false, fn unit_id, _acc ->
      case Map.get(assignments_map, {unit_id, role}) do
        nil ->
          {:cont, false}

        assignments ->
          has_deny? = Enum.any?(assignments, fn a -> a.effect == :deny end)
          if has_deny? do
            {:halt, false}
          else
            {:halt, true}
          end
      end
    end)
  end

  # Main helper to check if an actor has a capability at a unit
  def has_capability?(nil, _org_unit_id, _capability), do: false
  def has_capability?(actor, org_unit_id, capability) do
    if actor.global_role == :break_glass do
      true
    else
      org_units = Ash.read!(OrgGuard.Access.OrgUnit, authorize?: false)
      parent_map = Map.new(org_units, fn unit -> {unit.id, unit.parent_id} end)

      role_assignments =
        OrgGuard.Access.list_role_assignments!(authorize?: false)
        |> Enum.filter(fn assignment -> assignment.user_id == actor.id end)

      assignments_map =
        Enum.group_by(role_assignments, fn assignment ->
          {assignment.org_unit_id, assignment.role}
        end)

      path = build_path(org_unit_id, parent_map)
      has_role_for_capability?(path, assignments_map, capability)
    end
  end
end
