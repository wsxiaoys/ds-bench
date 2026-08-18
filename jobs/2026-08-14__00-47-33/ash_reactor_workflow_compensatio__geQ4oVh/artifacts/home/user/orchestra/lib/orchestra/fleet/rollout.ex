defmodule Orchestra.Fleet.Rollout do
  use Ash.Resource,
    domain: Orchestra.Fleet,
    data_layer: Ash.DataLayer.Ets

  attributes do
    uuid_primary_key :id

    attribute :name, :string, allow_nil?: false
    attribute :strategy, :atom, allow_nil?: false, constraints: [one_of: [:canary, :blast]]
    attribute :status, :atom, allow_nil?: false, default: :pending, constraints: [one_of: [:pending, :running, :succeeded, :rolled_back]]
    attribute :deployed_node_count, :integer, allow_nil?: false, default: 0
  end

  actions do
    defaults [:read]

    create :create do
      accept [:name, :strategy, :status, :deployed_node_count]
    end

    update :update do
      accept [:status, :deployed_node_count]
    end

    update :rollback_rollout do
      require_atomic? false
      argument :changeset, :map, allow_nil?: true
      change fn changeset, _ ->
        changeset
        |> Ash.Changeset.force_change_attribute(:status, :rolled_back)
        |> Ash.Changeset.force_change_attribute(:deployed_node_count, 0)
      end
    end

    update :mark_succeeded do
      require_atomic? false
      argument :deployed_node_count, :integer, allow_nil?: false
      change fn changeset, _ ->
        count = Ash.Changeset.get_argument(changeset, :deployed_node_count)
        changeset
        |> Ash.Changeset.force_change_attribute(:status, :succeeded)
        |> Ash.Changeset.force_change_attribute(:deployed_node_count, count)
      end
    end

    action :plan_rollout, :map do
      argument :targets, {:array, :map}, allow_nil?: false
      run {Orchestra.Fleet.Rollout.PlanRolloutAction, []}
    end
  end
end
