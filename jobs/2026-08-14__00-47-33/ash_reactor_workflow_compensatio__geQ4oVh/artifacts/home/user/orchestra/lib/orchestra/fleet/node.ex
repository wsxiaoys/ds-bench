defmodule Orchestra.Fleet.Node do
  use Ash.Resource,
    domain: Orchestra.Fleet,
    data_layer: Ash.DataLayer.Ets

  attributes do
    uuid_primary_key :id

    attribute :name, :string, allow_nil?: false
    attribute :region, :atom, allow_nil?: false, constraints: [one_of: [:us_east, :eu_west, :ap_south]]
    attribute :slots_total, :integer, allow_nil?: false
    attribute :slots_used, :integer, allow_nil?: false, default: 0
    attribute :state, :atom, allow_nil?: false, default: :idle, constraints: [one_of: [:idle, :reserved, :live]]
    attribute :deploy_failures_remaining, :integer, allow_nil?: false, default: 0
  end

  actions do
    defaults [:read]

    create :register_node do
      accept [:name, :region, :slots_total, :deploy_failures_remaining]
    end

    update :update do
      accept [:slots_used, :state, :deploy_failures_remaining]
    end

    read :read_by_name do
      argument :name, :string, allow_nil?: false
      filter expr(name == ^arg(:name))
    end

    update :reserve do
      require_atomic? false
      argument :slots, :integer, allow_nil?: false

      change fn changeset, _context ->
        slots = Ash.Changeset.get_argument(changeset, :slots)
        node = changeset.data
        if node.slots_used + slots > node.slots_total do
          Ash.Changeset.add_error(changeset, "not enough slots available")
        else
          new_slots_used = node.slots_used + slots
          changeset
          |> Ash.Changeset.force_change_attribute(:slots_used, new_slots_used)
          |> Ash.Changeset.force_change_attribute(:state, :reserved)
        end
      end
    end
  end
end
