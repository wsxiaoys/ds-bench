defmodule Outbox.Ledger.BulkOps do
  @moduledoc """
  Batch operations on the ledger resources.
  """

  @doc """
  Creates every account in inputs with a single Ash batch create.
  """
  def open_many(inputs) do
    res = Ash.bulk_create(inputs, Outbox.Ledger.Account, :open, return_records?: true, notify?: true)
    {:ok, res.records || []}
  end

  @doc """
  Applies the :freeze action to every given account with a single Ash batch update.
  """
  def freeze_many(accounts) do
    res = Ash.bulk_update(accounts, :freeze, %{}, return_records?: true, notify?: true)
    {:ok, res.records || []}
  end
end
