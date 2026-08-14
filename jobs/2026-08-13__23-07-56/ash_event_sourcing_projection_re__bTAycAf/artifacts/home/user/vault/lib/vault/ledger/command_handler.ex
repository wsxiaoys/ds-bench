defmodule Vault.Ledger.CommandHandler do
  alias Vault.Ledger.CommandResult
  alias Vault.Ledger.Aggregate
  alias Vault.Ledger.Event
  alias Vault.Ledger.Projector
  alias Vault.Ledger.Snapshot
  alias Vault.Ledger.Snapshots
  alias Vault.Ledger.Fold
  require Ash.Query

  def open_account(account_id, owner, opening_balance_cents, recorded_at) do
    cond do
      opening_balance_cents < 0 ->
        invalid_arg(:opening_balance_cents, "opening balance must not be negative")

      true ->
        {:ok, state} = Aggregate.current(account_id)

        if state.status != :absent or state.version > 0 do
          invalid_arg(:account_id, "account already exists")
        else
          rec_at = recorded_at || DateTime.utc_now()
          payload = %{
            "type" => "account_opened",
            "owner" => owner,
            "opening_balance_cents" => opening_balance_cents
          }

          appended = append_one(account_id, 1, payload, rec_at)
          write_snapshots_for_account(account_id, 1)
          Projector.catch_up()

          {:ok, post_state} = Aggregate.current(account_id)
          {:ok, %CommandResult{
            command: :open_account,
            account_id: account_id,
            appended: appended,
            state: post_state
          }}
        end
    end
  end

  def deposit(account_id, amount_cents, recorded_at) do
    cond do
      amount_cents <= 0 ->
        invalid_arg(:amount_cents, "amount must be positive")

      true ->
        {:ok, state} = Aggregate.current(account_id)

        cond do
          state.status == :absent ->
            invalid_arg(:account_id, "account does not exist")

          state.status == :frozen ->
            invalid_arg(:account_id, "account is frozen")

          true ->
            rec_at = recorded_at || DateTime.utc_now()
            payload = %{
              "type" => "deposited",
              "amount_cents" => amount_cents
            }

            new_version = state.version + 1
            appended = append_one(account_id, new_version, payload, rec_at)
            write_snapshots_for_account(account_id, new_version)
            Projector.catch_up()

            {:ok, post_state} = Aggregate.current(account_id)
            {:ok, %CommandResult{
              command: :deposit,
              account_id: account_id,
              appended: appended,
              state: post_state
            }}
        end
    end
  end

  def withdraw(account_id, amount_cents, recorded_at) do
    cond do
      amount_cents <= 0 ->
        invalid_arg(:amount_cents, "amount must be positive")

      true ->
        {:ok, state} = Aggregate.current(account_id)

        cond do
          state.status == :absent ->
            invalid_arg(:account_id, "account does not exist")

          state.status == :frozen ->
            invalid_arg(:account_id, "account is frozen")

          state.balance_cents < amount_cents ->
            invalid_arg(:amount_cents, "insufficient funds")

          true ->
            rec_at = recorded_at || DateTime.utc_now()
            payload = %{
              "type" => "withdrawn",
              "amount_cents" => amount_cents
            }

            new_version = state.version + 1
            appended = append_one(account_id, new_version, payload, rec_at)
            write_snapshots_for_account(account_id, new_version)
            Projector.catch_up()

            {:ok, post_state} = Aggregate.current(account_id)
            {:ok, %CommandResult{
              command: :withdraw,
              account_id: account_id,
              appended: appended,
              state: post_state
            }}
        end
    end
  end

  def transfer(from_account_id, to_account_id, amount_cents, recorded_at) do
    cond do
      amount_cents <= 0 ->
        invalid_arg(:amount_cents, "amount must be positive")

      from_account_id == to_account_id ->
        invalid_arg(:to_account_id, "cannot transfer to the same account")

      true ->
        {:ok, from_state} = Aggregate.current(from_account_id)
        {:ok, to_state} = Aggregate.current(to_account_id)

        cond do
          from_state.status == :absent ->
            invalid_arg(:from_account_id, "account does not exist")

          to_state.status == :absent ->
            invalid_arg(:to_account_id, "account does not exist")

          from_state.status == :frozen ->
            invalid_arg(:from_account_id, "account is frozen")

          to_state.status == :frozen ->
            invalid_arg(:to_account_id, "account is frozen")

          from_state.balance_cents < amount_cents ->
            invalid_arg(:amount_cents, "insufficient funds")

          true ->
            rec_at = recorded_at || DateTime.utc_now()

            withdraw_payload = %{
              "type" => "withdrawn",
              "amount_cents" => amount_cents
            }
            from_version = from_state.version + 1
            [e1] = append_one(from_account_id, from_version, withdraw_payload, rec_at)

            deposit_payload = %{
              "type" => "deposited",
              "amount_cents" => amount_cents
            }
            to_version = to_state.version + 1
            [e2] = append_one(to_account_id, to_version, deposit_payload, rec_at)

            write_snapshots_for_account(from_account_id, from_version)
            write_snapshots_for_account(to_account_id, to_version)

            Projector.catch_up()

            {:ok, post_from_state} = Aggregate.current(from_account_id)

            {:ok, %CommandResult{
              command: :transfer,
              account_id: from_account_id,
              appended: [e1, e2],
              state: post_from_state
            }}
        end
    end
  end

  def freeze(account_id, reason, recorded_at) do
    {:ok, state} = Aggregate.current(account_id)

    cond do
      state.status == :absent ->
        invalid_arg(:account_id, "account does not exist")

      state.status != :open ->
        invalid_arg(:account_id, "account is not open")

      true ->
        rec_at = recorded_at || DateTime.utc_now()
        payload = %{
          "type" => "frozen",
          "reason" => reason
        }

        new_version = state.version + 1
        appended = append_one(account_id, new_version, payload, rec_at)
        write_snapshots_for_account(account_id, new_version)
        Projector.catch_up()

        {:ok, post_state} = Aggregate.current(account_id)
        {:ok, %CommandResult{
          command: :freeze,
          account_id: account_id,
          appended: appended,
          state: post_state
        }}
    end
  end

  def unfreeze(account_id, note, recorded_at) do
    {:ok, state} = Aggregate.current(account_id)

    cond do
      state.status == :absent ->
        invalid_arg(:account_id, "account does not exist")

      state.status != :frozen ->
        invalid_arg(:account_id, "account is not frozen")

      true ->
        rec_at = recorded_at || DateTime.utc_now()
        payload = %{
          "type" => "unfrozen",
          "note" => note
        }

        new_version = state.version + 1
        appended = append_one(account_id, new_version, payload, rec_at)
        write_snapshots_for_account(account_id, new_version)
        Projector.catch_up()

        {:ok, post_state} = Aggregate.current(account_id)
        {:ok, %CommandResult{
          command: :unfreeze,
          account_id: account_id,
          appended: appended,
          state: post_state
        }}
    end
  end

  defp invalid_arg(field, message) do
    {:error, Ash.Error.Action.InvalidArgument.exception(field: field, message: message)}
  end

  defp append_one(account_id, version, payload, recorded_at) do
    event = Event
    |> Ash.Changeset.for_create(:append, %{
      account_id: account_id,
      version: version,
      payload: payload,
      recorded_at: recorded_at
    })
    |> Ash.create!()

    [event]
  end

  defp write_snapshots_for_account(account_id, current_version) do
    versions_to_snapshot = Enum.filter(1..current_version, &(rem(&1, 5) == 0))

    for v <- versions_to_snapshot do
      existing = Snapshot
      |> Ash.Query.filter(account_id == ^account_id and version == ^v)
      |> Ash.read!()

      if existing == [] do
        events = Event
        |> Ash.Query.filter(account_id == ^account_id and version <= ^v)
        |> Ash.Query.sort(sequence: :asc)
        |> Ash.read!()

        initial = Fold.initial(account_id)
        {:ok, state_at_v} = Fold.replay(initial, events)

        event_at_v = Enum.find(events, &(&1.version == v))

        snapshot_params = %{
          account_id: account_id,
          version: v,
          sequence: event_at_v.sequence,
          state: Snapshots.dump(state_at_v),
          checksum: Snapshots.checksum(state_at_v)
        }

        Snapshot
        |> Ash.Changeset.for_create(:create, snapshot_params)
        |> Ash.create!()
      end
    end
  end
end
