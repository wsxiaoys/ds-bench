defmodule Vault.Ledger do
  use Ash.Domain
  require Ash.Query

  resources do
    resource Vault.Ledger.Event
    resource Vault.Ledger.Snapshot
    resource Vault.Ledger.AccountProjection
    resource Vault.Ledger.Checkpoint
  end

  def open_account(account_id, owner, params \\ %{}, opts \\ []) do
    opening_balance_cents = Map.get(params, :opening_balance_cents) || Map.get(params, "opening_balance_cents") || 0
    recorded_at = Map.get(params, :recorded_at) || Map.get(params, "recorded_at")

    input = Ash.ActionInput.for_action(Vault.Ledger.Event, :open_account, %{
      account_id: account_id,
      owner: owner,
      opening_balance_cents: opening_balance_cents,
      recorded_at: recorded_at
    })

    Ash.run_action(input, opts)
  end

  def open_account!(account_id, owner, params \\ %{}, opts \\ []) do
    case open_account(account_id, owner, params, opts) do
      {:ok, result} -> result
      {:error, error} -> raise error
    end
  end

  def deposit(account_id, amount_cents, params \\ %{}, opts \\ []) do
    recorded_at = Map.get(params, :recorded_at) || Map.get(params, "recorded_at")

    input = Ash.ActionInput.for_action(Vault.Ledger.Event, :deposit, %{
      account_id: account_id,
      amount_cents: amount_cents,
      recorded_at: recorded_at
    })

    Ash.run_action(input, opts)
  end

  def deposit!(account_id, amount_cents, params \\ %{}, opts \\ []) do
    case deposit(account_id, amount_cents, params, opts) do
      {:ok, result} -> result
      {:error, error} -> raise error
    end
  end

  def withdraw(account_id, amount_cents, params \\ %{}, opts \\ []) do
    recorded_at = Map.get(params, :recorded_at) || Map.get(params, "recorded_at")

    input = Ash.ActionInput.for_action(Vault.Ledger.Event, :withdraw, %{
      account_id: account_id,
      amount_cents: amount_cents,
      recorded_at: recorded_at
    })

    Ash.run_action(input, opts)
  end

  def withdraw!(account_id, amount_cents, params \\ %{}, opts \\ []) do
    case withdraw(account_id, amount_cents, params, opts) do
      {:ok, result} -> result
      {:error, error} -> raise error
    end
  end

  def transfer(from_account_id, to_account_id, amount_cents, params \\ %{}, opts \\ []) do
    recorded_at = Map.get(params, :recorded_at) || Map.get(params, "recorded_at")

    input = Ash.ActionInput.for_action(Vault.Ledger.Event, :transfer, %{
      from_account_id: from_account_id,
      to_account_id: to_account_id,
      amount_cents: amount_cents,
      recorded_at: recorded_at
    })

    Ash.run_action(input, opts)
  end

  def transfer!(from_account_id, to_account_id, amount_cents, params \\ %{}, opts \\ []) do
    case transfer(from_account_id, to_account_id, amount_cents, params, opts) do
      {:ok, result} -> result
      {:error, error} -> raise error
    end
  end

  def freeze_account(account_id, reason, params \\ %{}, opts \\ []) do
    recorded_at = Map.get(params, :recorded_at) || Map.get(params, "recorded_at")

    input = Ash.ActionInput.for_action(Vault.Ledger.Event, :freeze, %{
      account_id: account_id,
      reason: reason,
      recorded_at: recorded_at
    })

    Ash.run_action(input, opts)
  end

  def freeze_account!(account_id, reason, params \\ %{}, opts \\ []) do
    case freeze_account(account_id, reason, params, opts) do
      {:ok, result} -> result
      {:error, error} -> raise error
    end
  end

  def unfreeze_account(account_id, params \\ %{}, opts \\ []) do
    note = Map.get(params, :note) || Map.get(params, "note")
    recorded_at = Map.get(params, :recorded_at) || Map.get(params, "recorded_at")

    input = Ash.ActionInput.for_action(Vault.Ledger.Event, :unfreeze, %{
      account_id: account_id,
      note: note,
      recorded_at: recorded_at
    })

    Ash.run_action(input, opts)
  end

  def unfreeze_account!(account_id, params \\ %{}, opts \\ []) do
    case unfreeze_account(account_id, params, opts) do
      {:ok, result} -> result
      {:error, error} -> raise error
    end
  end

  def append_event(params, opts \\ []) do
    Vault.Ledger.Event
    |> Ash.Changeset.for_create(:append, params)
    |> Ash.create(opts)
  end

  def append_event!(params, opts \\ []) do
    case append_event(params, opts) do
      {:ok, result} -> result
      {:error, error} -> raise error
    end
  end

  def list_events(params \\ %{}, opts \\ []) do
    query = Vault.Ledger.Event
    account_id = Map.get(params, :account_id) || Map.get(params, "account_id")
    query =
      if account_id do
        Ash.Query.filter(query, account_id == ^account_id)
      else
        query
      end

    Ash.read(query, opts)
  end

  def list_events!(params \\ %{}, opts \\ []) do
    case list_events(params, opts) do
      {:ok, result} -> result
      {:error, error} -> raise error
    end
  end
end
