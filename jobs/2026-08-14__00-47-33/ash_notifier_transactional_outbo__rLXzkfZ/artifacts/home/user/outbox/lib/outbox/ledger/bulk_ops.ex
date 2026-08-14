defmodule Outbox.Ledger.BulkOps do
  @moduledoc """
  Batch operations for ledger resources.
  """

  @doc """
  Creates every account in inputs with a single Ash batch create, returning the created records.
  """
  def open_many(inputs) do
    result = Ash.bulk_create!(inputs, Outbox.Ledger.Account, :open, return_records?: true, notify?: true)
    {:ok, result.records}
  end

  @doc """
  Applies the :freeze action to every given account with a single Ash batch update, returning the updated records.
  """
  def freeze_many(accounts) do
    result = Ash.bulk_update!(accounts, :freeze, %{}, return_records?: true, notify?: true)
    {:ok, result.records}
  end
end
