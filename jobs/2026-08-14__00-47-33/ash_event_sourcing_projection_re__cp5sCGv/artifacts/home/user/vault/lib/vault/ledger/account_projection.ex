defmodule Vault.Ledger.AccountProjection do
  use Ash.Resource,
    domain: Vault.Ledger,
    data_layer: Ash.DataLayer.Ets

  ets do
    private? true
  end

  attributes do
    attribute :account_id, :string do
      primary_key? true
      allow_nil? false
      public? true
    end

    attribute :owner, :string do
      allow_nil? false
      public? true
    end

    attribute :balance_cents, :integer do
      allow_nil? false
      public? true
    end

    attribute :status, :atom do
      allow_nil? false
      constraints one_of: [:open, :frozen]
      public? true
    end

    attribute :version, :integer do
      allow_nil? false
      public? true
    end

    attribute :deposit_count, :integer do
      allow_nil? false
      public? true
    end

    attribute :withdrawal_count, :integer do
      allow_nil? false
      public? true
    end

    attribute :last_event_sequence, :integer do
      allow_nil? false
      public? true
    end

    attribute :last_recorded_at, :utc_datetime_usec do
      allow_nil? false
      public? true
    end
  end

  actions do
    defaults [:read, :destroy]

    create :create do
      accept [
        :account_id, :owner, :balance_cents, :status, :version,
        :deposit_count, :withdrawal_count, :last_event_sequence, :last_recorded_at
      ]
    end

    update :update do
      accept [
        :owner, :balance_cents, :status, :version,
        :deposit_count, :withdrawal_count, :last_event_sequence, :last_recorded_at
      ]
    end
  end
end
