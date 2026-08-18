defmodule Vault.Ledger.Snapshot do
  use Ash.Resource,
    domain: Vault.Ledger,
    data_layer: Ash.DataLayer.Ets

  ets do
    private? true
  end

  attributes do
    uuid_primary_key :id

    attribute :account_id, :string do
      allow_nil? false
      public? true
    end

    attribute :version, :integer do
      allow_nil? false
      public? true
    end

    attribute :sequence, :integer do
      allow_nil? false
      public? true
    end

    attribute :state, :map do
      allow_nil? false
      public? true
    end

    attribute :checksum, :string do
      allow_nil? false
      public? true
    end
  end

  identities do
    identity :unique_account_version, [:account_id, :version] do
      pre_check_with Vault.Ledger
    end
  end

  actions do
    defaults [:read]

    create :create do
      accept [:account_id, :version, :sequence, :state, :checksum]
    end
  end
end
