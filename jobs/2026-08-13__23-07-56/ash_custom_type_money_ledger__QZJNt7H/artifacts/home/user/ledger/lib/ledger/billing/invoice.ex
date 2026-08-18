defmodule Ledger.Billing.Invoice do
  @moduledoc """
  The Invoice resource.
  """
  use Ash.Resource,
    otp_app: :ledger,
    domain: Ledger.Billing,
    data_layer: Ash.DataLayer.Ets

  ets do
    private? true
  end

  attributes do
    uuid_primary_key :id

    attribute :reference, :string do
      allow_nil? false
    end

    attribute :subtotal, Ledger.Money.Type do
      allow_nil? false
      constraints currencies: [:usd, :eur, :jpy]
    end

    attribute :adjustments, {:array, Ledger.Money.Type} do
      allow_nil? false
      default []
      constraints items: [multiple_of: 5]
    end

    attribute :credit_limit, Ledger.Money.Usd do
      allow_nil? true
    end
  end

  relationships do
    has_many :payments, Ledger.Billing.Payment
  end

  aggregates do
    sum :paid_minor, :payments, :amount_minor do
      default 0
    end
  end

  calculations do
    calculate :total, Ledger.Money.Type, Ledger.Billing.Invoice.CalculateTotal
    calculate :balance, Ledger.Money.Type, Ledger.Billing.Invoice.CalculateBalance
  end

  validations do
    validate Ledger.Billing.Invoice.ValidateAdjustmentsCurrency
  end

  actions do
    default_accept :*
    defaults [:read, :destroy]

    create :issue do
      accept [:reference, :subtotal, :adjustments, :credit_limit]
    end

    update :apply_adjustment do
      require_atomic? false

      argument :adjustment, Ledger.Money.Type do
        allow_nil? false
      end

      change Ledger.Billing.Invoice.ApplyAdjustmentChange
    end

    action :price_for, Ledger.Money.Type do
      argument :unit_price, Ledger.Money.Type do
        allow_nil? false
      end

      argument :units, :integer do
        allow_nil? false
      end

      run fn input, _context ->
        unit_price = input.arguments.unit_price
        units = input.arguments.units

        case Ledger.Money.multiply(unit_price, units) do
          {:ok, result} -> {:ok, result}
          {:error, reason} -> {:error, reason}
        end
      end
    end
  end
end
