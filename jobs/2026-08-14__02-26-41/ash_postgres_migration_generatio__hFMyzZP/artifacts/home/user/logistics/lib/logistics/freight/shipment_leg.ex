defmodule Logistics.Freight.ShipmentLeg do
  use Ash.Resource,
    otp_app: :logistics,
    domain: Logistics.Freight,
    data_layer: AshPostgres.DataLayer

  postgres do
    table "shipment_legs"
    repo Logistics.Repo

    identity_index_names unique_leg_sequence: "shipment_legs_unique_leg_sequence_index"

    references do
      reference :shipment, on_delete: :delete, on_update: :update, name: "shipment_legs_shipment_fkey"
      reference :warehouse, on_delete: :restrict, on_update: :update, name: "shipment_legs_warehouse_fkey"
    end

    custom_indexes do
      index [:shipment_id], name: "shipment_legs_shipment_id_index"
      index [:warehouse_id], name: "shipment_legs_warehouse_id_index"
    end

    check_constraints do
      check_constraint :sequence, "shipment_legs_sequence_positive",
        check: "sequence >= 1",
        message: "sequence must be at least 1"
    end
  end

  attributes do
    uuid_primary_key :id, writable?: true

    attribute :sequence, :integer do
      allow_nil? false
      public? true
    end
  end

  relationships do
    belongs_to :shipment, Logistics.Freight.Shipment do
      allow_nil? false
      attribute_writable? true
      public? true
    end

    belongs_to :warehouse, Logistics.Freight.Warehouse do
      allow_nil? false
      attribute_writable? true
      public? true
    end
  end

  identities do
    identity :unique_leg_sequence, [:shipment_id, :sequence]
  end

  actions do
    defaults [:read, :destroy]

    create :create do
      primary? true
      accept :*
    end

    update :update do
      primary? true
      accept :*
    end
  end
end
