defmodule Vault.Ledger.Payloads.Unfrozen do
  use Ash.Resource,
    data_layer: :embedded

  attributes do
    attribute :note, :string do
      allow_nil? true
      public? true
      constraints max_length: 120
    end
  end
end
