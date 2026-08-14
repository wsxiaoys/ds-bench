defmodule Vault.Ledger.AccountState do
  @derive {Jason.Encoder, only: [:account_id, :owner, :balance_cents, :status, :version, :deposit_count, :withdrawal_count, :last_event_type, :last_recorded_at]}
  defstruct [
    account_id: nil,
    owner: nil,
    balance_cents: 0,
    status: :absent,
    version: 0,
    deposit_count: 0,
    withdrawal_count: 0,
    last_event_type: nil,
    last_recorded_at: nil
  ]
end
