defmodule Orchestra.Fleet.Node do
  use Ash.Resource,
    domain: Orchestra.Fleet,
    data_layer: Ash.DataLayer.Ets

  attributes do
    uuid_primary_key :id

    attribute :name, :string do
      allow_nil? false
    end

    attribute :region, :atom do
      constraints [one_of: [:us_east, :eu_west, :ap_south]]
      allow_nil? false
    end

    attribute :slots_total, :integer do
      allow_nil? false
    end

    attribute :slots_used, :integer do
      default 0
      allow_nil? false
    end

    attribute :state, :atom do
      constraints [one_of: [:idle, :reserved, :live]]
      default :idle
      allow_nil? false
    end

    attribute :deploy_failures_remaining, :integer do
      default 0
      allow_nil? false
    end
  end

  actions do
    defaults [:read]

    create :register do
      accept [:name, :region, :slots_total, :deploy_failures_remaining]
    end

    update :reserve_slots do
      require_atomic? false
      argument :slots, :integer, allow_nil?: false
      change fn changeset, _context ->
        slots = Ash.Changeset.get_argument(changeset, :slots)
        current_used = Ash.Changeset.get_attribute(changeset, :slots_used) || 0
        changeset
        |> Ash.Changeset.force_change_attribute(:slots_used, current_used + slots)
        |> Ash.Changeset.force_change_attribute(:state, :reserved)
      end
    end

    update :release_slots do
      require_atomic? false
      argument :slots, :integer, allow_nil?: false
      change fn changeset, _context ->
        slots = Ash.Changeset.get_argument(changeset, :slots)
        current_used = Ash.Changeset.get_attribute(changeset, :slots_used) || 0
        new_used = max(0, current_used - slots)
        new_state = if new_used == 0, do: :idle, else: changeset.data.state

        changeset
        |> Ash.Changeset.force_change_attribute(:slots_used, new_used)
        |> Ash.Changeset.force_change_attribute(:state, new_state)
      end
    end

    update :set_live do
      require_atomic? false
      change fn changeset, _context ->
        Ash.Changeset.force_change_attribute(changeset, :state, :live)
      end
    end

    update :decrement_deploy_failures do
      require_atomic? false
      change fn changeset, _context ->
        current = Ash.Changeset.get_attribute(changeset, :deploy_failures_remaining) || 0
        Ash.Changeset.force_change_attribute(changeset, :deploy_failures_remaining, max(0, current - 1))
      end
    end
  end
end
