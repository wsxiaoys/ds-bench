defmodule Ledger.Billing do
  @moduledoc """
  The billing domain.
  """
  use Ash.Domain, otp_app: :ledger

  resources do
    resource Ledger.Billing.Invoice
    resource Ledger.Billing.Payment
  end

  # issue_invoice(params) and issue_invoice!(params)
  def issue_invoice(params) do
    Ledger.Billing.Invoice
    |> Ash.Changeset.for_create(:issue, params)
    |> Ash.create()
  end

  def issue_invoice!(params) do
    Ledger.Billing.Invoice
    |> Ash.Changeset.for_create(:issue, params)
    |> Ash.create!()
  end

  # get_invoice(id) and get_invoice!(id)
  def get_invoice(id) do
    Ash.get(Ledger.Billing.Invoice, id)
  end

  def get_invoice!(id) do
    Ash.get!(Ledger.Billing.Invoice, id)
  end

  # list_invoices() and list_invoices!()
  def list_invoices do
    Ash.read(Ledger.Billing.Invoice)
  end

  def list_invoices! do
    Ash.read!(Ledger.Billing.Invoice)
  end

  # apply_adjustment(invoice, adjustment) and apply_adjustment!(invoice, adjustment)
  def apply_adjustment(invoice, adjustment) do
    invoice
    |> Ash.Changeset.for_update(:apply_adjustment, %{adjustment: adjustment})
    |> Ash.update()
  end

  def apply_adjustment!(invoice, adjustment) do
    invoice
    |> Ash.Changeset.for_update(:apply_adjustment, %{adjustment: adjustment})
    |> Ash.update!()
  end

  # price_for(unit_price, units) and price_for!(unit_price, units)
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

  # record_payment(params) and record_payment!(params)
  def record_payment(params) do
    Ledger.Billing.Payment
    |> Ash.Changeset.for_create(:record, params)
    |> Ash.create()
  end

  def record_payment!(params) do
    Ledger.Billing.Payment
    |> Ash.Changeset.for_create(:record, params)
    |> Ash.create!()
  end
end
