defmodule Orchestra.Fleet.Node do
  use Ash.Resource,
    domain: Orchestra.Fleet,
    data_layer: Ash.DataLayer.Ets

  attributes do
    uuid_primary_key :id

    attribute :name, :string do
      allow_nil? false
      public? true
    end

    attribute :region, :atom do
      allow_nil? false
      public? true
      constraints [one_of: [:us_east, :eu_west, :ap_south]]
    end

    attribute :slots_total, :integer do
      allow_nil? false
      public? true
    end

    attribute :slots_used, :integer do
      allow_nil? false
      public? true
      default 0
    end

    attribute :state, :atom do
      allow_nil? false
      public? true
      default :idle
      constraints [one_of: [:idle, :reserved, :live]]
    end

    attribute :deploy_failures_remaining, :integer do
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

    update :reserve do
      require_atomic? false
      argument :slots, :integer, allow_nil?: false

      change fn changeset, _context ->
        slots = Ash.Changeset.get_argument(changeset, :slots)
        node = changeset.data
        new_used = node.slots_used + slots

        if new_used > node.slots_total do
          Ash.Changeset.add_error(changeset, "Not enough slots available on node #{node.name}")
        else
          changeset
          |> Ash.Changeset.force_change_attribute(:slots_used, new_used)
          |> Ash.Changeset.force_change_attribute(:state, :reserved)
        end
      end
    end

    update :unreserve do
      require_atomic? false
      argument :slots, :integer, allow_nil?: false

      change fn changeset, _context ->
        slots = Ash.Changeset.get_argument(changeset, :slots)
        node = changeset.data
        new_used = max(0, node.slots_used - slots)
        new_state = if new_used == 0, do: :idle, else: node.state

        changeset
        |> Ash.Changeset.force_change_attribute(:slots_used, new_used)
        |> Ash.Changeset.force_change_attribute(:state, new_state)
      end
    end
  end
end
