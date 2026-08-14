defmodule OrgGuard.Access.Resolver do
  require Ash.Query
  alias OrgGuard.Access.{OrgUnit, RoleAssignment}

  @role_capabilities %{
    viewer: [:read],
    editor: [:read, :write],
    auditor: [:read, :view_budget],
    unit_admin: [:read, :write, :delete, :relocate, :view_budget]
  }

  def allowed_org_units(actor, capability) do
    if is_nil(actor) do
      []
    else
      # Fetch all units
      case Ash.read(OrgUnit, authorize?: false) do
        {:ok, units} ->
          # Fetch role assignments for actor
          case Ash.read(Ash.Query.filter(RoleAssignment, user_id == ^actor.id), authorize?: false) do
            {:ok, assignments} ->
              # Build units map: id => parent_id
              units_map = Map.new(units, fn u -> {u.id, u.parent_id} end)
              
              # Group assignments by {unit_id, role} => list of effects
              assignments_map =
                assignments
                |> Enum.group_by(
                  fn ra -> {ra.org_unit_id, ra.role} end,
                  fn ra -> ra.effect end
                )

              # For each unit, check if actor has the required capability
              units
              |> Enum.filter(fn unit ->
                has_capability?(unit.id, capability, units_map, assignments_map)
              end)
              |> Enum.map(fn u -> u.id end)

            _ ->
              []
          end
        _ ->
          []
      end
    end
  end

  def has_capability?(unit_id, capability, units_map, assignments_map) do
    # An actor holds a capability if any of the roles they hold at unit_id confers it
    roles_held =
      [:viewer, :editor, :auditor, :unit_admin]
      |> Enum.filter(fn role ->
        role_held?(unit_id, role, units_map, assignments_map)
      end)

    capabilities =
      roles_held
      |> Enum.flat_map(&Map.fetch!(@role_capabilities, &1))
      |> MapSet.new()

    capability in capabilities
  end

  def role_held?(unit_id, role, units_map, assignments_map) do
    # Build path from unit_id up to root
    path = build_path(unit_id, units_map)

    # Walk the path and find the first unit with any assignments for this role
    case Enum.find(path, &Map.has_key?(assignments_map, {&1, role})) do
      nil ->
        false

      stopping_unit ->
        effects = Map.fetch!(assignments_map, {stopping_unit, role})
        # If any assignment has effect :deny, the actor does not hold the role
        if :deny in effects do
          false
        else
          true
        end
    end
  end

  def build_path(nil, _units_map), do: []
  def build_path(unit_id, units_map) do
    case Map.fetch(units_map, unit_id) do
      {:ok, parent_id} ->
        [unit_id | build_path(parent_id, units_map)]
      :error ->
        [unit_id]
    end
  end
end
