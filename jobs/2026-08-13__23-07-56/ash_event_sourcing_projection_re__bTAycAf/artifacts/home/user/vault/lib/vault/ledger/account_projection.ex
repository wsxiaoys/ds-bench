defmodule Vault.Ledger.AccountProjection do
  use Ash.Resource,
    domain: Vault.Ledger,
    data_layer: Ash.DataLayer.Ets

  ets do
    private? true
  end

  attributes do
    attribute :account_id, :string, primary_key?: true, allow_nil?: false, public?: true
    attribute :owner, :string, allow_nil?: false, public?: true
    attribute :balance_cents, :integer, allow_nil?: false, public?: true
    attribute :status, :atom, allow_nil?: false, public?: true, constraints: [one_of: [:open, :frozen]]
    attribute :version, :integer, allow_nil?: false, public?: true
    attribute :deposit_count, :integer, allow_nil?: false, public?: true
    attribute :withdrawal_count, :integer, allow_nil?: false, public?: true
    attribute :last_event_sequence, :integer, allow_nil?: false, public?: true
    attribute :last_recorded_at, :utc_datetime_usec, allow_nil?: false, public?: true
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
