defmodule SlaLab.Ops.Shipment do
  use Ash.Resource,
    otp_app: :sla_lab,
    domain: SlaLab.Ops,
    data_layer: Ash.DataLayer.Ets,
    authorizers: [Ash.Policy.Authorizer]

  ets do
    private? true
  end

  attributes do
    uuid_primary_key :id
    attribute :reference, :string, allow_nil?: false, public?: true
    attribute :origin_zone, :string, allow_nil?: false, public?: true
    attribute :destination_zone, :string, allow_nil?: false, public?: true
    attribute :promised_hours, :integer, allow_nil?: false, public?: true
    attribute :actual_hours, :integer, public?: true

    attribute :priority, :atom,
      default: :standard,
      public?: true,
      constraints: [one_of: [:standard, :express, :critical]]
  end

  relationships do
    belongs_to :carrier, SlaLab.Ops.Carrier do
      public? true
      attribute_writable? true
    end
  end

  calculations do
    calculate :route_key, :string, expr(route_key(origin_zone, destination_zone)), public?: true
    calculate :sla_ratio_bps, :integer, expr(ratio_bps(actual_hours, promised_hours)), public?: true
    calculate :status_label, :string, expr(
      cond do
        is_nil(actual_hours) -> "pending"
        sla_ratio_bps > 10_000 -> "breached"
        true -> "met"
      end
    ), public?: true
  end

  actions do
    defaults [:read, :destroy, create: :*]

    read :on_route do
      argument :route, :string, allow_nil?: false
      filter expr(route_key == ^arg(:route))
    end

    update :record_delivery do
      accept [:actual_hours]
      require_atomic? true
      validate {SlaLab.Ops.Validations.RatioWithin, max_bps: 15_000}
    end
  end

  policies do
    # If the actor is absent, strictly forbid
    policy actor_absent() do
      access_type :strict
      forbid_if always()
    end

    # Reads are authorized only when...
    policy action_type(:read) do
      # an actor whose :role is :admin may read every shipment regardless of its route
      authorize_if actor_attribute_equals(:role, :admin)

      # reads are authorised only when the actor's :home_route equals the shipment's route key
      authorize_if expr(^actor(:home_route) == route_key)
    end

    # All other actions stay unrestricted
    policy action_type([:create, :update, :destroy, :action]) do
      authorize_if always()
    end
  end
end
