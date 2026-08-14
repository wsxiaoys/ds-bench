defmodule Orchestra.Fleet.Approval do
  use Ash.Resource,
    domain: Orchestra.Fleet,
    data_layer: Ash.DataLayer.Ets

  attributes do
    uuid_primary_key :id

    attribute :rollout_id, :uuid do
      allow_nil? false
    end

    attribute :level, :atom do
      constraints [one_of: [:auto, :board]]
      allow_nil? false
    end

    attribute :slots, :integer do
      allow_nil? false
    end

    attribute :status, :atom do
      constraints [one_of: [:granted, :revoked]]
      default :granted
      allow_nil? false
    end
  end

  actions do
    defaults [:read]

    create :create do
      primary? true
      accept [:rollout_id, :level, :slots, :status]
    end

    update :revoke do
      require_atomic? false
      argument :changeset, :map, allow_nil?: true
      change fn changeset, _context ->
        Ash.Changeset.force_change_attribute(changeset, :status, :revoked)
      end
    end
  end
end
