defmodule Ledger.Billing.Payment.DeriveFields do
  @moduledoc """
  Derives amount_minor and amount_currency from amount.
  """
  use Ash.Resource.Change

  @impl true
  def change(changeset, _opts, _context) do
    amount = Ash.Changeset.get_attribute(changeset, :amount)

    if amount do
      changeset
      |> Ash.Changeset.force_change_attribute(:amount_minor, amount.amount)
      |> Ash.Changeset.force_change_attribute(:amount_currency, amount.currency)
    else
      changeset
    end
  end
end
