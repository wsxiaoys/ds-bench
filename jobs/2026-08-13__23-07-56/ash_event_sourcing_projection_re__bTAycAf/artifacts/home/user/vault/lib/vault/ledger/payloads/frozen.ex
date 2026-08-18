defmodule Vault.Ledger.Payloads.Frozen do
  use Ash.Resource, data_layer: :embedded

  attributes do
    attribute :type, :string, allow_nil?: false, public?: true
    attribute :reason, :atom, allow_nil?: false, public?: true, constraints: [one_of: [:fraud_review, :chargeback, :court_order]]
  end
end
