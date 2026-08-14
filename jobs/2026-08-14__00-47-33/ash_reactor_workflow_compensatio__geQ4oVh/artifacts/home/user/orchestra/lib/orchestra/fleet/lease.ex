defmodule Orchestra.Fleet.Lease do
  use Ash.Resource,
    domain: Orchestra.Fleet,
    data_layer: Ash.DataLayer.Ets

  attributes do
    uuid_primary_key :id

    attribute :rollout_name, :string, allow_nil?: false
    attribute :status, :atom, allow_nil?: false, default: :held, constraints: [one_of: [:held, :released]]
  end

  actions do
    defaults [:read]

    create :create do
      accept [:rollout_name, :status]
    end

    update :update do
      accept [:status]
    end

    update :release_lease do
      require_atomic? false
      argument :changeset, :map, allow_nil?: true
      change fn changeset, _ ->
        Ash.Changeset.force_change_attribute(changeset, :status, :released)
      end
    end
  end
end
