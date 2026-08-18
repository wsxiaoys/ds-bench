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
    identity :unique_version, [:account_id, :version] do
      pre_check_with Vault.Ledger
    end
  end

  actions do
    defaults [:read, :destroy]

    create :create do
      accept :*
    end

    update :update do
      accept :*
      require_atomic? false
    end
  end
end
