defmodule OrgGuard.Access.Resolver do
  @moduledoc """
  Helper module to resolve hierarchical permissions.
  """

  require Ash.Query

  @doc """
  Traverses up from the given org unit to the root.
  """
  def get_path_to_root(nil), do: []
  def get_path_to_root(org_unit_id) do
    case Ash.get(OrgGuard.Access.OrgUnit, org_unit_id, authorize?: false) do
      {:ok, %{parent_id: parent_id}} ->
        [org_unit_id | get_path_to_root(parent_id)]
      _ ->
        [org_unit_id]
    end
  end

  @doc """
  Checks if the actor has the specified capability at the given org unit.
  """
  def has_capability?(nil, _org_unit_id, _capability), do: false

  def has_capability?(%OrgGuard.Access.User{global_role: :break_glass}, _org_unit_id, _capability) do
    true
  end

  def has_capability?(%OrgGuard.Access.User{status: :suspended}, _org_unit_id, _capability) do
    false
  end

  def has_capability?(user, org_unit_id, capability) do
    path = get_path_to_root(org_unit_id)

    # Fetch all role assignments for this user at any of these org units
    assignments =
      OrgGuard.Access.RoleAssignment
      |> Ash.Query.filter(user_id == ^user.id and org_unit_id in ^path)
      |> Ash.read!(authorize?: false)

    roles_for_capability = roles_for_capability(capability)

    Enum.any?(roles_for_capability, fn role ->
      role_held?(path, assignments, role)
    end)
  end

  defp role_held?(path, assignments, role) do
    stopping_unit_id =
      Enum.find(path, fn unit_id ->
        Enum.any?(assignments, fn ass ->
          ass.org_unit_id == unit_id and ass.role == role
        end)
      end)

    case stopping_unit_id do
      nil ->
        false
      unit_id ->
        has_deny? =
          Enum.any?(assignments, fn ass ->
            ass.org_unit_id == unit_id and ass.role == role and ass.effect == :deny
          end)
        not has_deny?
    end
  end

  defp roles_for_capability(:read), do: [:viewer, :editor, :auditor, :unit_admin]
  defp roles_for_capability(:write), do: [:editor, :unit_admin]
  defp roles_for_capability(:view_budget), do: [:auditor, :unit_admin]
  defp roles_for_capability(:delete), do: [:unit_admin]
  defp roles_for_capability(:relocate), do: [:unit_admin]
end
