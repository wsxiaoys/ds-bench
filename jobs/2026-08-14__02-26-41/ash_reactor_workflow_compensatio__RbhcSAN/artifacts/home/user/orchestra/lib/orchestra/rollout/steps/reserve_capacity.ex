defmodule Orchestra.Rollout.Steps.ReserveCapacity do
  use Reactor.Step

  @impl true
  def run(arguments, _context, _options) do
    targets = Map.fetch!(arguments, :targets)
    rollout_id = Map.fetch!(arguments, :rollout_id)

    {reserved, final_status} = Enum.reduce_while(targets, {[], :ok}, fn target, {acc, :ok} ->
      node_name = target[:node_name] || target["node_name"]
      slots = target[:slots] || target["slots"]

      case Orchestra.Fleet.get_node(node_name) do
        {:ok, node} ->
          if node.slots_used + slots > node.slots_total do
            {:halt, {acc, {:error, {:capacity_exceeded, node_name}}}}
          else
            case Ash.update(node, %{slots: slots}, action: :reserve_slots) do
              {:ok, updated_node} ->
                case Ash.create(Orchestra.Fleet.Placement, %{
                  rollout_id: rollout_id,
                  node_name: node_name,
                  slots: slots,
                  status: :reserved
                }) do
                  {:ok, placement} ->
                    {:cont, {[{updated_node, placement} | acc], :ok}}

                  {:error, err} ->
                    Ash.update(node, %{slots: slots}, action: :release_slots)
                    {:halt, {acc, {:error, err}}}
                end

              {:error, err} ->
                {:halt, {acc, {:error, err}}}
            end
          end

        {:error, _} ->
          {:halt, {acc, {:error, {:node_not_found, node_name}}}}
      end
    end)

    case final_status do
      :ok ->
        placements = reserved |> Enum.map(fn {_, placement} -> placement end) |> Enum.reverse()
        {:ok, placements}

      {:error, reason} ->
        Enum.each(reserved, fn {node, placement} ->
          Ash.update!(node, %{slots: placement.slots}, action: :release_slots)
          Ash.update!(placement, %{status: :released}, action: :update)
        end)

        {:error, reason}
    end
  end

  @impl true
  def undo(placements, _arguments, _context, _options) do
    Enum.each(placements, fn placement ->
      case Orchestra.Fleet.get_node(placement.node_name) do
        {:ok, node} ->
          Ash.update!(node, %{slots: placement.slots}, action: :release_slots)

        _ ->
          :ok
      end

      Orchestra.Rollout.Trace.record(:reserve_undo, placement.node_name)
    end)

    :ok
  end
end
