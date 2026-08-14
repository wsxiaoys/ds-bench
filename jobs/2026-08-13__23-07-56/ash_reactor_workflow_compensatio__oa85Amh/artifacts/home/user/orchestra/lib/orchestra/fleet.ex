defmodule Orchestra.Fleet do
  use Ash.Domain
  require Ash.Query

  resources do
    resource Orchestra.Fleet.Node
    resource Orchestra.Fleet.Rollout
    resource Orchestra.Fleet.Placement
    resource Orchestra.Fleet.Approval
    resource Orchestra.Fleet.Lease
  end

  # Code Interface Functions

  def register_node(name, region, slots_total, params \\ %{}) do
    attrs = Map.merge(params, %{name: name, region: region, slots_total: slots_total})
    Orchestra.Fleet.Node
    |> Ash.Changeset.for_create(:create, attrs)
    |> Ash.create()
  end

  def register_node!(name, region, slots_total, params \\ %{}) do
    case register_node(name, region, slots_total, params) do
      {:ok, node} -> node
      {:error, error} -> raise error
    end
  end

  def get_node(name) do
    query = Orchestra.Fleet.Node |> Ash.Query.filter(name == ^name)
    case Ash.read(query) do
      {:ok, [node]} -> {:ok, node}
      {:ok, []} -> {:ok, nil}
      {:ok, _multiple} -> {:error, "Multiple nodes with name #{name}"}
      {:error, error} -> {:error, error}
    end
  end

  def get_node!(name) do
    case get_node(name) do
      {:ok, nil} -> nil
      {:ok, node} -> node
      {:error, error} -> raise error
    end
  end

  def list_nodes do
    Ash.read(Orchestra.Fleet.Node)
  end

  def list_nodes! do
    Ash.read!(Orchestra.Fleet.Node)
  end

  def list_rollouts do
    Ash.read(Orchestra.Fleet.Rollout)
  end

  def list_rollouts! do
    Ash.read!(Orchestra.Fleet.Rollout)
  end

  def list_placements do
    Ash.read(Orchestra.Fleet.Placement)
  end

  def list_placements! do
    Ash.read!(Orchestra.Fleet.Placement)
  end

  def list_approvals do
    Ash.read(Orchestra.Fleet.Approval)
  end

  def list_approvals! do
    Ash.read!(Orchestra.Fleet.Approval)
  end

  def list_leases do
    Ash.read(Orchestra.Fleet.Lease)
  end

  def list_leases! do
    Ash.read!(Orchestra.Fleet.Lease)
  end

  def plan_rollout(targets) do
    input = Ash.ActionInput.for_action(Orchestra.Fleet.Rollout, :plan_rollout, %{targets: targets})
    Ash.run_action(input)
  end

  def plan_rollout!(targets) do
    case plan_rollout(targets) do
      {:ok, result} -> result
      {:error, error} -> raise error
    end
  end
end
