defmodule Vault.Ledger.Fold do
  alias Vault.Ledger.AccountState

  @allowed_types [:account_opened, :deposited, :withdrawn, :frozen, :unfrozen]

  def initial(account_id) do
    %AccountState{account_id: account_id}
  end

  def apply_event(%AccountState{} = state, event) do
    # 1. account mismatch check
    cond do
      state.account_id != nil and event.account_id != state.account_id ->
        {:error, {:account_mismatch, state.account_id, event.account_id}}

      # 2. version gap check
      event.version != state.version + 1 ->
        {:error, {:version_gap, state.version + 1, event.version}}

      true ->
        # Extract member_atom
        member_atom = extract_member_atom(event.payload)

        # 3. unknown event type check
        if member_atom not in @allowed_types do
          {:error, {:unknown_event_type, member_atom}}
        else
          apply_business_rule(state, member_atom, event)
        end
    end
  end

  def replay(%AccountState{} = state, events) do
    case check_order(events) do
      :ok ->
        do_replay(state, events)
      {:error, reason} ->
        {:error, reason}
    end
  end

  defp check_order(events) do
    check_order_rec(events, nil, 0)
  end

  defp check_order_rec([], _prev_seq, _index), do: :ok
  defp check_order_rec([event | rest], nil, index) do
    check_order_rec(rest, event.sequence, index + 1)
  end
  defp check_order_rec([event | rest], prev_seq, index) do
    if event.sequence > prev_seq do
      check_order_rec(rest, event.sequence, index + 1)
    else
      {:error, {:out_of_order, index}}
    end
  end

  defp do_replay(%AccountState{} = state, []), do: {:ok, state}
  defp do_replay(%AccountState{} = state, [event | rest]) do
    case apply_event(state, event) do
      {:ok, next_state} -> do_replay(next_state, rest)
      {:error, reason} -> {:error, reason}
    end
  end

  defp extract_member_atom(payload) do
    case payload do
      %Ash.Union{type: type} -> type
      %{type: type} when is_atom(type) -> type
      %{"type" => type} when is_binary(type) ->
        try do
          String.to_existing_atom(type)
        rescue
          _ -> type
        end
      _ -> nil
    end
  end

  defp get_payload_field(payload, field_atom) do
    case payload do
      %Ash.Union{value: value} ->
        Map.get(value, field_atom)
      %{} = map ->
        Map.get(map, field_atom) || Map.get(map, Atom.to_string(field_atom))
      _ ->
        nil
    end
  end

  defp apply_business_rule(state, :account_opened, event) do
    if state.status != :absent do
      {:error, :already_open}
    else
      owner = get_payload_field(event.payload, :owner)
      opening_balance_cents = get_payload_field(event.payload, :opening_balance_cents) || 0

      next_state = %{state |
        owner: owner,
        balance_cents: opening_balance_cents,
        status: :open,
        version: event.version,
        last_event_type: :account_opened,
        last_recorded_at: event.recorded_at
      }
      {:ok, next_state}
    end
  end

  defp apply_business_rule(state, :deposited, event) do
    case state.status do
      :absent -> {:error, :account_absent}
      :frozen -> {:error, :account_frozen}
      :open ->
        amount_cents = get_payload_field(event.payload, :amount_cents)

        next_state = %{state |
          balance_cents: state.balance_cents + amount_cents,
          deposit_count: state.deposit_count + 1,
          status: :open,
          version: event.version,
          last_event_type: :deposited,
          last_recorded_at: event.recorded_at
        }
        {:ok, next_state}
    end
  end

  defp apply_business_rule(state, :withdrawn, event) do
    case state.status do
      :absent -> {:error, :account_absent}
      :frozen -> {:error, :account_frozen}
      :open ->
        amount_cents = get_payload_field(event.payload, :amount_cents)
        new_balance = state.balance_cents - amount_cents

        if new_balance < 0 do
          {:error, :insufficient_funds}
        else
          next_state = %{state |
            balance_cents: new_balance,
            withdrawal_count: state.withdrawal_count + 1,
            status: :open,
            version: event.version,
            last_event_type: :withdrawn,
            last_recorded_at: event.recorded_at
          }
          {:ok, next_state}
        end
    end
  end

  defp apply_business_rule(state, :frozen, event) do
    if state.status != :open do
      {:error, :not_open}
    else
      next_state = %{state |
        status: :frozen,
        version: event.version,
        last_event_type: :frozen,
        last_recorded_at: event.recorded_at
      }
      {:ok, next_state}
    end
  end

  defp apply_business_rule(state, :unfrozen, event) do
    if state.status != :frozen do
      {:error, :not_frozen}
    else
      next_state = %{state |
        status: :open,
        version: event.version,
        last_event_type: :unfrozen,
        last_recorded_at: event.recorded_at
      }
      {:ok, next_state}
    end
  end
end
