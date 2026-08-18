defmodule Orchestra.Fleet.Lease do
  use Ash.Resource,
    domain: Orchestra.Fleet,
    data_layer: Ash.DataLayer.Ets

  attributes do
    uuid_primary_key :id

    attribute :rollout_name, :string do
      allow_nil? false
    end

    attribute :status, :atom do
      constraints [one_of: [:held, :released]]
      default :held
      allow_nil? false
    end
  end

  actions do
    defaults [:read]

    create :create do
      primary? true
      accept [:rollout_name, :status]
    end

    update :release do
      require_atomic? false
      argument :changeset, :map, allow_nil?: true
      change fn changeset, _context ->
        Ash.Changeset.force_change_attribute(changeset, :status, :released)
      end
    end
  end
end
