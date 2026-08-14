defmodule Orchestra.Fleet.Rollout do
  use Ash.Resource,
    domain: Orchestra.Fleet,
    data_layer: Ash.DataLayer.Ets

  attributes do
    uuid_primary_key :id

    attribute :name, :string do
      allow_nil? false
      public? true
    end

    attribute :strategy, :atom do
      allow_nil? false
      public? true
      constraints [one_of: [:canary, :blast]]
    end

    attribute :status, :atom do
      allow_nil? false
      public? true
      default :pending
      constraints [one_of: [:pending, :running, :succeeded, :rolled_back]]
    end

    attribute :deployed_node_count, :integer do
      allow_nil? false
      public? true
      default 0
    end
  end

  actions do
    defaults [:read]

    create :create do
      accept :*
    end

    update :update do
      accept :*
    end

    update :succeed do
      argument :deployed_node_count, :integer, allow_nil?: false
      change set_attribute(:status, :succeeded)
      change set_attribute(:deployed_node_count, arg(:deployed_node_count))
    end

    update :rollback do
      argument :changeset, :term, allow_nil?: true
      change set_attribute(:status, :rolled_back)
      change set_attribute(:deployed_node_count, 0)
    end

    action :plan_rollout, :map do
      argument :targets, {:array, :map}, allow_nil?: false

      run fn input, _context ->
        targets = input.arguments.targets

        if is_nil(targets) or Enum.empty?(targets) do
          invalid_arg = Ash.Error.Action.InvalidArgument.exception(
            field: :targets,
            message: "targets cannot be empty",
            value: targets
          )
          {:error, %Ash.Error.Invalid{errors: [invalid_arg]}}
        else
          # check slots and duplicates
          {has_invalid_slots, has_duplicates, total_slots, node_names} =
            Enum.reduce_while(targets, {false, false, 0, []}, fn target, {_, _, acc_slots, names} ->
              name = target[:node_name] || target["node_name"]
              slots = target[:slots] || target["slots"]

              cond do
                is_nil(slots) or not is_integer(slots) or slots <= 0 ->
                  {:halt, {true, false, acc_slots, names}}

                is_nil(name) or name in names ->
                  {:halt, {false, true, acc_slots, names}}

                true ->
                  {:cont, {false, false, acc_slots + slots, [name | names]}}
              end
            end)

          cond do
            has_invalid_slots ->
              invalid_arg = Ash.Error.Action.InvalidArgument.exception(
                field: :targets,
                message: "slots must be a positive integer",
                value: targets
              )
              {:error, %Ash.Error.Invalid{errors: [invalid_arg]}}

            has_duplicates ->
              invalid_arg = Ash.Error.Action.InvalidArgument.exception(
                field: :targets,
                message: "node names must be unique",
                value: targets
              )
              {:error, %Ash.Error.Invalid{errors: [invalid_arg]}}

            true ->
              sorted_names = Enum.sort(node_names)
              {:ok, %{
                total_slots: total_slots,
                node_names: sorted_names,
                target_count: length(targets)
              }}
          end
        end
      end
    end
  end
end
