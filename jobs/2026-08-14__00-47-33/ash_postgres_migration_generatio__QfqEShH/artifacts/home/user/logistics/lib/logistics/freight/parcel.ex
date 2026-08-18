defmodule Logistics.Freight.Parcel do
  use Ash.Resource,
    otp_app: :logistics,
    domain: Logistics.Freight,
    data_layer: AshPostgres.DataLayer

  postgres do
    table "parcels"
    repo Logistics.Repo

    identity_index_names unique_tracking_code: "parcels_unique_tracking_code_index",
                         single_fragile_per_shipment: "parcels_single_fragile_per_shipment_index"

    identity_wheres_to_sql single_fragile_per_shipment: "fragile = true"

    custom_indexes do
      index [:shipment_id], name: "parcels_shipment_id_index"
    end

    references do
      reference :shipment, on_delete: :delete, on_update: :update, name: "parcels_shipment_fkey"
    end

    check_constraints do
      check_constraint :weight_grams,
        check: "weight_grams > 0",
        name: "parcels_weight_grams_positive",
        message: "weight must be positive"
    end
  end

  actions do
    defaults [:read, :destroy]

    create :create do
      primary? true
      accept [:id, :tracking_code, :weight_grams, :fragile, :shipment_id]
    end

    update :update do
      primary? true
      accept [:tracking_code, :weight_grams, :fragile, :shipment_id]
    end
  end

  attributes do
    uuid_primary_key :id, writable?: true, public?: true

    attribute :tracking_code, :string do
      allow_nil? false
      public? true
    end

    attribute :weight_grams, :integer do
      allow_nil? false
      public? true
    end

    attribute :fragile, :boolean do
      allow_nil? false
      default false
      public? true
    end
  end

  identities do
    identity :unique_tracking_code, [:tracking_code] do
      message "has already been taken"
    end

    identity :single_fragile_per_shipment, [:shipment_id] do
      where expr(fragile == true)
      message "has already been taken"
    end
  end

  relationships do
    belongs_to :shipment, Logistics.Freight.Shipment do
      allow_nil? false
      attribute_writable? true
      attribute_public? true
      public? true
    end
  end
end
