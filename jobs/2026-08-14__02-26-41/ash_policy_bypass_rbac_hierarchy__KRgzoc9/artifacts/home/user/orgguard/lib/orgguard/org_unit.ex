defmodule OrgGuard.Access.OrgUnit do
  use Ash.Resource,
    domain: OrgGuard.Access,
    data_layer: Ash.DataLayer.Ets

  ets do
    private? false
  end

  attributes do
    uuid_primary_key :id

    attribute :code, :string do
      allow_nil? false
      public? true
    end

    attribute :name, :string do
      allow_nil? false
      public? true
    end

    attribute :parent_id, :uuid do
      allow_nil? true
      public? true
      writable? true
    end
  end

  relationships do
    belongs_to :parent, OrgGuard.Access.OrgUnit do
      define_attribute? false
      source_attribute :parent_id
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
