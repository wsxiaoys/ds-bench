defmodule Orchestra.Fleet.Placement do
  use Ash.Resource,
    domain: Orchestra.Fleet,
    data_layer: Ash.DataLayer.Ets

  attributes do
    uuid_primary_key :id

    attribute :rollout_id, :uuid, allow_nil?: false
    attribute :node_name, :string, allow_nil?: false
    attribute :slots, :integer, allow_nil?: false
    attribute :status, :atom, allow_nil?: false, default: :reserved, constraints: [one_of: [:reserved, :deploying, :deployed, :released]]
    attribute :attempts, :integer, allow_nil?: false, default: 0
    attribute :compensations, :integer, allow_nil?: false, default: 0
    attribute :undos, :integer, allow_nil?: false, default: 0
  end

  actions do
    defaults [:read]

    create :create do
      accept [:rollout_id, :node_name, :slots, :status, :attempts, :compensations, :undos]
    end

    update :update do
      accept [:status, :attempts, :compensations, :undos]
    end

    update :reverse_placement do
      require_atomic? false
      argument :changeset, :map, allow_nil?: true
      change fn changeset, _ ->
        placement = changeset.data
        node = Orchestra.Fleet.get_node!(placement.node_name)
        new_slots_used = max(0, node.slots_used - placement.slots)
        new_state = if new_slots_used == 0, do: :idle, else: node.state

        {:ok, _node} =
          node
          |> Ash.Changeset.for_update(:update, %{slots_used: new_slots_used, state: new_state})
          |> Ash.update()

        # Record reserve_undo
        Orchestra.Rollout.Trace.record(:reserve_undo, node.name)

        changeset
      end
    end
  end
end
