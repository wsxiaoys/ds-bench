# test_ledger.exs

ExUnit.start()

defmodule EventSourcedLedgerTest do
  use ExUnit.Case, async: false

  alias Vault.Ledger
  alias Vault.Ledger.Event
  alias Vault.Ledger.Snapshot
  alias Vault.Ledger.Snapshots
  alias Vault.Ledger.AccountProjection
  alias Vault.Ledger.Checkpoint
  alias Vault.Ledger.Projector
  alias Vault.Ledger.Aggregate
  alias Vault.Ledger.Fold

  setup do
    # Clear all ETS data before each test by deleting and recreating the tables
    # Wait, Ash ETS data layer uses process-private tables if private? true.
    # Since we are running in the same process, we can just destroy all records.
    for res <- [Event, Snapshot, AccountProjection, Checkpoint] do
      res |> Ash.read!() |> Enum.each(&Ash.destroy!(&1))
    end
    :ok
  end

  test "1. Append-only event store basic checks" do
    # Can append a valid event
    payload = %{"type" => "account_opened", "owner" => "Alice", "opening_balance_cents" => 1000}
    {:ok, event} = Ledger.append_event(%{
      account_id: "acc_1",
      version: 1,
      payload: payload,
      recorded_at: DateTime.utc_now()
    })

    assert event.sequence == 1
    assert event.version == 1
    assert event.account_id == "acc_1"
    assert event.payload.type == :account_opened
    assert event.payload.value.owner == "Alice"
    assert event.payload.value.opening_balance_cents == 1000

    # Appending another event gets sequence 2 and version 2
    payload2 = %{"type" => "deposited", "amount_cents" => 500}
    {:ok, event2} = Ledger.append_event(%{
      account_id: "acc_1",
      version: 2,
      payload: payload2,
      recorded_at: DateTime.utc_now()
    })
    assert event2.sequence == 2
    assert event2.version == 2

    # Rejecting passing a sequence
    assert_raise Ash.Error.Invalid, ~r/No such input `sequence`/, fn ->
      Ledger.append_event!(%{
        account_id: "acc_1",
        version: 3,
        payload: payload2,
        sequence: 10,
        recorded_at: DateTime.utc_now()
      })
    end

    # Appending with version already present fails with InvalidChanges and "has already been taken"
    assert {:error, %Ash.Error.Invalid{errors: [err]}} = Ledger.append_event(%{
      account_id: "acc_1",
      version: 2,
      payload: payload2,
      recorded_at: DateTime.utc_now()
    })
    assert %Ash.Error.Changes.InvalidChanges{fields: [:account_id, :version], message: "has already been taken"} = err

    # Appending with version gap (less than 1 or more than one greater) fails with InvalidAttribute
    assert {:error, %Ash.Error.Invalid{errors: [err2]}} = Ledger.append_event(%{
      account_id: "acc_1",
      version: 4,
      payload: payload2,
      recorded_at: DateTime.utc_now()
    })
    assert %Ash.Error.Changes.InvalidAttribute{field: :version, message: "version must be exactly one greater than the current stream version", vars: [expected: 3]} = err2

    # A rejected append must leave the log completely untouched
    events = Ledger.list_events!() |> Enum.sort_by(& &1.sequence)
    assert Enum.count(events) == 2
    assert Enum.map(events, & &1.sequence) == [1, 2]
  end

  test "2. Typed payloads constraints" do
    # Invalid payloads rejected on the field
    assert {:error, %Ash.Error.Invalid{}} = Ledger.append_event(%{
      account_id: "acc_1",
      version: 3,
      payload: %{"type" => "unknown_type"},
      recorded_at: DateTime.utc_now()
    })

    # AccountOpened owner min_length 1
    assert {:error, %Ash.Error.Invalid{}} = Ledger.append_event(%{
      account_id: "acc_2",
      version: 1,
      payload: %{"type" => "account_opened", "owner" => "", "opening_balance_cents" => 100},
      recorded_at: DateTime.utc_now()
    })

    # Deposited amount_cents minimum 1
    assert {:error, %Ash.Error.Invalid{}} = Ledger.append_event(%{
      account_id: "acc_1",
      version: 3,
      payload: %{"type" => "deposited", "amount_cents" => 0},
      recorded_at: DateTime.utc_now()
    })

    # Frozen reason atom one of specified
    assert {:error, %Ash.Error.Invalid{}} = Ledger.append_event(%{
      account_id: "acc_1",
      version: 3,
      payload: %{"type" => "frozen", "reason" => "invalid_reason"},
      recorded_at: DateTime.utc_now()
    })

    # Unfrozen note max_length 120
    long_note = String.duplicate("a", 121)
    assert {:error, %Ash.Error.Invalid{}} = Ledger.append_event(%{
      account_id: "acc_1",
      version: 3,
      payload: %{"type" => "unfrozen", "note" => long_note},
      recorded_at: DateTime.utc_now()
    })
  end

  test "3. Fold rules" do
    # initial state
    state = Fold.initial("acc_1")
    assert state.account_id == "acc_1"
    assert state.status == :absent

    # replay out of order
    e1 = %Event{sequence: 2, account_id: "acc_1", version: 1, payload: %Ash.Union{type: :account_opened, value: %Vault.Ledger.Payloads.AccountOpened{type: "account_opened", owner: "Alice", opening_balance_cents: 100}}, recorded_at: DateTime.utc_now()}
    e2 = %Event{sequence: 1, account_id: "acc_1", version: 2, payload: %Ash.Union{type: :deposited, value: %Vault.Ledger.Payloads.Deposited{type: "deposited", amount_cents: 50}}, recorded_at: DateTime.utc_now()}
    assert {:error, {:out_of_order, 1}} = Fold.replay(state, [e1, e2])
  end

  test "4. Commands and validation precedence" do
    # 1. amount positive check
    assert {:error, %Ash.Error.Invalid{errors: [%Ash.Error.Action.InvalidArgument{field: :amount_cents, message: "amount must be positive"}]}} =
      Ledger.deposit("acc_1", -10)

    # 2. opening balance check
    assert {:error, %Ash.Error.Invalid{errors: [%Ash.Error.Action.InvalidArgument{field: :opening_balance_cents, message: "opening balance must not be negative"}]}} =
      Ledger.open_account("acc_1", "Alice", %{opening_balance_cents: -5})

    # 3. Transfer same account check
    assert {:error, %Ash.Error.Invalid{errors: [%Ash.Error.Action.InvalidArgument{field: :to_account_id, message: "cannot transfer to the same account"}]}} =
      Ledger.transfer("acc_1", "acc_1", 100)

    # 4. Open account that already has events
    {:ok, res} = Ledger.open_account("acc_1", "Alice", %{opening_balance_cents: 100})
    assert res.state.balance_cents == 100

    assert {:error, %Ash.Error.Invalid{errors: [%Ash.Error.Action.InvalidArgument{field: :account_id, message: "account already exists"}]}} =
      Ledger.open_account("acc_1", "Bob", %{opening_balance_cents: 200})

    # 5. Account does not exist check
    assert {:error, %Ash.Error.Invalid{errors: [%Ash.Error.Action.InvalidArgument{field: :account_id, message: "account does not exist"}]}} =
      Ledger.deposit("acc_2", 100)

    # 6. Account is frozen check
    {:ok, _} = Ledger.open_account("acc_3", "Bob")
    {:ok, _} = Ledger.freeze_account("acc_3", :fraud_review)
    assert {:error, %Ash.Error.Invalid{errors: [%Ash.Error.Action.InvalidArgument{field: :account_id, message: "account is frozen"}]}} =
      Ledger.deposit("acc_3", 100)

    # 7. Freeze on account that is not open
    assert {:error, %Ash.Error.Invalid{errors: [%Ash.Error.Action.InvalidArgument{field: :account_id, message: "account does not exist"}]}} =
      Ledger.freeze_account("acc_not_exist", :fraud_review)

    assert {:error, %Ash.Error.Invalid{errors: [%Ash.Error.Action.InvalidArgument{field: :account_id, message: "account is not open"}]}} =
      Ledger.freeze_account("acc_3", :fraud_review)

    # 8. Unfreeze on account that is not frozen
    assert {:error, %Ash.Error.Invalid{errors: [%Ash.Error.Action.InvalidArgument{field: :account_id, message: "account is not frozen"}]}} =
      Ledger.unfreeze_account("acc_1")

    # 9. Insufficient funds
    assert {:error, %Ash.Error.Invalid{errors: [%Ash.Error.Action.InvalidArgument{field: :amount_cents, message: "insufficient funds"}]}} =
      Ledger.withdraw("acc_1", 500)
  end

  test "5. Snapshots and Reconstruction" do
    # Open account and deposit until version 5
    {:ok, _} = Ledger.open_account("acc_snap", "Alice") # v1
    {:ok, _} = Ledger.deposit("acc_snap", 100) # v2
    {:ok, _} = Ledger.deposit("acc_snap", 100) # v3
    {:ok, _} = Ledger.deposit("acc_snap", 100) # v4
    {:ok, res} = Ledger.deposit("acc_snap", 100) # v5

    assert res.state.version == 5

    # Check that snapshot was created for version 5
    snapshots = Snapshot |> Ash.read!()
    assert Enum.count(snapshots) == 1
    [snap] = snapshots
    assert snap.account_id == "acc_snap"
    assert snap.version == 5

    # Verify snapshot
    assert :ok == Snapshots.verify(snap)

    # Reconstruct with aggregate.current using snapshot
    {:ok, state} = Aggregate.current("acc_snap")
    assert state.version == 5
    assert state.balance_cents == 400

    # Corrupt the snapshot and make sure Aggregate.current falls back to fold_all
    corrupt_state = Map.put(snap.state, "balance_cents", 999999)
    snap |> Ash.Changeset.for_update(:update, %{state: corrupt_state}) |> Ash.update!()

    # Verification should fail
    [snap2] = Snapshot |> Ash.read!()
    assert {:error, :checksum_mismatch} == Snapshots.verify(snap2)

    # current should fall back and still return correct state (400 cents, not 999999)
    {:ok, state2} = Aggregate.current("acc_snap")
    assert state2.balance_cents == 400
  end

  test "6. Read model checkpoint, catch_up, rebuild, state_at, audit" do
    {:ok, _} = Ledger.open_account("acc_proj", "Alice", %{opening_balance_cents: 1000})

    # Read model is updated automatically after successful command
    assert Projector.checkpoint() == 1
    [proj] = AccountProjection |> Ash.read!()
    assert proj.account_id == "acc_proj"
    assert proj.balance_cents == 1000

    # Let's append directly through Event.append (which should NOT update projection or write snapshots)
    payload = %{"type" => "deposited", "amount_cents" => 500}
    {:ok, _} = Ledger.append_event(%{
      account_id: "acc_proj",
      version: 2,
      payload: payload,
      recorded_at: DateTime.utc_now()
    })

    # Checkpoint and projection should still be at sequence 1
    assert Projector.checkpoint() == 1
    [proj] = AccountProjection |> Ash.read!()
    assert proj.balance_cents == 1000

    # Run catch_up
    {:ok, catchup_res} = Projector.catch_up()
    assert catchup_res.applied == 1
    assert catchup_res.checkpoint == 2

    # Checkpoint and projection should now be at sequence 2
    assert Projector.checkpoint() == 2
    [proj] = AccountProjection |> Ash.read!()
    assert proj.balance_cents == 1500

    # Let's test rebuild_all
    # Modify projection behind projector's back
    proj |> Ash.Changeset.for_update(:update, %{balance_cents: 0}) |> Ash.update!()

    # Rebuild should restore the correct value
    {:ok, rebuild_res} = Projector.rebuild_all()
    assert rebuild_res.rows == 1
    assert rebuild_res.checkpoint == 2

    [proj2] = AccountProjection |> Ash.read!()
    assert proj2.balance_cents == 1500

    # Test state_at
    {:ok, state_v0} = Projector.state_at("acc_proj", {:version, 0})
    assert state_v0.status == :absent

    {:ok, state_v1} = Projector.state_at("acc_proj", {:version, 1})
    assert state_v1.balance_cents == 1000

    {:ok, state_v2} = Projector.state_at("acc_proj", {:version, 2})
    assert state_v2.balance_cents == 1500

    # Test audit
    audits = Projector.audit("acc_proj")
    assert Enum.count(audits) == 2
    [a1, a2] = audits
    assert a1.type == :account_opened
    assert a1.balance_before == 0
    assert a1.balance_after == 1000
    assert a2.type == :deposited
    assert a2.balance_before == 1000
    assert a2.balance_after == 1500
  end

  test "7. Rebuild Hook run exactly once per invocation" do
    # Register a callback on :after_load
    Vault.Ledger.Hook.clear(:after_load)
    Vault.Ledger.Hook.set(:after_load, fn ->
      # Inside the callback, append an event
      payload = %{"type" => "deposited", "amount_cents" => 100}
      {:ok, _} = Ledger.append_event(%{
        account_id: "acc_proj",
        version: 3,
        payload: payload,
        recorded_at: DateTime.utc_now()
      })
    end)

    {:ok, _} = Ledger.open_account("acc_proj", "Alice", %{opening_balance_cents: 1000}) # seq 1
    {:ok, _} = Ledger.deposit("acc_proj", 500) # seq 2

    assert Vault.Ledger.Hook.count(:after_load) == 0

    # Run rebuild
    {:ok, rebuild_res} = Projector.rebuild_all()
    assert rebuild_res.checkpoint == 2 # Only folds seq 1 and 2

    # Hook should have been called exactly once
    assert Vault.Ledger.Hook.count(:after_load) == 1

    # The appended event at version 3 should have sequence 3 and is not folded during rebuild
    [proj] = AccountProjection |> Ash.read!()
    assert proj.balance_cents == 1500 # reconstructed up to version 2 (1500)

    # Next catch_up should process version 3
    {:ok, catchup_res} = Projector.catch_up()
    assert catchup_res.applied == 1
    assert catchup_res.checkpoint == 3

    [proj2] = AccountProjection |> Ash.read!()
    assert proj2.balance_cents == 1600 # now updated to 1600
  end
end
