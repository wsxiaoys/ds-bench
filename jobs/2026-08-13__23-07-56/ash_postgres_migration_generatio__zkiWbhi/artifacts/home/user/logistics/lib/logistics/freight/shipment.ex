defmodule Logistics.Freight.Shipment do
  use Ash.Resource,
    domain: Logistics.Freight,
    data_layer: AshPostgres.DataLayer

  resource do
    description "A shipment of logistics parcels"
  end

  postgres do
    repo Logistics.Repo
    table "shipments"
    migration_types booked_at: :naive_datetime_usec
    migration_defaults booked_at: "fragment(\"now()\")"
    identity_index_names unique_reference: "shipments_unique_reference_index"

    references do
      reference :carrier, on_delete: :restrict, on_update: :update, name: "shipments_carrier_fkey"
      reference :origin_warehouse, on_delete: :nilify, on_update: :update, name: "shipments_origin_warehouse_fkey"
    end

    check_constraints do
      check_constraint :declared_value_cents, "shipments_declared_value_cents_non_negative", check: "declared_value_cents >= 0", message: "declared value must not be negative"
    end

    custom_indexes do
      index [:carrier_id], name: "shipments_carrier_id_index"
    end
  end

  attributes do
    uuid_primary_key :id

    attribute :reference, :string, allow_nil?: false, public?: true
    attribute :status, :atom, constraints: [one_of: [:draft, :booked, :in_transit, :delivered, :cancelled]], allow_nil?: false, default: :draft, public?: true
    attribute :declared_value_cents, :integer, allow_nil?: false, default: 0, public?: true
    attribute :scheduled_for, :utc_datetime, allow_nil?: true, public?: true
    attribute :booked_at, :utc_datetime_usec, allow_nil?: true, default: &DateTime.utc_now/0, public?: true
  end

  relationships do
    belongs_to :carrier, Logistics.Freight.Carrier do
      allow_nil? false
      attribute_writable? true
      public? true
    end

    belongs_to :origin_warehouse, Logistics.Freight.Warehouse do
      allow_nil? true
      attribute_writable? true
      public? true
    end

    has_many :parcels, Logistics.Freight.Parcel do
      public? true
    end

    has_many :legs, Logistics.Freight.ShipmentLeg do
      public? true
    end
  end

  identities do
    identity :unique_reference, [:reference]
  end

  aggregates do
    count :parcel_count, :parcels, default: 0, public?: true
    sum :total_weight_grams, :parcels, :weight_grams, default: 0, public?: true
  end

  calculations do
    calculate :heavy?, :boolean, expr(total_weight_grams > 5000), public?: true
  end

  actions do
    defaults [:read, :destroy]

    create :create do
      primary? true
      accept [:reference, :status, :declared_value_cents, :scheduled_for, :booked_at, :carrier_id, :origin_warehouse_id]
    end

    update :update do
      primary? true
      accept [:reference, :status, :declared_value_cents, :scheduled_for, :booked_at, :carrier_id, :origin_warehouse_id]
    end

    create :intake do
      accept [:reference, :declared_value_cents, :scheduled_for, :carrier_id, :origin_warehouse_id]
      argument :parcels, {:array, :map}, allow_nil?: false
      change manage_relationship(:parcels, type: :create)
    end
  end
end
