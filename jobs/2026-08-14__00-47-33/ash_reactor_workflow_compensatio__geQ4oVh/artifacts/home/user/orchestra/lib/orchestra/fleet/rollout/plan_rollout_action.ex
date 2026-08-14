defmodule Orchestra.Fleet.Rollout.PlanRolloutAction do
  use Ash.Resource.Actions.Implementation

  def run(input, _opts, _context) do
    targets = Ash.ActionInput.get_argument(input, :targets)

    case validate_targets(targets) do
      :ok ->
        total_slots = Enum.reduce(targets, 0, fn target, acc ->
          slots = target[:slots] || Map.get(target, "slots")
          acc + slots
        end)

        node_names =
          targets
          |> Enum.map(fn target -> target[:node_name] || Map.get(target, "node_name") end)
          |> Enum.sort()

        target_count = length(targets)

        {:ok, %{
          total_slots: total_slots,
          node_names: node_names,
          target_count: target_count
        }}

      {:error, message} ->
        invalid_arg = %Ash.Error.Action.InvalidArgument{
          field: :targets,
          message: message,
          value: targets
        }
        {:error, Ash.Error.to_error_class(invalid_arg)}
    end
  end

  defp validate_targets(targets) when is_list(targets) do
    cond do
      Enum.empty?(targets) ->
        {:error, "cannot be empty"}

      Enum.any?(targets, fn target ->
        slots = target[:slots] || Map.get(target, "slots")
        not is_integer(slots) or slots <= 0
      end) ->
        {:error, "must have positive integer slots"}

      has_duplicate_node_names?(targets) ->
        {:error, "node names must be unique"}

      true ->
        :ok
    end
  end

  defp validate_targets(_), do: {:error, "must be a list of targets"}

  defp has_duplicate_node_names?(targets) do
    names = Enum.map(targets, fn target -> target[:node_name] || Map.get(target, "node_name") end)
    length(names) != length(Enum.uniq(names))
  end
end
