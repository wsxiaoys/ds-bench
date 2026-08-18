defmodule Logistics.Freight.Carrier do
  use Ash.Resource,
    domain: Logistics.Freight,
    data_layer: AshPostgres.DataLayer

  resource do
    description "A carrier that operates logistics shipments"
    base_filter [is_nil: :retired_at]
  end

  postgres do
    repo Logistics.Repo
    table "carriers"
    migration_types retired_at: :naive_datetime_usec
    base_filter_sql "retired_at IS NULL"
    identity_index_names unique_code: "carriers_unique_code_index"
  end

  attributes do
    uuid_primary_key :id

    attribute :code, :ci_string, allow_nil?: false, public?: true
    attribute :name, :string, allow_nil?: false, public?: true
    attribute :retired_at, :utc_datetime_usec, allow_nil?: true, public?: true
  end

  relationships do
    has_many :shipments, Logistics.Freight.Shipment do
      public? true
    end
  end

  identities do
    identity :unique_code, [:code]
  end

  actions do
    defaults [:read]

    create :create do
      primary? true
      accept [:code, :name, :retired_at]
    end

    update :update do
      primary? true
      accept [:code, :name, :retired_at]
    end

    destroy :destroy do
      primary? true
      require_atomic? false
      validate {Logistics.Validations.NoRelated, relationship: :shipments, message: "carrier still has shipments"}
    end
  end
end
