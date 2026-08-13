defmodule OrgGuard.Access.Document do
  use Ash.Resource,
    otp_app: :orgguard,
    domain: OrgGuard.Access,
    authorizers: [Ash.Policy.Authorizer],
    data_layer: Ash.DataLayer.Ets

  ets do
    private? false
  end

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
      source_attribute :org_unit_id
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
        document_id = input.arguments.document_id
        target_org_unit_id = input.arguments.target_org_unit_id

        # Move the identified document to the target org unit
        case OrgGuard.Access.get_document(document_id, authorize?: false) do
          {:ok, document} ->
            changeset =
              document
              |> Ash.Changeset.for_update(:update, %{}, authorize?: false)
              |> Ash.Changeset.force_change_attribute(:org_unit_id, target_org_unit_id)

            case Ash.update(changeset, authorize?: false) do
              {:ok, updated_document} -> {:ok, updated_document}
              {:error, error} -> {:error, error}
            end

          {:error, error} ->
            {:error, error}
        end
      end
    end
  end

  policies do
    # Break-glass bypass
    bypass actor_attribute_equals(:global_role, :break_glass) do
      authorize_if always()
    end

    # Suspended accounts lock-out
    policy actor_attribute_equals(:status, :suspended) do
      forbid_if always()
    end

    # Reads
    policy action_type(:read) do
      authorize_if OrgGuard.Policy.CanReadDocument
    end

    # Creates
    policy action_type(:create) do
      forbid_unless {OrgGuard.Policy.HasCapability, capability: :write}
      authorize_if always()
    end

    # Updates
    policy action_type(:update) do
      forbid_unless {OrgGuard.Policy.HasCapability, capability: :write}
      forbid_if {OrgGuard.Policy.ChangingBudgetWithoutViewBudget, []}
      authorize_if always()
    end

    # Destroys
    policy action_type(:destroy) do
      forbid_unless {OrgGuard.Policy.HasCapability, capability: :delete}
      authorize_if always()
    end

    # Relocate generic action
    policy action(:relocate) do
      forbid_unless OrgGuard.Policy.CanRelocate
      authorize_if always()
    end
  end

  field_policies do
    # Break-glass can see everything
    field_policy_bypass :budget_cents, actor_attribute_equals(:global_role, :break_glass) do
      authorize_if always()
    end

    # Budget confidentiality
    field_policy :budget_cents do
      authorize_if OrgGuard.Policy.CanViewBudget
    end

    # All other attributes are visible to anyone who can read the document
    field_policy :* do
      authorize_if always()
    end
  end
end
