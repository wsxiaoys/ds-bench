defmodule OrgGuard.Access.RoleAssignment do
  use Ash.Resource,
    domain: OrgGuard.Access,
    data_layer: Ash.DataLayer.Ets

  ets do
    private? false
  end

  attributes do
    uuid_primary_key :id

    attribute :role, :atom do
      allow_nil? false
      constraints [one_of: [:viewer, :editor, :auditor, :unit_admin]]
      public? true
    end

    attribute :effect, :atom do
      allow_nil? false
      default :grant
      constraints [one_of: [:grant, :deny]]
      public? true
    end

    attribute :user_id, :uuid do
      allow_nil? false
      public? true
    end

    attribute :org_unit_id, :uuid do
      allow_nil? false
      public? true
    end
  end

  relationships do
    belongs_to :user, OrgGuard.Access.User do
      define_attribute? false
      source_attribute :user_id
      allow_nil? false
      public? true
    end

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
      accept [:user_id, :org_unit_id, :role, :effect]
    end
  end
end
