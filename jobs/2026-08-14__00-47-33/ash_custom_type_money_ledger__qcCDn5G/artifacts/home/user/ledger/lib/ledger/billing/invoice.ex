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

    attribute :reference, :string, allow_nil?: false

    attribute :subtotal, Ledger.Money.Type,
      allow_nil?: false,
      constraints: [currencies: [:usd, :eur, :jpy]]

    attribute :adjustments, {:array, Ledger.Money.Type},
      default: [],
      constraints: [items: [multiple_of: 5]]

    attribute :credit_limit, Ledger.Money.Usd, allow_nil?: true
  end

  relationships do
    has_many :payments, Ledger.Billing.Payment, destination_attribute: :invoice_id
  end

  aggregates do
    sum :paid_minor, :payments, :amount_minor do
      default 0
    end
  end

  calculations do
    calculate :total, Ledger.Money.Type, Ledger.Billing.Invoice.Total
    calculate :balance, Ledger.Money.Type, Ledger.Billing.Invoice.Balance
  end

  validations do
    validate {Ledger.Billing.Invoice.ValidateAdjustmentsCurrency, []}
  end

  actions do
    defaults [:read, :destroy]

    create :issue do
      accept [:reference, :subtotal, :adjustments, :credit_limit]
    end

    update :apply_adjustment do
      require_atomic? false
      argument :adjustment, Ledger.Money.Type, allow_nil?: false
      change Ledger.Billing.Invoice.ApplyAdjustmentChange
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
  @moduledoc false
  use Ash.Resource.Calculation

  @impl true
  def load(_query, _opts, _context) do
    [:subtotal, :adjustments]
  end

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
          nil
      end
    end)
  end
end

defmodule Ledger.Billing.Invoice.Balance do
  @moduledoc false
  use Ash.Resource.Calculation

  @impl true
  def load(_query, _opts, _context) do
    [:total, :subtotal, :paid_minor]
  end

  @impl true
  def calculate(records, _opts, _context) do
    Enum.map(records, fn record ->
      total = record.total
      paid_minor = record.paid_minor || 0
      currency = record.subtotal.currency
      paid_money = Ledger.Money.new!(paid_minor, currency)

      case Ledger.Money.subtract(total, paid_money) do
        {:ok, balance} -> balance
        _ -> nil
      end
    end)
  end
end

defmodule Ledger.Billing.Invoice.ValidateAdjustmentsCurrency do
  @moduledoc false
  use Ash.Resource.Validation

  @impl true
  def validate(changeset, _opts, _context) do
    subtotal = Ash.Changeset.get_attribute(changeset, :subtotal)
    adjustments = Ash.Changeset.get_attribute(changeset, :adjustments) || []

    if subtotal do
      currency = subtotal.currency
      mismatch? = Enum.any?(adjustments, fn adj -> adj.currency != currency end)

      if mismatch? do
        {:error,
         Ash.Error.Changes.InvalidAttribute.exception(
           field: :adjustments,
           message: "must all use the currency of the subtotal"
         )}
      else
        :ok
      end
    else
      :ok
    end
  end
end

defmodule Ledger.Billing.Invoice.ApplyAdjustmentChange do
  @moduledoc false
  use Ash.Resource.Change

  @impl true
  def change(changeset, _opts, _context) do
    adjustment = Ash.Changeset.get_argument(changeset, :adjustment)
    subtotal = Ash.Changeset.get_attribute(changeset, :subtotal)

    if adjustment && subtotal do
      if adjustment.currency != subtotal.currency do
        Ash.Changeset.add_error(
          changeset,
          Ash.Error.Changes.InvalidArgument.exception(
            field: :adjustment,
            message: "must use the currency of the subtotal"
          )
        )
      else
        current_adjustments = Ash.Changeset.get_attribute(changeset, :adjustments) || []
        new_adjustments = current_adjustments ++ [adjustment]
        Ash.Changeset.force_change_attribute(changeset, :adjustments, new_adjustments)
      end
    else
      changeset
    end
  end
end
