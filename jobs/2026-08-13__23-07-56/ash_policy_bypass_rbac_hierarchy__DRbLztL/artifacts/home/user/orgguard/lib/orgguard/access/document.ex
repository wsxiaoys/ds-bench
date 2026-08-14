defmodule OrgGuard.Access.Document do
  use Ash.Resource,
    domain: OrgGuard.Access,
    data_layer: Ash.DataLayer.Ets,
    authorizers: [Ash.Policy.Authorizer]

  ets do
    private? false
  end

  attributes do
    uuid_primary_key :id

    attribute :title, :string do
      allow_nil? false
      public? true
    end

    attribute :budget_cents, :integer do
      allow_nil? false
      default 0
      public? true
    end

    attribute :org_unit_id, :uuid do
      allow_nil? false
      public? true
    end
  end

  relationships do
    belongs_to :org_unit, OrgGuard.Access.OrgUnit do
      define_attribute? false
      source_attribute :org_unit_id
      allow_nil? false
      public? true
    end
  end

  actions do
    read :read do
      primary? true
    end

    create :create do
      primary? true
      accept [:title, :budget_cents, :org_unit_id]
    end

    update :update do
      primary? true
      require_atomic? false
      accept [:title, :budget_cents]
    end

    destroy :destroy do
      primary? true
      require_atomic? false
    end

    action :relocate, :struct do
      constraints instance_of: __MODULE__

      argument :document_id, :uuid, allow_nil?: false
      argument :target_org_unit_id, :uuid, allow_nil?: false

      run fn input, _context ->
        document_id = input.arguments.document_id
        target_org_unit_id = input.arguments.target_org_unit_id

        case Ash.get(__MODULE__, document_id, authorize?: false) do
          {:ok, document} ->
            document
            |> Ash.Changeset.for_update(:update, %{})
            |> Ash.Changeset.force_change_attribute(:org_unit_id, target_org_unit_id)
            |> Ash.update(authorize?: false)

          {:error, reason} ->
            {:error, reason}
        end
      end
    end
  end

  policies do
    # Break-glass bypass
    bypass OrgGuard.Checks.IsBreakGlass do
      authorize_if always()
    end

    # Reads
    policy action_type(:read) do
      forbid_if OrgGuard.Checks.IsSuspended
      authorize_if {OrgGuard.Checks.HasCapability, capability: :read}
    end

    # Creates
    policy action_type(:create) do
      forbid_if OrgGuard.Checks.IsSuspended
      authorize_if OrgGuard.Checks.CanCreate
    end

    # Updates - Case 1: changing budget_cents (requires both write and view_budget)
    policy [action_type(:update), changing_attributes(:budget_cents)] do
      forbid_if OrgGuard.Checks.IsSuspended
      forbid_unless {OrgGuard.Checks.HasCapability, capability: :view_budget}
      forbid_unless {OrgGuard.Checks.HasCapability, capability: :write}
      authorize_if always()
    end

    # Updates - Case 2: not changing budget_cents (requires write)
    policy action_type(:update) do
      forbid_if OrgGuard.Checks.IsSuspended
      forbid_unless {OrgGuard.Checks.HasCapability, capability: :write}
      authorize_if always()
    end

    # Destroys
    policy action_type(:destroy) do
      forbid_if OrgGuard.Checks.IsSuspended
      authorize_if {OrgGuard.Checks.HasCapability, capability: :delete}
    end

    # Relocation
    policy action(:relocate) do
      forbid_if OrgGuard.Checks.IsSuspended
      authorize_if OrgGuard.Checks.CanRelocate
    end
  end

  field_policies do
    field_policy_bypass :*, OrgGuard.Checks.IsBreakGlass do
      authorize_if always()
    end

    field_policy :budget_cents do
      authorize_if {OrgGuard.Checks.HasCapability, capability: :view_budget}
    end

    field_policy :* do
      authorize_if always()
    end
  end
end
