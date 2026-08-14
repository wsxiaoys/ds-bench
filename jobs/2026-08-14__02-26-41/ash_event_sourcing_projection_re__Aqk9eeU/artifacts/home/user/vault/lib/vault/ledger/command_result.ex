defmodule Vault.Ledger.CommandResult do
  @enforce_keys [:command, :account_id, :appended, :state]
  defstruct [:command, :account_id, :appended, :state]
end
