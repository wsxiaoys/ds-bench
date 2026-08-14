defmodule Logistics.Freight.Warehouse do
  use Ash.Resource,
    domain: Logistics.Freight,
    data_layer: AshPostgres.DataLayer

  resource do
    description "A warehouse where shipments are routed through"
  end

  postgres do
    repo Logistics.Repo
    table "warehouses"
    identity_index_names unique_active_code: "warehouses_unique_active_code_index"
    identity_wheres_to_sql unique_active_code: "decommissioned = false"

    check_constraints do
      check_constraint :capacity_parcels, "warehouses_capacity_parcels_non_negative", check: "capacity_parcels >= 0", message: "capacity must not be negative"
    end
  end

  attributes do
    uuid_primary_key :id

    attribute :code, :string, allow_nil?: false, public?: true
    attribute :name, :string, allow_nil?: false, public?: true
    attribute :region, :string, allow_nil?: false, public?: true
    attribute :capacity_parcels, :integer, allow_nil?: false, default: 0, public?: true
    attribute :decommissioned, :boolean, allow_nil?: false, default: false, public?: true
  end

  relationships do
    has_many :legs, Logistics.Freight.ShipmentLeg do
      public? true
    end
  end

  identities do
    identity :unique_active_code, [:code], where: expr(decommissioned == false)
  end

  actions do
    defaults [:read]

    create :create do
      primary? true
      accept [:code, :name, :region, :capacity_parcels, :decommissioned]
    end

    update :update do
      primary? true
      accept [:code, :name, :region, :capacity_parcels, :decommissioned]
    end

    destroy :destroy do
      primary? true
      require_atomic? false
      validate {Logistics.Validations.NoRelated, relationship: :legs, message: "warehouse still has shipment legs"}
    end
  end
end
