defmodule Vault.Ledger.Commands do
  alias Vault.Ledger.CommandResult
  alias Vault.Ledger.Aggregate
  alias Vault.Ledger.Fold
  alias Vault.Ledger.Event
  alias Vault.Ledger.Snapshots
  require Ash.Query

  def open_account(account_id, owner, opening_balance_cents, recorded_at) do
    recorded_at = recorded_at || DateTime.utc_now()

    if opening_balance_cents < 0 do
      {:error, invalid_arg_error(:opening_balance_cents, "opening balance must not be negative", opening_balance_cents)}
    else
      {:ok, state} = Aggregate.current(account_id)
      if state.version > 0 do
        {:error, invalid_arg_error(:account_id, "account already exists", account_id)}
      else
        payload = %{"type" => "account_opened", "owner" => owner, "opening_balance_cents" => opening_balance_cents}
        case append_event(account_id, 1, payload, recorded_at) do
          {:ok, event} ->
            {:ok, next_state} = Fold.apply_event(state, event)

            write_snapshots_if_needed!(account_id, next_state.version)
            update_projection!(next_state, event.sequence)
            update_checkpoint!(event.sequence)

            {:ok, %CommandResult{
              command: :open_account,
              account_id: account_id,
              appended: [event],
              state: next_state
            }}

          {:error, error} ->
            {:error, error}
        end
      end
    end
  end

  def deposit(account_id, amount_cents, recorded_at) do
    recorded_at = recorded_at || DateTime.utc_now()

    cond do
      amount_cents <= 0 ->
        {:error, invalid_arg_error(:amount_cents, "amount must be positive", amount_cents)}

      true ->
        {:ok, state} = Aggregate.current(account_id)
        cond do
          state.status == :absent ->
            {:error, invalid_arg_error(:account_id, "account does not exist", account_id)}

          state.status == :frozen ->
            {:error, invalid_arg_error(:account_id, "account is frozen", account_id)}

          true ->
            payload = %{"type" => "deposited", "amount_cents" => amount_cents}
            case append_event(account_id, state.version + 1, payload, recorded_at) do
              {:ok, event} ->
                {:ok, next_state} = Fold.apply_event(state, event)

                write_snapshots_if_needed!(account_id, next_state.version)
                update_projection!(next_state, event.sequence)
                update_checkpoint!(event.sequence)

                {:ok, %CommandResult{
                  command: :deposit,
                  account_id: account_id,
                  appended: [event],
                  state: next_state
                }}

              {:error, error} ->
                {:error, error}
            end
        end
    end
  end

  def withdraw(account_id, amount_cents, recorded_at) do
    recorded_at = recorded_at || DateTime.utc_now()

    cond do
      amount_cents <= 0 ->
        {:error, invalid_arg_error(:amount_cents, "amount must be positive", amount_cents)}

      true ->
        {:ok, state} = Aggregate.current(account_id)
        cond do
          state.status == :absent ->
            {:error, invalid_arg_error(:account_id, "account does not exist", account_id)}

          state.status == :frozen ->
            {:error, invalid_arg_error(:account_id, "account is frozen", account_id)}

          amount_cents > state.balance_cents ->
            {:error, invalid_arg_error(:amount_cents, "insufficient funds", amount_cents)}

          true ->
            payload = %{"type" => "withdrawn", "amount_cents" => amount_cents}
            case append_event(account_id, state.version + 1, payload, recorded_at) do
              {:ok, event} ->
                {:ok, next_state} = Fold.apply_event(state, event)

                write_snapshots_if_needed!(account_id, next_state.version)
                update_projection!(next_state, event.sequence)
                update_checkpoint!(event.sequence)

                {:ok, %CommandResult{
                  command: :withdraw,
                  account_id: account_id,
                  appended: [event],
                  state: next_state
                }}

              {:error, error} ->
                {:error, error}
            end
        end
    end
  end

  def transfer(from_account_id, to_account_id, amount_cents, recorded_at) do
    recorded_at = recorded_at || DateTime.utc_now()

    cond do
      amount_cents <= 0 ->
        {:error, invalid_arg_error(:amount_cents, "amount must be positive", amount_cents)}

      from_account_id == to_account_id ->
        {:error, invalid_arg_error(:to_account_id, "cannot transfer to the same account", to_account_id)}

      true ->
        {:ok, from_state} = Aggregate.current(from_account_id)
        cond do
          from_state.status == :absent ->
            {:error, invalid_arg_error(:from_account_id, "account does not exist", from_account_id)}

          true ->
            {:ok, to_state} = Aggregate.current(to_account_id)
            cond do
              to_state.status == :absent ->
                {:error, invalid_arg_error(:to_account_id, "account does not exist", to_account_id)}

              from_state.status == :frozen ->
                {:error, invalid_arg_error(:from_account_id, "account is frozen", from_account_id)}

              to_state.status == :frozen ->
                {:error, invalid_arg_error(:to_account_id, "account is frozen", to_account_id)}

              amount_cents > from_state.balance_cents ->
                {:error, invalid_arg_error(:amount_cents, "insufficient funds", amount_cents)}

              true ->
                from_payload = %{"type" => "withdrawn", "amount_cents" => amount_cents}
                case append_event(from_account_id, from_state.version + 1, from_payload, recorded_at) do
                  {:ok, from_event} ->
                    to_payload = %{"type" => "deposited", "amount_cents" => amount_cents}
                    case append_event(to_account_id, to_state.version + 1, to_payload, recorded_at) do
                      {:ok, to_event} ->
                        {:ok, next_from_state} = Fold.apply_event(from_state, from_event)
                        {:ok, next_to_state} = Fold.apply_event(to_state, to_event)

                        write_snapshots_if_needed!(from_account_id, next_from_state.version)
                        write_snapshots_if_needed!(to_account_id, next_to_state.version)

                        update_projection!(next_from_state, to_event.sequence)
                        update_projection!(next_to_state, to_event.sequence)
                        update_checkpoint!(to_event.sequence)

                        {:ok, %CommandResult{
                          command: :transfer,
                          account_id: from_account_id,
                          appended: [from_event, to_event],
                          state: next_from_state
                        }}

                      {:error, error} ->
                        {:error, error}
                    end

                  {:error, error} ->
                    {:error, error}
                end
            end
        end
    end
  end

  def freeze(account_id, reason, recorded_at) do
    recorded_at = recorded_at || DateTime.utc_now()

    {:ok, state} = Aggregate.current(account_id)
    cond do
      state.status == :absent ->
        {:error, invalid_arg_error(:account_id, "account does not exist", account_id)}

      state.status != :open ->
        {:error, invalid_arg_error(:account_id, "account is not open", account_id)}

      true ->
        payload = %{"type" => "frozen", "reason" => reason}
        case append_event(account_id, state.version + 1, payload, recorded_at) do
          {:ok, event} ->
            {:ok, next_state} = Fold.apply_event(state, event)

            write_snapshots_if_needed!(account_id, next_state.version)
            update_projection!(next_state, event.sequence)
            update_checkpoint!(event.sequence)

            {:ok, %CommandResult{
              command: :freeze,
              account_id: account_id,
              appended: [event],
              state: next_state
            }}

          {:error, error} ->
            {:error, error}
        end
    end
  end

  def unfreeze(account_id, note, recorded_at) do
    recorded_at = recorded_at || DateTime.utc_now()

    {:ok, state} = Aggregate.current(account_id)
    cond do
      state.status == :absent ->
        {:error, invalid_arg_error(:account_id, "account does not exist", account_id)}

      state.status != :frozen ->
        {:error, invalid_arg_error(:account_id, "account is not frozen", account_id)}

      true ->
        payload = %{"type" => "unfrozen", "note" => note}
        case append_event(account_id, state.version + 1, payload, recorded_at) do
          {:ok, event} ->
            {:ok, next_state} = Fold.apply_event(state, event)

            write_snapshots_if_needed!(account_id, next_state.version)
            update_projection!(next_state, event.sequence)
            update_checkpoint!(event.sequence)

            {:ok, %CommandResult{
              command: :unfreeze,
              account_id: account_id,
              appended: [event],
              state: next_state
            }}

          {:error, error} ->
            {:error, error}
        end
    end
  end

  defp invalid_arg_error(field, message, value) do
    Ash.Error.Action.InvalidArgument.exception(
      field: field,
      message: message,
      value: value
    )
    |> Ash.Error.to_error_class()
  end

  defp append_event(account_id, version, payload, recorded_at) do
    Event
    |> Ash.Changeset.for_create(:append, %{
      account_id: account_id,
      version: version,
      payload: payload,
      recorded_at: recorded_at
    })
    |> Ash.create(authorize?: false)
  end

  defp write_snapshots_if_needed!(account_id, current_version) do
    multiples = Enum.filter(1..current_version, &(rem(&1, 5) == 0))

    for v_snap <- multiples do
      exists? =
        Vault.Ledger.Snapshot
        |> Ash.Query.filter(account_id == ^account_id and version == ^v_snap)
        |> Ash.read!(authorize?: false)
        |> Enum.any?()

      if not exists? do
        state = state_at_version(account_id, v_snap)
        event_seq =
          Event
          |> Ash.Query.filter(account_id == ^account_id and version == ^v_snap)
          |> Ash.read_one!(authorize?: false)
          |> Map.get(:sequence)

        state_map = Snapshots.dump(state)
        checksum = Snapshots.checksum(state)

        Vault.Ledger.Snapshot
        |> Ash.Changeset.for_create(:create, %{
          account_id: account_id,
          version: v_snap,
          sequence: event_seq,
          state: state_map,
          checksum: checksum
        })
        |> Ash.create!(authorize?: false)
      end
    end
  end

  defp state_at_version(account_id, v_snap) do
    state = Fold.initial(account_id)
    events =
      Event
      |> Ash.Query.filter(account_id == ^account_id and version <= ^v_snap)
      |> Ash.Query.sort(version: :asc)
      |> Ash.read!(authorize?: false)

    {:ok, state} = Fold.replay(state, events)
    state
  end

  defp update_projection!(state, last_event_sequence) do
    projection =
      Vault.Ledger.AccountProjection
      |> Ash.get(state.account_id, authorize?: false)

    attrs = %{
      owner: state.owner,
      balance_cents: state.balance_cents,
      status: state.status,
      version: state.version,
      deposit_count: state.deposit_count,
      withdrawal_count: state.withdrawal_count,
      last_event_sequence: last_event_sequence,
      last_recorded_at: state.last_recorded_at
    }

    case projection do
      {:ok, row} ->
        row
        |> Ash.Changeset.for_update(:update, attrs)
        |> Ash.update!(authorize?: false)

      {:error, _} ->
        Vault.Ledger.AccountProjection
        |> Ash.Changeset.for_create(:create, Map.put(attrs, :account_id, state.account_id))
        |> Ash.create!(authorize?: false)
    end
  end

  defp update_checkpoint!(sequence) do
    checkpoint =
      Vault.Ledger.Checkpoint
      |> Ash.get("account_projection", authorize?: false)

    case checkpoint do
      {:ok, row} ->
        row
        |> Ash.Changeset.for_update(:update, %{sequence: sequence})
        |> Ash.update!(authorize?: false)

      {:error, _} ->
        Vault.Ledger.Checkpoint
        |> Ash.Changeset.for_create(:create, %{name: "account_projection", sequence: sequence})
        |> Ash.create!(authorize?: false)
    end
  end
end
