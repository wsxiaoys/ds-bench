defmodule Ledger.Billing.Payment do
  @moduledoc """
  The Payment resource.
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

    attribute :amount, Ledger.Money.Type,
      allow_nil?: false,
      constraints: [currencies: [:usd, :eur, :jpy]]

    attribute :amount_minor, :integer, allow_nil?: false
    attribute :amount_currency, :atom, allow_nil?: false
  end

  relationships do
    belongs_to :invoice, Ledger.Billing.Invoice do
      allow_nil? false
      attribute_writable? true
    end
  end

  actions do
    defaults [:read, :destroy]

    create :record do
      accept [:amount, :invoice_id]
      change Ledger.Billing.Payment.DeriveAmountFieldsChange
    end
  end
end

defmodule Ledger.Billing.Payment.DeriveAmountFieldsChange do
  @moduledoc false
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
