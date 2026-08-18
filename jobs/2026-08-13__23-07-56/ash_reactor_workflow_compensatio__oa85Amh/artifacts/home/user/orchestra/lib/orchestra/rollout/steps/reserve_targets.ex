defmodule Orchestra.Rollout.Steps.ReserveTargets do
  use Reactor.Step

  def run(arguments, _context, _options) do
    rollout_id = arguments.rollout_id
    targets = arguments.targets

    res =
      Enum.reduce_while(targets, {[], nil}, fn target, {acc_placements, _} ->
        node_name = target.node_name || target["node_name"]
        slots = target.slots || target["slots"]

        case Orchestra.Fleet.get_node(node_name) do
          {:ok, nil} ->
            {:halt, {acc_placements, {:error, "Node #{node_name} not found"}}}

          {:ok, node} ->
            reserve_changeset = Ash.Changeset.for_update(node, :reserve, %{slots: slots})
            case Ash.update(reserve_changeset) do
              {:ok, _updated_node} ->
                changeset = Ash.Changeset.for_create(Orchestra.Fleet.Placement, :create, %{
                  rollout_id: rollout_id,
                  node_name: node_name,
                  slots: slots,
                  status: :reserved
                })
                case Ash.create(changeset) do
                  {:ok, placement} ->
                    {:cont, {[placement | acc_placements], nil}}

                  {:error, error} ->
                    unreserve_changeset = Ash.Changeset.for_update(node, :unreserve, %{slots: slots})
                    Ash.update!(unreserve_changeset)
                    {:halt, {acc_placements, {:error, error}}}
                end

              {:error, error} ->
                {:halt, {acc_placements, {:error, error}}}
            end

          {:error, error} ->
            {:halt, {acc_placements, {:error, error}}}
        end
      end)

    case res do
      {placements, nil} ->
        {:ok, Enum.reverse(placements)}

      {placements, {:error, reason}} ->
        Enum.each(placements, fn placement ->
          node = Orchestra.Fleet.get_node!(placement.node_name)
          unreserve_changeset = Ash.Changeset.for_update(node, :unreserve, %{slots: placement.slots})
          Ash.update!(unreserve_changeset)
          Orchestra.Rollout.Trace.record(:reserve_undo, placement.node_name)
        end)

        {:error, reason}
    end
  end

  def undo(_value, arguments, _context, _options) do
    rollout_id = arguments.rollout_id

    placements =
      Orchestra.Fleet.list_placements!()
      |> Enum.filter(&(&1.rollout_id == rollout_id))

    Enum.each(placements, fn placement ->
      node = Orchestra.Fleet.get_node!(placement.node_name)
      unreserve_changeset = Ash.Changeset.for_update(node, :unreserve, %{slots: placement.slots})
      Ash.update!(unreserve_changeset)
      Orchestra.Rollout.Trace.record(:reserve_undo, placement.node_name)
    end)

    :ok
  end
end
