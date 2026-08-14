defmodule Vault.Ledger.Snapshot do
  use Ash.Resource,
    domain: Vault.Ledger,
    data_layer: Ash.DataLayer.Ets

  ets do
    private? true
  end

  attributes do
    uuid_primary_key :id

    attribute :account_id, :string, allow_nil?: false, public?: true
    attribute :version, :integer, allow_nil?: false, public?: true
    attribute :sequence, :integer, allow_nil?: false, public?: true
    attribute :state, :map, allow_nil?: false, public?: true
    attribute :checksum, :string, allow_nil?: false, public?: true
  end

  identities do
    identity :unique_account_version, [:account_id, :version], pre_check_with: Vault.Ledger
  end

  actions do
    defaults [:read]

    create :create do
      accept [:account_id, :version, :sequence, :state, :checksum]
    end
  end
end
