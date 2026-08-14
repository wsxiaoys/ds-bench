defmodule Orchestra.Fleet.Placement do
  use Ash.Resource,
    domain: Orchestra.Fleet,
    data_layer: Ash.DataLayer.Ets

  attributes do
    uuid_primary_key :id

    attribute :rollout_id, :uuid do
      allow_nil? false
    end

    attribute :node_name, :string do
      allow_nil? false
    end

    attribute :slots, :integer do
      allow_nil? false
    end

    attribute :status, :atom do
      constraints [one_of: [:reserved, :deploying, :deployed, :released]]
      default :reserved
      allow_nil? false
    end

    attribute :attempts, :integer do
      default 0
      allow_nil? false
    end

    attribute :compensations, :integer do
      default 0
      allow_nil? false
    end

    attribute :undos, :integer do
      default 0
      allow_nil? false
    end
  end

  actions do
    defaults [:read]

    create :create do
      primary? true
      accept [:rollout_id, :node_name, :slots, :status, :attempts, :compensations, :undos]
    end

    update :update do
      accept [:status, :attempts, :compensations, :undos]
    end

    update :increment_attempts do
      require_atomic? false
      change fn changeset, _context ->
        current = Ash.Changeset.get_attribute(changeset, :attempts) || 0
        changeset
        |> Ash.Changeset.force_change_attribute(:attempts, current + 1)
        |> Ash.Changeset.force_change_attribute(:status, :deploying)
      end
    end

    update :set_deployed do
      require_atomic? false
      change fn changeset, _context ->
        Ash.Changeset.force_change_attribute(changeset, :status, :deployed)
      end
    end

    update :increment_compensations do
      require_atomic? false
      change fn changeset, _context ->
        current = Ash.Changeset.get_attribute(changeset, :compensations) || 0
        changeset
        |> Ash.Changeset.force_change_attribute(:compensations, current + 1)
        |> Ash.Changeset.force_change_attribute(:status, :reserved)
      end
    end

    update :increment_undos do
      require_atomic? false
      change fn changeset, _context ->
        current = Ash.Changeset.get_attribute(changeset, :undos) || 0
        changeset
        |> Ash.Changeset.force_change_attribute(:undos, current + 1)
        |> Ash.Changeset.force_change_attribute(:status, :released)
      end
    end
  end
end
