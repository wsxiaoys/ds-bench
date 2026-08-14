defmodule Vault.Ledger.Payloads.AccountOpened do
  use Ash.Resource,
    data_layer: :embedded

  attributes do
    attribute :type, :string, allow_nil?: false, default: "account_opened"
    attribute :owner, :string, allow_nil?: false, public?: true, constraints: [min_length: 1, allow_empty?: false]
    attribute :opening_balance_cents, :integer, allow_nil?: false, public?: true, constraints: [min: 0]
  end
end
