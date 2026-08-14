defmodule Logistics.Freight.ShipmentLeg do
  use Ash.Resource,
    domain: Logistics.Freight,
    data_layer: AshPostgres.DataLayer

  resource do
    description "A leg of a shipment route routing through a warehouse"
  end

  postgres do
    repo Logistics.Repo
    table "shipment_legs"
    identity_index_names unique_leg_sequence: "shipment_legs_unique_leg_sequence_index"

    references do
      reference :shipment, on_delete: :delete, on_update: :update, name: "shipment_legs_shipment_fkey"
      reference :warehouse, on_delete: :restrict, on_update: :update, name: "shipment_legs_warehouse_fkey"
    end

    check_constraints do
      check_constraint :sequence, "shipment_legs_sequence_positive", check: "sequence >= 1", message: "sequence must be at least 1"
    end

    custom_indexes do
      index [:shipment_id], name: "shipment_legs_shipment_id_index"
      index [:warehouse_id], name: "shipment_legs_warehouse_id_index"
    end
  end

  attributes do
    uuid_primary_key :id

    attribute :sequence, :integer, allow_nil?: false, public?: true
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
    # Error should be attached to shipment_id
    identity :unique_leg_sequence, [:shipment_id, :sequence], field_names: [:shipment_id]
  end

  actions do
    defaults [:read, :destroy]

    create :create do
      primary? true
      accept [:sequence, :shipment_id, :warehouse_id]
    end

    update :update do
      primary? true
      accept [:sequence, :shipment_id, :warehouse_id]
    end
  end
end
