defmodule Vault.Ledger.Commands do
  require Ash.Query
  alias Vault.Ledger.CommandResult
  alias Vault.Ledger.Aggregate
  alias Vault.Ledger.Event
  alias Vault.Ledger.Snapshot
  alias Vault.Ledger.Fold
  alias Vault.Ledger.Snapshots

  def open_account(account_id, owner, opening_balance_cents, recorded_at) do
    # 2. opening_balance_cents is negative
    if opening_balance_cents < 0 do
      {:error, invalid_argument_error(:opening_balance_cents, "opening balance must not be negative")}
    else
      # Get current state
      {:ok, state} = Aggregate.current(account_id)

      # 4. account already exists
      if state.version > 0 do
        {:error, invalid_argument_error(:account_id, "account already exists")}
      else
        recorded_at = recorded_at || DateTime.utc_now()

        payload = %{
          "type" => "account_opened",
          "owner" => owner,
          "opening_balance_cents" => opening_balance_cents
        }

        case append_one(account_id, 1, payload, recorded_at) do
          {:ok, event} ->
            maybe_write_snapshots(account_id, 0, 1)
            # Update read model
            {:ok, _} = Vault.Ledger.Projector.catch_up()
            # Get final state
            {:ok, final_state} = Aggregate.current(account_id)

            {:ok, %CommandResult{
              command: :open_account,
              account_id: account_id,
              appended: [event],
              state: final_state
            }}

          {:error, err} ->
            {:error, err}
        end
      end
    end
  end

  def deposit(account_id, amount_cents, recorded_at) do
    # 1. amount_cents is not positive
    if amount_cents <= 0 do
      {:error, invalid_argument_error(:amount_cents, "amount must be positive")}
    else
      # Get current state
      {:ok, state} = Aggregate.current(account_id)

      cond do
        # 5. account does not exist
        state.version == 0 ->
          {:error, invalid_argument_error(:account_id, "account does not exist")}

        # 6. account is frozen
        state.status == :frozen ->
          {:error, invalid_argument_error(:account_id, "account is frozen")}

        true ->
          recorded_at = recorded_at || DateTime.utc_now()

          payload = %{
            "type" => "deposited",
            "amount_cents" => amount_cents
          }

          next_version = state.version + 1

          case append_one(account_id, next_version, payload, recorded_at) do
            {:ok, event} ->
              maybe_write_snapshots(account_id, state.version, next_version)
              # Update read model
              {:ok, _} = Vault.Ledger.Projector.catch_up()
              # Get final state
              {:ok, final_state} = Aggregate.current(account_id)

              {:ok, %CommandResult{
                command: :deposit,
                account_id: account_id,
                appended: [event],
                state: final_state
              }}

            {:error, err} ->
              {:error, err}
          end
      end
    end
  end

  def withdraw(account_id, amount_cents, recorded_at) do
    # 1. amount_cents is not positive
    if amount_cents <= 0 do
      {:error, invalid_argument_error(:amount_cents, "amount must be positive")}
    else
      # Get current state
      {:ok, state} = Aggregate.current(account_id)

      cond do
        # 5. account does not exist
        state.version == 0 ->
          {:error, invalid_argument_error(:account_id, "account does not exist")}

        # 6. account is frozen
        state.status == :frozen ->
          {:error, invalid_argument_error(:account_id, "account is frozen")}

        # 9. withdrawal larger than the balance
        state.balance_cents < amount_cents ->
          {:error, invalid_argument_error(:amount_cents, "insufficient funds")}

        true ->
          recorded_at = recorded_at || DateTime.utc_now()

          payload = %{
            "type" => "withdrawn",
            "amount_cents" => amount_cents
          }

          next_version = state.version + 1

          case append_one(account_id, next_version, payload, recorded_at) do
            {:ok, event} ->
              maybe_write_snapshots(account_id, state.version, next_version)
              # Update read model
              {:ok, _} = Vault.Ledger.Projector.catch_up()
              # Get final state
              {:ok, final_state} = Aggregate.current(account_id)

              {:ok, %CommandResult{
                command: :withdraw,
                account_id: account_id,
                appended: [event],
                state: final_state
              }}

            {:error, err} ->
              {:error, err}
          end
      end
    end
  end

  def transfer(from_account_id, to_account_id, amount_cents, recorded_at) do
    # 1. amount_cents is not positive
    if amount_cents <= 0 do
      {:error, invalid_argument_error(:amount_cents, "amount must be positive")}
    else
      # 3. transfer source and destination are the same
      if from_account_id == to_account_id do
        {:error, invalid_argument_error(:to_account_id, "cannot transfer to the same account")}
      else
        # Get current states
        {:ok, from_state} = Aggregate.current(from_account_id)

        cond do
          # 5. from_account has no events
          from_state.version == 0 ->
            {:error, invalid_argument_error(:from_account_id, "account does not exist")}

          true ->
            {:ok, to_state} = Aggregate.current(to_account_id)

            cond do
              # 5. to_account has no events
              to_state.version == 0 ->
                {:error, invalid_argument_error(:to_account_id, "account does not exist")}

              # 6. from_account is frozen
              from_state.status == :frozen ->
                {:error, invalid_argument_error(:from_account_id, "account is frozen")}

              # 6. to_account is frozen
              to_state.status == :frozen ->
                {:error, invalid_argument_error(:to_account_id, "account is frozen")}

              # 9. transfer larger than balance
              from_state.balance_cents < amount_cents ->
                {:error, invalid_argument_error(:amount_cents, "insufficient funds")}

              true ->
                recorded_at = recorded_at || DateTime.utc_now()

                payload1 = %{
                  "type" => "withdrawn",
                  "amount_cents" => amount_cents
                }

                payload2 = %{
                  "type" => "deposited",
                  "amount_cents" => amount_cents
                }

                # We must append BOTH events in consecutive order.
                # Let's do it in a try/catch or simple sequential checks.
                from_next_version = from_state.version + 1
                to_next_version = to_state.version + 1

                case append_one(from_account_id, from_next_version, payload1, recorded_at) do
                  {:ok, event1} ->
                    case append_one(to_account_id, to_next_version, payload2, recorded_at) do
                      {:ok, event2} ->
                        # Write snapshots
                        maybe_write_snapshots(from_account_id, from_state.version, from_next_version)
                        maybe_write_snapshots(to_account_id, to_state.version, to_next_version)

                        # Update read model
                        {:ok, _} = Vault.Ledger.Projector.catch_up()

                        # Get final state of from_account (the primary account)
                        {:ok, final_from_state} = Aggregate.current(from_account_id)

                        {:ok, %CommandResult{
                          command: :transfer,
                          account_id: from_account_id,
                          appended: [event1, event2],
                          state: final_from_state
                        }}

                      {:error, err} ->
                        # Rollback event1? Since ETS doesn't have transactions, let's delete event1
                        Ash.destroy!(event1)
                        {:error, err}
                    end

                  {:error, err} ->
                    {:error, err}
                end
            end
        end
      end
    end
  end

  def freeze(account_id, reason, recorded_at) do
    # Get current state
    {:ok, state} = Aggregate.current(account_id)

    cond do
      # 5. account does not exist
      state.version == 0 ->
        {:error, invalid_argument_error(:account_id, "account does not exist")}

      # 7. account is not open
      state.status != :open ->
        {:error, invalid_argument_error(:account_id, "account is not open")}

      true ->
        recorded_at = recorded_at || DateTime.utc_now()

        payload = %{
          "type" => "frozen",
          "reason" => to_string(reason)
        }

        next_version = state.version + 1

        case append_one(account_id, next_version, payload, recorded_at) do
          {:ok, event} ->
            maybe_write_snapshots(account_id, state.version, next_version)
            # Update read model
            {:ok, _} = Vault.Ledger.Projector.catch_up()
            # Get final state
            {:ok, final_state} = Aggregate.current(account_id)

            {:ok, %CommandResult{
              command: :freeze,
              account_id: account_id,
              appended: [event],
              state: final_state
            }}

          {:error, err} ->
            {:error, err}
        end
    end
  end

  def unfreeze(account_id, note, recorded_at) do
    # Get current state
    {:ok, state} = Aggregate.current(account_id)

    cond do
      # 5. account does not exist
      state.version == 0 ->
        {:error, invalid_argument_error(:account_id, "account does not exist")}

      # 8. account is not frozen
      state.status != :frozen ->
        {:error, invalid_argument_error(:account_id, "account is not frozen")}

      true ->
        recorded_at = recorded_at || DateTime.utc_now()

        payload = %{
          "type" => "unfrozen",
          "note" => note
        }

        next_version = state.version + 1

        case append_one(account_id, next_version, payload, recorded_at) do
          {:ok, event} ->
            maybe_write_snapshots(account_id, state.version, next_version)
            # Update read model
            {:ok, _} = Vault.Ledger.Projector.catch_up()
            # Get final state
            {:ok, final_state} = Aggregate.current(account_id)

            {:ok, %CommandResult{
              command: :unfreeze,
              account_id: account_id,
              appended: [event],
              state: final_state
            }}

          {:error, err} ->
            {:error, err}
        end
    end
  end

  # --- Helpers ---

  defp invalid_argument_error(field, message) do
    arg_err = Ash.Error.Action.InvalidArgument.exception(
      field: field,
      message: message,
      value: nil
    )
    Ash.Error.Invalid.exception(errors: [arg_err])
  end

  defp append_one(account_id, version, payload, recorded_at) do
    changeset =
      Event
      |> Ash.Changeset.for_create(:append, %{
        account_id: account_id,
        version: version,
        payload: payload,
        recorded_at: recorded_at
      })

    Ash.create(changeset)
  end

  defp maybe_write_snapshots(account_id, previous_version, current_version) do
    versions_to_snapshot =
      if previous_version < current_version do
        Enum.filter((previous_version + 1)..current_version, &(rem(&1, Snapshots.interval()) == 0))
      else
        []
      end

    for v <- versions_to_snapshot do
      # Reconstruct state at version v
      query =
        Event
        |> Ash.Query.new()
        |> Ash.Query.filter(account_id == ^account_id and version <= ^v)
        |> Ash.Query.sort(version: :asc)

      events = Ash.read!(query)
      {:ok, state_at_v} = Fold.replay(Fold.initial(account_id), events)

      event_at_v = Enum.find(events, &(&1.version == v))
      sequence_at_v = event_at_v.sequence

      state_map = Snapshots.dump(state_at_v)
      checksum = Snapshots.checksum(state_at_v)

      Snapshot
      |> Ash.Changeset.for_create(:create, %{
        account_id: account_id,
        version: v,
        sequence: sequence_at_v,
        state: state_map,
        checksum: checksum
      })
      |> Ash.create!()
    end
  end
end
