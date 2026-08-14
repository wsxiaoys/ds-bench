defmodule Outbox.Ledger.BulkOps do
  @moduledoc """
  Batch operations on the ledger resources.
  """

  alias Outbox.Ledger.Account

  @spec open_many(inputs :: [map()]) :: {:ok, [Account.t()]}
  def open_many(inputs) do
    # Creates every account in inputs with a single Ash batch create
    case Ash.bulk_create(inputs, Account, :open, return_records?: true, notify?: true) do
      %Ash.BulkResult{records: records} ->
        {:ok, records}
    end
  end

  @spec freeze_many(accounts :: [Account.t()]) :: {:ok, [Account.t()]}
  def freeze_many(accounts) do
    # Applies the :freeze action to every given account with a single Ash batch update
    case Ash.bulk_update(accounts, :freeze, %{}, return_records?: true, notify?: true) do
      %Ash.BulkResult{records: records} ->
        {:ok, records}
    end
  end
end
