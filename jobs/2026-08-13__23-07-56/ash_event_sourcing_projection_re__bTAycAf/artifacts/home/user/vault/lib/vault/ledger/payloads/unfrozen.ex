defmodule Vault.Ledger.Payloads.Unfrozen do
  use Ash.Resource, data_layer: :embedded

  attributes do
    attribute :type, :string, allow_nil?: false, public?: true
    attribute :note, :string, allow_nil?: true, public?: true, constraints: [max_length: 120]
  end
end
