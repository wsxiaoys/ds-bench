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
    uuid_primary_key :id, public?: true

    attribute :amount, Ledger.Money.Type,
      allow_nil?: false,
      public?: true,
      constraints: [currencies: [:usd, :eur, :jpy]]

    attribute :amount_minor, :integer, public?: true
    attribute :amount_currency, :atom, public?: true
  end

  relationships do
    belongs_to :invoice, Ledger.Billing.Invoice do
      allow_nil? false
      public? true
      attribute_writable? true
    end
  end

  actions do
    defaults [:read, :destroy]

    create :record do
      accept [:amount, :invoice_id]

      change fn changeset, _context ->
        case Ash.Changeset.get_attribute(changeset, :amount) do
          %Ledger.Money{amount: minor, currency: curr} ->
            changeset
            |> Ash.Changeset.force_change_attribute(:amount_minor, minor)
            |> Ash.Changeset.force_change_attribute(:amount_currency, curr)
          _ ->
            changeset
        end
      end
    end
  end
end
