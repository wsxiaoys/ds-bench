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
      writable? true
    end
  end

  relationships do
    belongs_to :org_unit, OrgGuard.Access.OrgUnit do
      define_attribute? false
      source_attribute :org_unit_id
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

        case OrgGuard.Access.get_document(document_id, authorize?: false) do
          {:ok, document} ->
            updated_document =
              document
              |> Ash.Changeset.for_update(:update, %{}, authorize?: false)
              |> Ash.Changeset.force_change_attribute(:org_unit_id, target_org_unit_id)
              |> Ash.update!(authorize?: false)

            {:ok, updated_document}

          error ->
            error
        end
      end
    end
  end

  policies do
    # Break-glass bypass policy
    bypass actor_attribute_equals(:global_role, :break_glass) do
      authorize_if always()
    end

    # Suspended actor policy
    policy OrgGuard.Access.Checks.SuspendedActor do
      forbid_if always()
    end

    # Reads policy
    policy action_type(:read) do
      authorize_if {OrgGuard.Access.Checks.HasCapability, capability: :read}
    end

    # Creates policy
    policy action_type(:create) do
      access_type :strict
      authorize_if {OrgGuard.Access.Checks.HasCapability, capability: :write}
    end

    # Updates policy
    policy action_type(:update) do
      authorize_if {OrgGuard.Access.Checks.HasCapability, capability: :write}
    end

    policy [action_type(:update), changing_attributes([:budget_cents])] do
      authorize_if {OrgGuard.Access.Checks.HasCapability, capability: :view_budget}
    end

    # Destroys policy
    policy action_type(:destroy) do
      authorize_if {OrgGuard.Access.Checks.HasCapability, capability: :delete}
    end

    # Relocation policy
    policy action(:relocate) do
      authorize_if OrgGuard.Access.Checks.CanRelocate
    end
  end

  field_policies do
    field_policy_bypass :budget_cents, actor_attribute_equals(:global_role, :break_glass) do
      authorize_if always()
    end

    field_policy :budget_cents do
      authorize_if {OrgGuard.Access.Checks.HasCapability, capability: :view_budget}
    end

    field_policy :* do
      authorize_if always()
    end
  end
end
