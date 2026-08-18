defmodule Logistics.Freight.Warehouse do
  use Ash.Resource,
    otp_app: :logistics,
    domain: Logistics.Freight,
    data_layer: AshPostgres.DataLayer

  postgres do
    table "warehouses"
    repo Logistics.Repo

    identity_index_names unique_active_code: "warehouses_unique_active_code_index"
    identity_wheres_to_sql unique_active_code: "decommissioned = false"

    check_constraints do
      check_constraint :capacity_parcels,
        check: "capacity_parcels >= 0",
        name: "warehouses_capacity_parcels_non_negative",
        message: "capacity must not be negative"
    end

    foreign_key_names [{:legs, "shipment_legs_warehouse_fkey", "warehouse still has shipment legs"}]
  end

  actions do
    defaults [:read, :destroy]

    create :create do
      primary? true
      accept [:id, :code, :name, :region, :capacity_parcels, :decommissioned]
    end

    update :update do
      primary? true
      accept [:code, :name, :region, :capacity_parcels, :decommissioned]
    end
  end

  attributes do
    uuid_primary_key :id, writable?: true, public?: true

    attribute :code, :string do
      allow_nil? false
      public? true
    end

    attribute :name, :string do
      allow_nil? false
      public? true
    end

    attribute :region, :string do
      allow_nil? false
      public? true
    end

    attribute :capacity_parcels, :integer do
      allow_nil? false
      default 0
      public? true
    end

    attribute :decommissioned, :boolean do
      allow_nil? false
      default false
      public? true
    end
  end

  identities do
    identity :unique_active_code, [:code] do
      where expr(decommissioned == false)
      message "has already been taken"
    end
  end

  relationships do
    has_many :legs, Logistics.Freight.ShipmentLeg do
      public? true
    end
  end
end
