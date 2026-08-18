defmodule Orchestra.Fleet.Placement do
  use Ash.Resource,
    domain: Orchestra.Fleet,
    data_layer: Ash.DataLayer.Ets

  attributes do
    uuid_primary_key :id

    attribute :rollout_id, :uuid do
      allow_nil? false
      public? true
    end

    attribute :node_name, :string do
      allow_nil? false
      public? true
    end

    attribute :slots, :integer do
      allow_nil? false
      public? true
    end

    attribute :status, :atom do
      allow_nil? false
      public? true
      default :reserved
      constraints [one_of: [:reserved, :deploying, :deployed, :released]]
    end

    attribute :attempts, :integer do
      allow_nil? false
      public? true
      default 0
    end

    attribute :compensations, :integer do
      allow_nil? false
      public? true
      default 0
    end

    attribute :undos, :integer do
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
  end
end
