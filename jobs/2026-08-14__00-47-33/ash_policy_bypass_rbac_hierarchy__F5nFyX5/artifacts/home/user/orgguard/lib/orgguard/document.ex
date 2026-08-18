defmodule OrgGuard.Access.Document do
  use Ash.Resource,
    otp_app: :orgguard,
    domain: OrgGuard.Access,
    data_layer: Ash.DataLayer.Ets,
    authorizers: [Ash.Policy.Authorizer]

  attributes do
    uuid_primary_key :id, public?: true

    attribute :title, :string do
      allow_nil? false
      public? true
    end

    attribute :budget_cents, :integer do
      allow_nil? false
      default 0
      public? true
    end
  end

  relationships do
    belongs_to :org_unit, OrgGuard.Access.OrgUnit do
      allow_nil? false
      attribute_writable? true
      attribute_public? true
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
      accept [:title, :budget_cents]
    end

    destroy :destroy do
      primary? true
    end

    action :relocate, :struct do
      constraints instance_of: OrgGuard.Access.Document
      argument :document_id, :uuid, allow_nil?: false
      argument :target_org_unit_id, :uuid, allow_nil?: false

      run fn input, _context ->
        doc_id = input.arguments.document_id
        target_id = input.arguments.target_org_unit_id

        case Ash.get(OrgGuard.Access.Document, doc_id, authorize?: false) do
          {:ok, doc} ->
            doc
            |> Ash.Changeset.for_update(:update, %{}, authorize?: false)
            |> Ash.Changeset.force_change_attribute(:org_unit_id, target_id)
            |> Ash.update(authorize?: false)
          {:error, error} ->
            {:error, error}
        end
      end
    end
  end

  policies do
    # 1. Break-glass bypass
    bypass actor_attribute_equals(:global_role, :break_glass) do
      authorize_if always()
    end

    # 2. Suspension check
    policy actor_attribute_equals(:status, :suspended) do
      forbid_if always()
    end

    # 3. Read policy
    policy action_type(:read) do
      authorize_if OrgGuard.Checks.CanReadOrgUnit
    end

    # 4. Create policy
    policy action_type(:create) do
      authorize_if {OrgGuard.Checks.HasCapability, capability: :write}
    end

    # 5. Update policy
    policy action_type(:update) do
      authorize_if OrgGuard.Checks.CanUpdateDocument
    end

    # 6. Destroy policy
    policy action_type(:destroy) do
      authorize_if {OrgGuard.Checks.HasCapability, capability: :delete}
    end

    # 7. Relocate policy
    policy action(:relocate) do
      authorize_if {OrgGuard.Checks.HasCapability, capability: :relocate}
    end
  end

  field_policies do
    field_policy_bypass :budget_cents, actor_attribute_equals(:global_role, :break_glass) do
      authorize_if always()
    end

    field_policy :budget_cents do
      authorize_if OrgGuard.Checks.CanViewBudget
    end

    field_policy :* do
      authorize_if always()
    end
  end
end
