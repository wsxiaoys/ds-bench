defmodule Ledger.Billing.Invoice.CalculateBalance do
  @moduledoc """
  Calculation module for Invoice balance.
  """
  use Ash.Resource.Calculation

  @impl true
  def load(_query, _opts, _context) do
    [:total, :paid_minor]
  end

  @impl true
  def calculate(records, _opts, _context) do
    Enum.map(records, fn record ->
      total = record.total
      paid_minor = record.paid_minor || 0

      paid_money = %Ledger.Money{currency: total.currency, amount: paid_minor}

      case Ledger.Money.subtract(total, paid_money) do
        {:ok, balance} -> balance
        _ -> nil
      end
    end)
  end
end
