defmodule OrgGuard.Access.OrgUnit do
  use Ash.Resource,
    otp_app: :orgguard,
    domain: OrgGuard.Access,
    data_layer: Ash.DataLayer.Ets

  attributes do
    uuid_primary_key :id, public?: true

    attribute :code, :string do
      allow_nil? false
      public? true
    end

    attribute :name, :string do
      allow_nil? false
      public? true
    end
  end

  relationships do
    belongs_to :parent, OrgGuard.Access.OrgUnit do
      attribute_writable? true
      attribute_public? true
      public? true
    end

    has_many :children, OrgGuard.Access.OrgUnit do
      destination_attribute :parent_id
      public? true
    end
  end

  actions do
    read :read do
      primary? true
    end

    create :create do
      primary? true
      accept [:code, :name, :parent_id]
    end
  end
end
