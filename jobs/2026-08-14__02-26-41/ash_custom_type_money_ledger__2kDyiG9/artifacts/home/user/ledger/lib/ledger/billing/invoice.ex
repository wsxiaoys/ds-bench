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
    uuid_primary_key :id, public?: true

    attribute :reference, :string, allow_nil?: false, public?: true

    attribute :subtotal, Ledger.Money.Type,
      allow_nil?: false,
      public?: true,
      constraints: [currencies: [:usd, :eur, :jpy]]

    attribute :adjustments, {:array, Ledger.Money.Type},
      default: [],
      public?: true,
      constraints: [items: [multiple_of: 5]]

    attribute :credit_limit, Ledger.Money.Usd,
      allow_nil?: true,
      public?: true
  end

  relationships do
    has_many :payments, Ledger.Billing.Payment, public?: true
  end

  aggregates do
    sum :paid_minor, :payments, :amount_minor do
      default 0
      public? true
    end
  end

  calculations do
    calculate :total, Ledger.Money.Type, Ledger.Billing.Invoice.Total, public?: true
    calculate :balance, Ledger.Money.Type, Ledger.Billing.Invoice.Balance, public?: true
  end

  validations do
    validate Ledger.Billing.Invoice.ValidateAdjustmentsCurrency
  end

  actions do
    defaults [:read, :destroy]

    create :issue do
      accept [:reference, :subtotal, :adjustments, :credit_limit]
    end

    update :apply_adjustment do
      require_atomic? false
      argument :adjustment, Ledger.Money.Type, allow_nil?: false

      validate fn changeset, _context ->
        adjustment = Ash.Changeset.get_argument(changeset, :adjustment)
        subtotal = changeset.data.subtotal
        if adjustment && subtotal && adjustment.currency != subtotal.currency do
          {:error, Ash.Error.Changes.InvalidArgument.exception(
            field: :adjustment,
            message: "must use the currency of the subtotal",
            value: adjustment
          )}
        else
          :ok
        end
      end

      change fn changeset, _context ->
        adjustment = Ash.Changeset.get_argument(changeset, :adjustment)
        subtotal = changeset.data.subtotal
        if adjustment && subtotal && adjustment.currency == subtotal.currency do
          current_adjustments = Ash.Changeset.get_attribute(changeset, :adjustments) || []
          Ash.Changeset.force_change_attribute(changeset, :adjustments, current_adjustments ++ [adjustment])
        else
          changeset
        end
      end
    end

    action :price_for, Ledger.Money.Type do
      argument :unit_price, Ledger.Money.Type, allow_nil?: false
      argument :units, :integer, allow_nil?: false

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

defmodule Ledger.Billing.Invoice.Total do
  use Ash.Resource.Calculation

  @impl true
  def calculate(records, _opts, _context) do
    Enum.map(records, fn record ->
      subtotal = record.subtotal
      adjustments = record.adjustments || []
      case Ledger.Money.sum(adjustments, subtotal.currency) do
        {:ok, sum_adj} ->
          case Ledger.Money.add(subtotal, sum_adj) do
            {:ok, total} -> total
            _ -> nil
          end
        _ ->
          subtotal
      end
    end)
  end
end

defmodule Ledger.Billing.Invoice.Balance do
  use Ash.Resource.Calculation

  @impl true
  def calculate(records, _opts, _context) do
    Enum.map(records, fn record ->
      total = record.total
      paid_minor = record.paid_minor || 0
      paid_money = %Ledger.Money{amount: paid_minor, currency: total.currency}
      case Ledger.Money.subtract(total, paid_money) do
        {:ok, balance} -> balance
        _ -> nil
      end
    end)
  end

  @impl true
  def load(_query, _opts, _context) do
    [:total, :paid_minor]
  end
end

defmodule Ledger.Billing.Invoice.ValidateAdjustmentsCurrency do
  use Ash.Resource.Validation

  @impl true
  def validate(changeset, _opts, _context) do
    subtotal = Ash.Changeset.get_attribute(changeset, :subtotal)
    adjustments = Ash.Changeset.get_attribute(changeset, :adjustments) || []

    if subtotal do
      mismatch? = Enum.any?(adjustments, fn adj -> adj.currency != subtotal.currency end)
      if mismatch? do
        {:error, Ash.Error.Changes.InvalidAttribute.exception(
          field: :adjustments,
          message: "must all use the currency of the subtotal",
          value: adjustments
        )}
      else
        :ok
      end
    else
      :ok
    end
  end
end
