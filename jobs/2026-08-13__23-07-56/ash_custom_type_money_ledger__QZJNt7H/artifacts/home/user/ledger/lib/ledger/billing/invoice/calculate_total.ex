defmodule Ledger.Billing.Invoice.CalculateTotal do
  @moduledoc """
  Calculation module for Invoice total.
  """
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
        {:ok, adj_sum} ->
          case Ledger.Money.add(subtotal, adj_sum) do
            {:ok, total} -> total
            _ -> nil
          end

        _ ->
          nil
      end
    end)
  end
end
