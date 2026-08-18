defmodule Orchestra.Fleet.Rollout do
  use Ash.Resource,
    domain: Orchestra.Fleet,
    data_layer: Ash.DataLayer.Ets

  attributes do
    uuid_primary_key :id

    attribute :name, :string do
      allow_nil? false
    end

    attribute :strategy, :atom do
      constraints [one_of: [:canary, :blast]]
      allow_nil? false
    end

    attribute :status, :atom do
      constraints [one_of: [:pending, :running, :succeeded, :rolled_back]]
      default :pending
      allow_nil? false
    end

    attribute :deployed_node_count, :integer do
      default 0
      allow_nil? false
    end
  end

  actions do
    defaults [:read]

    create :create do
      primary? true
      accept [:name, :strategy, :status, :deployed_node_count]
    end

    update :update do
      accept [:status, :deployed_node_count]
    end

    update :rollback do
      require_atomic? false
      argument :changeset, :map, allow_nil?: true
      change fn changeset, _context ->
        changeset
        |> Ash.Changeset.force_change_attribute(:status, :rolled_back)
        |> Ash.Changeset.force_change_attribute(:deployed_node_count, 0)
      end
    end

    action :plan_rollout, :map do
      argument :targets, {:array, :map}, allow_nil?: false

      run fn input, _context ->
        targets = input.arguments.targets
        case validate_targets(targets) do
          {:ok, result} -> {:ok, result}
          {:error, error} -> {:error, error}
        end
      end
    end
  end

  defp validate_targets(targets) do
    cond do
      is_nil(targets) or targets == [] ->
        {:error, invalid_argument_error(:targets, "cannot be empty", targets)}

      not Enum.all?(targets, fn
        %{:slots => s} when is_integer(s) and s > 0 -> true
        %{"slots" => s} when is_integer(s) and s > 0 -> true
        _ -> false
      end) ->
        {:error, invalid_argument_error(:targets, "slots must be a positive integer", targets)}

      true ->
        names = Enum.map(targets, fn
          %{:node_name => n} -> n
          %{"node_name" => n} -> n
          _ -> nil
        end)

        if Enum.any?(names, &is_nil/1) or length(names) != length(Enum.uniq(names)) do
          {:error, invalid_argument_error(:targets, "node names must be unique and non-nil", targets)}
        else
          parsed = Enum.map(targets, fn
            %{:node_name => n, :slots => s} -> {n, s}
            %{"node_name" => n, "slots" => s} -> {n, s}
            m ->
              n = m[:node_name] || m["node_name"]
              s = m[:slots] || m["slots"]
              {n, s}
          end)

          total_slots = Enum.reduce(parsed, 0, fn {_, s}, acc -> acc + s end)
          node_names = parsed |> Enum.map(fn {n, _} -> n end) |> Enum.sort()
          target_count = length(parsed)

          {:ok, %{
            total_slots: total_slots,
            node_names: node_names,
            target_count: target_count
          }}
        end
    end
  end

  defp invalid_argument_error(field, message, value) do
    error = %Ash.Error.Action.InvalidArgument{
      field: field,
      message: message,
      value: value
    }
    Ash.Error.to_error_class(error)
  end
end
