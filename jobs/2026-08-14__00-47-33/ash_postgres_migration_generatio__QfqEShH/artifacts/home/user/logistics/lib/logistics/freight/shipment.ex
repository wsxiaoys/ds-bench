defmodule Logistics.Freight.Shipment do
  use Ash.Resource,
    otp_app: :logistics,
    domain: Logistics.Freight,
    data_layer: AshPostgres.DataLayer

  postgres do
    table "shipments"
    repo Logistics.Repo

    identity_index_names unique_reference: "shipments_unique_reference_index"

    migration_defaults booked_at: "fragment(\"now()\")"

    custom_indexes do
      index [:carrier_id], name: "shipments_carrier_id_index"
    end

    references do
      reference :carrier, on_delete: :restrict, on_update: :update, name: "shipments_carrier_fkey"
      reference :origin_warehouse, on_delete: :nilify, on_update: :update, name: "shipments_origin_warehouse_fkey"
    end

    check_constraints do
      check_constraint :declared_value_cents,
        check: "declared_value_cents >= 0",
        name: "shipments_declared_value_cents_non_negative",
        message: "declared value must not be negative"
    end
  end

  actions do
    defaults [:read, :destroy]

    create :create do
      primary? true
      accept [:id, :reference, :status, :declared_value_cents, :scheduled_for, :booked_at, :carrier_id, :origin_warehouse_id]
    end

    update :update do
      primary? true
      accept [:reference, :status, :declared_value_cents, :scheduled_for, :booked_at, :carrier_id, :origin_warehouse_id]
    end

    create :intake do
      accept [:reference, :declared_value_cents, :scheduled_for, :carrier_id, :origin_warehouse_id]

      argument :parcels, {:array, :map} do
        allow_nil? false
      end

      change manage_relationship(:parcels, type: :create)
    end
  end

  attributes do
    uuid_primary_key :id, writable?: true, public?: true

    attribute :reference, :string do
      allow_nil? false
      public? true
    end

    attribute :status, :atom do
      constraints [one_of: [:draft, :booked, :in_transit, :delivered, :cancelled]]
      allow_nil? false
      default :draft
      public? true
    end

    attribute :declared_value_cents, :integer do
      allow_nil? false
      default 0
      public? true
    end

    attribute :scheduled_for, :utc_datetime do
      allow_nil? true
      public? true
    end

    attribute :booked_at, :utc_datetime_usec do
      allow_nil? true
      default &DateTime.utc_now/0
      public? true
    end
  end

  identities do
    identity :unique_reference, [:reference] do
      message "has already been taken"
    end
  end

  relationships do
    belongs_to :carrier, Logistics.Freight.Carrier do
      allow_nil? false
      attribute_writable? true
      attribute_public? true
      public? true
    end

    belongs_to :origin_warehouse, Logistics.Freight.Warehouse do
      allow_nil? true
      attribute_writable? true
      attribute_public? true
      public? true
    end

    has_many :parcels, Logistics.Freight.Parcel do
      public? true
    end

    has_many :legs, Logistics.Freight.ShipmentLeg do
      public? true
    end
  end

  aggregates do
    count :parcel_count, :parcels do
      public? true
    end

    sum :total_weight_grams, :parcels, :weight_grams do
      public? true
    end
  end

  calculations do
    calculate :heavy?, :boolean, expr(total_weight_grams > 5000) do
      public? true
    end
  end
end
