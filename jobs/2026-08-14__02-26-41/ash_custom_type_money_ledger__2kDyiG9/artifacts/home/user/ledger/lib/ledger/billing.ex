defmodule Ledger.Billing do
  @moduledoc """
  The billing domain.
  """
  use Ash.Domain, otp_app: :ledger

  resources do
    resource Ledger.Billing.Invoice
    resource Ledger.Billing.Payment
  end

  def issue_invoice(params) do
    Ash.create(Ledger.Billing.Invoice, params, action: :issue)
  end

  def issue_invoice!(params) do
    Ash.create!(Ledger.Billing.Invoice, params, action: :issue)
  end

  def get_invoice(id) do
    Ash.get(Ledger.Billing.Invoice, id)
  end

  def get_invoice!(id) do
    Ash.get!(Ledger.Billing.Invoice, id)
  end

  def list_invoices() do
    Ash.read(Ledger.Billing.Invoice)
  end

  def list_invoices!() do
    Ash.read!(Ledger.Billing.Invoice)
  end

  def apply_adjustment(invoice, adjustment) do
    Ash.update(invoice, %{adjustment: adjustment}, action: :apply_adjustment)
  end

  def apply_adjustment!(invoice, adjustment) do
    Ash.update!(invoice, %{adjustment: adjustment}, action: :apply_adjustment)
  end

  def price_for(unit_price, units) do
    Ledger.Billing.Invoice
    |> Ash.ActionInput.for_action(:price_for, %{unit_price: unit_price, units: units})
    |> Ash.run_action()
  end

  def price_for!(unit_price, units) do
    Ledger.Billing.Invoice
    |> Ash.ActionInput.for_action(:price_for, %{unit_price: unit_price, units: units})
    |> Ash.run_action!()
  end

  def record_payment(params) do
    Ash.create(Ledger.Billing.Payment, params, action: :record)
  end

  def record_payment!(params) do
    Ash.create!(Ledger.Billing.Payment, params, action: :record)
  end
end
