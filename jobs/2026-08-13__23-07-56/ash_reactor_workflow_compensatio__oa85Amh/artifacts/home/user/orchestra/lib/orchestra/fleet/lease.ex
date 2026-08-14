defmodule Orchestra.Fleet.Lease do
  use Ash.Resource,
    domain: Orchestra.Fleet,
    data_layer: Ash.DataLayer.Ets

  attributes do
    uuid_primary_key :id

    attribute :rollout_name, :string do
      allow_nil? false
      public? true
    end

    attribute :status, :atom do
      allow_nil? false
      public? true
      default :held
      constraints [one_of: [:held, :released]]
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

    update :release do
      argument :changeset, :term, allow_nil?: true
      change set_attribute(:status, :released)
    end
  end
end
