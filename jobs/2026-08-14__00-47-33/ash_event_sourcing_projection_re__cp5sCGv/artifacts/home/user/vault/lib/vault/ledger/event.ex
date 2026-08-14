defmodule Vault.Ledger.Event do
  use Ash.Resource,
    domain: Vault.Ledger,
    data_layer: Ash.DataLayer.Ets

  ets do
    private? true
  end

  attributes do
    uuid_primary_key :id

    attribute :sequence, :integer do
      allow_nil? false
      public? true
    end

    attribute :account_id, :string do
      allow_nil? false
      public? true
    end

    attribute :version, :integer do
      allow_nil? false
      public? true
    end

    attribute :payload, Vault.Ledger.Payload do
      allow_nil? false
      public? true
    end

    attribute :recorded_at, :utc_datetime_usec do
      allow_nil? false
      public? true
    end
  end

  identities do
    identity :unique_account_version, [:account_id, :version] do
      pre_check_with Vault.Ledger
    end

    identity :unique_sequence, [:sequence] do
      pre_check_with Vault.Ledger
    end
  end

  actions do
    defaults [:read]

    create :append do
      accept [:account_id, :version, :payload, :recorded_at]
      change {Vault.Ledger.Event.AppendChange, []}
    end

    action :open_account, :term do
      argument :account_id, :string, allow_nil?: false
      argument :owner, :string, allow_nil?: false
      argument :opening_balance_cents, :integer, default: 0
      argument :recorded_at, :utc_datetime_usec
      run fn input, _context ->
        Vault.Ledger.Commands.open_account(
          Map.get(input.arguments, :account_id),
          Map.get(input.arguments, :owner),
          Map.get(input.arguments, :opening_balance_cents, 0),
          Map.get(input.arguments, :recorded_at)
        )
      end
    end

    action :deposit, :term do
      argument :account_id, :string, allow_nil?: false
      argument :amount_cents, :integer, allow_nil?: false
      argument :recorded_at, :utc_datetime_usec
      run fn input, _context ->
        Vault.Ledger.Commands.deposit(
          Map.get(input.arguments, :account_id),
          Map.get(input.arguments, :amount_cents),
          Map.get(input.arguments, :recorded_at)
        )
      end
    end

    action :withdraw, :term do
      argument :account_id, :string, allow_nil?: false
      argument :amount_cents, :integer, allow_nil?: false
      argument :recorded_at, :utc_datetime_usec
      run fn input, _context ->
        Vault.Ledger.Commands.withdraw(
          Map.get(input.arguments, :account_id),
          Map.get(input.arguments, :amount_cents),
          Map.get(input.arguments, :recorded_at)
        )
      end
    end

    action :transfer, :term do
      argument :from_account_id, :string, allow_nil?: false
      argument :to_account_id, :string, allow_nil?: false
      argument :amount_cents, :integer, allow_nil?: false
      argument :recorded_at, :utc_datetime_usec
      run fn input, _context ->
        Vault.Ledger.Commands.transfer(
          Map.get(input.arguments, :from_account_id),
          Map.get(input.arguments, :to_account_id),
          Map.get(input.arguments, :amount_cents),
          Map.get(input.arguments, :recorded_at)
        )
      end
    end

    action :freeze, :term do
      argument :account_id, :string, allow_nil?: false
      argument :reason, :atom, allow_nil?: false
      argument :recorded_at, :utc_datetime_usec
      run fn input, _context ->
        Vault.Ledger.Commands.freeze(
          Map.get(input.arguments, :account_id),
          Map.get(input.arguments, :reason),
          Map.get(input.arguments, :recorded_at)
        )
      end
    end

    action :unfreeze, :term do
      argument :account_id, :string, allow_nil?: false
      argument :note, :string
      argument :recorded_at, :utc_datetime_usec
      run fn input, _context ->
        Vault.Ledger.Commands.unfreeze(
          Map.get(input.arguments, :account_id),
          Map.get(input.arguments, :note),
          Map.get(input.arguments, :recorded_at)
        )
      end
    end
  end
end
