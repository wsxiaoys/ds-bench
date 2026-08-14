defmodule Orchestra.Fleet.Approval do
  use Ash.Resource,
    domain: Orchestra.Fleet,
    data_layer: Ash.DataLayer.Ets

  attributes do
    uuid_primary_key :id

    attribute :rollout_id, :uuid, allow_nil?: false
    attribute :level, :atom, allow_nil?: false, constraints: [one_of: [:auto, :board]]
    attribute :slots, :integer, allow_nil?: false
    attribute :status, :atom, allow_nil?: false, default: :granted, constraints: [one_of: [:granted, :revoked]]
  end

  actions do
    defaults [:read]

    create :create do
      accept [:rollout_id, :level, :slots, :status]
    end

    update :update do
      accept [:status]
    end

    update :revoke_approval do
      require_atomic? false
      argument :changeset, :map, allow_nil?: true
      change fn changeset, _ ->
        Ash.Changeset.force_change_attribute(changeset, :status, :revoked)
      end
    end
  end
end
