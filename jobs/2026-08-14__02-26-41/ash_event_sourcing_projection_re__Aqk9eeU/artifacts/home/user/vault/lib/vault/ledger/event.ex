defmodule Vault.Ledger.Event do
  use Ash.Resource,
    domain: Vault.Ledger,
    data_layer: Ash.DataLayer.Ets

  ets do
    private? true
  end

  attributes do
    uuid_primary_key :id

    attribute :sequence, :integer, allow_nil?: false, public?: true
    attribute :account_id, :string, allow_nil?: false, public?: true
    attribute :version, :integer, allow_nil?: false, public?: true
    attribute :payload, Vault.Ledger.Payload, allow_nil?: false, public?: true
    attribute :recorded_at, :utc_datetime_usec, allow_nil?: false, public?: true
  end

  identities do
    identity :unique_account_version, [:account_id, :version], pre_check_with: Vault.Ledger
    identity :unique_sequence, [:sequence], pre_check_with: Vault.Ledger
  end

  actions do
    defaults [:read]

    create :append do
      accept [:account_id, :version, :payload, :recorded_at]
      change Vault.Ledger.Changes.AppendEvent
    end

    action :open_account, :struct do
      argument :account_id, :string, allow_nil?: false
      argument :owner, :string, allow_nil?: false
      argument :opening_balance_cents, :integer, default: 0
      argument :recorded_at, :utc_datetime_usec

      run fn input, _context ->
        Vault.Ledger.Commands.open_account(
          input.arguments.account_id,
          input.arguments.owner,
          input.arguments.opening_balance_cents,
          input.arguments.recorded_at
        )
      end
    end

    action :deposit, :struct do
      argument :account_id, :string, allow_nil?: false
      argument :amount_cents, :integer, allow_nil?: false
      argument :recorded_at, :utc_datetime_usec

      run fn input, _context ->
        Vault.Ledger.Commands.deposit(
          input.arguments.account_id,
          input.arguments.amount_cents,
          input.arguments.recorded_at
        )
      end
    end

    action :withdraw, :struct do
      argument :account_id, :string, allow_nil?: false
      argument :amount_cents, :integer, allow_nil?: false
      argument :recorded_at, :utc_datetime_usec

      run fn input, _context ->
        Vault.Ledger.Commands.withdraw(
          input.arguments.account_id,
          input.arguments.amount_cents,
          input.arguments.recorded_at
        )
      end
    end

    action :transfer, :struct do
      argument :from_account_id, :string, allow_nil?: false
      argument :to_account_id, :string, allow_nil?: false
      argument :amount_cents, :integer, allow_nil?: false
      argument :recorded_at, :utc_datetime_usec

      run fn input, _context ->
        Vault.Ledger.Commands.transfer(
          input.arguments.from_account_id,
          input.arguments.to_account_id,
          input.arguments.amount_cents,
          input.arguments.recorded_at
        )
      end
    end

    action :freeze, :struct do
      argument :account_id, :string, allow_nil?: false
      argument :reason, :atom, allow_nil?: false
      argument :recorded_at, :utc_datetime_usec

      run fn input, _context ->
        Vault.Ledger.Commands.freeze(
          input.arguments.account_id,
          input.arguments.reason,
          input.arguments.recorded_at
        )
      end
    end

    action :unfreeze, :struct do
      argument :account_id, :string, allow_nil?: false
      argument :note, :string
      argument :recorded_at, :utc_datetime_usec

      run fn input, _context ->
        Vault.Ledger.Commands.unfreeze(
          input.arguments.account_id,
          input.arguments.note,
          input.arguments.recorded_at
        )
      end
    end
  end
end
