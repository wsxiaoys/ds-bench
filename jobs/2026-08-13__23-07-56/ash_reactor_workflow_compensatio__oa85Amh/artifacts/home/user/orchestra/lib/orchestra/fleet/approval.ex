defmodule Orchestra.Fleet.Approval do
  use Ash.Resource,
    domain: Orchestra.Fleet,
    data_layer: Ash.DataLayer.Ets

  attributes do
    uuid_primary_key :id

    attribute :rollout_id, :uuid do
      allow_nil? false
      public? true
    end

    attribute :level, :atom do
      allow_nil? false
      public? true
      constraints [one_of: [:auto, :board]]
    end

    attribute :slots, :integer do
      allow_nil? false
      public? true
    end

    attribute :status, :atom do
      allow_nil? false
      public? true
      default :granted
      constraints [one_of: [:granted, :revoked]]
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

    update :revoke do
      argument :changeset, :term, allow_nil?: true
      change set_attribute(:status, :revoked)
    end
  end
end
