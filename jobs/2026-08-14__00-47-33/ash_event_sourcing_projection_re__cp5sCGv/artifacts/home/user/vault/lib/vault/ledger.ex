defmodule Vault.Ledger do
  use Ash.Domain

  resources do
    resource Vault.Ledger.AccountProjection do
      define :create_projection, action: :create, args: [
        :account_id, :owner, :balance_cents, :status, :version,
        :deposit_count, :withdrawal_count, :last_event_sequence, :last_recorded_at
      ]
      define :update_projection, action: :update
      define :list_projections, action: :read
    end

    resource Vault.Ledger.Checkpoint do
      define :create_checkpoint, action: :create, args: [:name, :sequence]
      define :update_checkpoint, action: :update
      define :list_checkpoints, action: :read
    end

    resource Vault.Ledger.Snapshot do
      define :create_snapshot, action: :create, args: [:account_id, :version, :sequence, :state, :checksum]
      define :list_snapshots, action: :read
    end

    resource Vault.Ledger.Event do
      define :open_account, args: [:account_id, :owner]
      define :deposit, args: [:account_id, :amount_cents]
      define :withdraw, args: [:account_id, :amount_cents]
      define :transfer, args: [:from_account_id, :to_account_id, :amount_cents]
      define :freeze_account, action: :freeze, args: [:account_id, :reason]
      define :unfreeze_account, action: :unfreeze, args: [:account_id]
      define :append_event, action: :append
      define :list_events, action: :read
    end
  end
end
