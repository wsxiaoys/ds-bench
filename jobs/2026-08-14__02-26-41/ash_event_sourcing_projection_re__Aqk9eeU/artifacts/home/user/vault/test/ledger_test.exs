defmodule Vault.LedgerTest do
  use ExUnit.Case, async: false

  alias Vault.Ledger
  alias Vault.Ledger.Event
  alias Vault.Ledger.Snapshot
  alias Vault.Ledger.AccountProjection
  alias Vault.Ledger.Checkpoint
  alias Vault.Ledger.AccountState
  alias Vault.Ledger.Fold
  alias Vault.Ledger.Snapshots
  alias Vault.Ledger.Aggregate
  alias Vault.Ledger.Projector
  alias Vault.Ledger.Hook

  setup do
    # Since we are using ETS private tables, each test runs in its own process,
    # so the ETS tables are automatically isolated and empty at the start of each test!
    :ok
  end

  describe "1. Append-only event store" do
    test "appends valid events and derives consecutive sequence numbers" do
      {:ok, e1} = Ledger.append_event(%{
        account_id: "acc_1",
        version: 1,
        payload: %{"type" => "account_opened", "owner" => "Alice", "opening_balance_cents" => 100},
        recorded_at: DateTime.utc_now()
      })

      assert e1.sequence == 1
      assert e1.version == 1

      {:ok, e2} = Ledger.append_event(%{
        account_id: "acc_1",
        version: 2,
        payload: %{"type" => "deposited", "amount_cents" => 50},
        recorded_at: DateTime.utc_now()
      })

      assert e2.sequence == 2
      assert e2.version == 2
    end

    test "rejects sequence in append input" do
      # Since sequence is not in accept, passing it must be rejected with NoSuchInput error
      assert {:error, %Ash.Error.Invalid{errors: [no_such_input]}} = Ledger.append_event(%{
        account_id: "acc_1",
        version: 1,
        sequence: 1,
        payload: %{"type" => "account_opened", "owner" => "Alice", "opening_balance_cents" => 100},
        recorded_at: DateTime.utc_now()
      })

      assert %Ash.Error.Invalid.NoSuchInput{} = no_such_input
    end

    test "fails on duplicate version for same account" do
      {:ok, _} = Ledger.append_event(%{
        account_id: "acc_1",
        version: 1,
        payload: %{"type" => "account_opened", "owner" => "Alice", "opening_balance_cents" => 100},
        recorded_at: DateTime.utc_now()
      })

      # Try to append version 1 again
      assert {:error, %Ash.Error.Invalid{errors: [invalid_changes]}} = Ledger.append_event(%{
        account_id: "acc_1",
        version: 1,
        payload: %{"type" => "deposited", "amount_cents" => 50},
        recorded_at: DateTime.utc_now()
      })

      assert %Ash.Error.Changes.InvalidChanges{fields: [:account_id, :version], message: "has already been taken"} = invalid_changes
    end

    test "fails when version is less than 1 or not contiguous" do
      # 1. Version is 0 (less than 1)
      assert {:error, %Ash.Error.Invalid{errors: [invalid_attr]}} = Ledger.append_event(%{
        account_id: "acc_1",
        version: 0,
        payload: %{"type" => "account_opened", "owner" => "Alice", "opening_balance_cents" => 100},
        recorded_at: DateTime.utc_now()
      })

      assert %Ash.Error.Changes.InvalidAttribute{field: :version, message: "version must be exactly one greater than the current stream version", vars: [expected: 1]} = invalid_attr

      # 2. Version is 2 (gap of 1)
      assert {:error, %Ash.Error.Invalid{errors: [invalid_attr2]}} = Ledger.append_event(%{
        account_id: "acc_1",
        version: 2,
        payload: %{"type" => "account_opened", "owner" => "Alice", "opening_balance_cents" => 100},
        recorded_at: DateTime.utc_now()
      })

      assert %Ash.Error.Changes.InvalidAttribute{field: :version, message: "version must be exactly one greater than the current stream version", vars: [expected: 1]} = invalid_attr2
    end

    test "rejection leaves event log untouched" do
      # Attempt invalid append
      _ = Ledger.append_event(%{
        account_id: "acc_1",
        version: 2,
        payload: %{"type" => "account_opened", "owner" => "Alice", "opening_balance_cents" => 100},
        recorded_at: DateTime.utc_now()
      })

      # Successful append should still get sequence 1
      {:ok, e} = Ledger.append_event(%{
        account_id: "acc_1",
        version: 1,
        payload: %{"type" => "account_opened", "owner" => "Alice", "opening_balance_cents" => 100},
        recorded_at: DateTime.utc_now()
      })

      assert e.sequence == 1
    end

    test "stored event is immutable" do
      {:ok, e} = Ledger.append_event(%{
        account_id: "acc_1",
        version: 1,
        payload: %{"type" => "account_opened", "owner" => "Alice", "opening_balance_cents" => 100},
        recorded_at: DateTime.utc_now()
      })

      assert_raise Ash.Error.Invalid, fn ->
        Ash.update!(e, %{account_id: "acc_2"}, authorize?: false)
      end

      assert_raise Ash.Error.Invalid, fn ->
        Ash.destroy!(e, authorize?: false)
      end
    end
  end

  describe "2. Typed payloads" do
    test "validates payload embedded resource constraints" do
      # 1. owner is empty string
      assert {:error, %Ash.Error.Invalid{}} = Ledger.append_event(%{
        account_id: "acc_1",
        version: 1,
        payload: %{"type" => "account_opened", "owner" => "", "opening_balance_cents" => 100},
        recorded_at: DateTime.utc_now()
      })

      # 2. opening_balance_cents is negative
      assert {:error, %Ash.Error.Invalid{}} = Ledger.append_event(%{
        account_id: "acc_1",
        version: 1,
        payload: %{"type" => "account_opened", "owner" => "Alice", "opening_balance_cents" => -1},
        recorded_at: DateTime.utc_now()
      })

      # 3. deposited amount < 1
      {:ok, _} = Ledger.append_event(%{
        account_id: "acc_1",
        version: 1,
        payload: %{"type" => "account_opened", "owner" => "Alice", "opening_balance_cents" => 100},
        recorded_at: DateTime.utc_now()
      })

      assert {:error, %Ash.Error.Invalid{}} = Ledger.append_event(%{
        account_id: "acc_1",
        version: 2,
        payload: %{"type" => "deposited", "amount_cents" => 0},
        recorded_at: DateTime.utc_now()
      })

      # 4. frozen reason is invalid
      assert {:error, %Ash.Error.Invalid{}} = Ledger.append_event(%{
        account_id: "acc_1",
        version: 2,
        payload: %{"type" => "frozen", "reason" => "invalid_reason"},
        recorded_at: DateTime.utc_now()
      })

      # 5. unfrozen note too long
      assert {:error, %Ash.Error.Invalid{}} = Ledger.append_event(%{
        account_id: "acc_1",
        version: 2,
        payload: %{"type" => "unfrozen", "note" => String.duplicate("a", 121)},
        recorded_at: DateTime.utc_now()
      })
    end

    test "rejects map with unknown type" do
      assert {:error, %Ash.Error.Invalid{}} = Ledger.append_event(%{
        account_id: "acc_1",
        version: 1,
        payload: %{"type" => "unknown_type", "owner" => "Alice"},
        recorded_at: DateTime.utc_now()
      })
    end
  end

  describe "3. Pure state fold" do
    test "apply_event transitions state correctly" do
      state = Fold.initial("acc_1")
      assert state.status == :absent

      # 1. account_opened
      e1 = %Event{
        account_id: "acc_1",
        version: 1,
        payload: %Ash.Union{type: :account_opened, value: %Vault.Ledger.Payloads.AccountOpened{owner: "Alice", opening_balance_cents: 100}},
        recorded_at: DateTime.utc_now()
      }
      {:ok, state} = Fold.apply_event(state, e1)
      assert state.owner == "Alice"
      assert state.balance_cents == 100
      assert state.status == :open
      assert state.version == 1

      # 2. deposited
      e2 = %Event{
        account_id: "acc_1",
        version: 2,
        payload: %Ash.Union{type: :deposited, value: %Vault.Ledger.Payloads.Deposited{amount_cents: 50}},
        recorded_at: DateTime.utc_now()
      }
      {:ok, state} = Fold.apply_event(state, e2)
      assert state.balance_cents == 150
      assert state.deposit_count == 1
      assert state.version == 2

      # 3. withdrawn
      e3 = %Event{
        account_id: "acc_1",
        version: 3,
        payload: %Ash.Union{type: :withdrawn, value: %Vault.Ledger.Payloads.Withdrawn{amount_cents: 30}},
        recorded_at: DateTime.utc_now()
      }
      {:ok, state} = Fold.apply_event(state, e3)
      assert state.balance_cents == 120
      assert state.withdrawal_count == 1
      assert state.version == 3

      # 4. frozen
      e4 = %Event{
        account_id: "acc_1",
        version: 4,
        payload: %Ash.Union{type: :frozen, value: %Vault.Ledger.Payloads.Frozen{reason: :chargeback}},
        recorded_at: DateTime.utc_now()
      }
      {:ok, state} = Fold.apply_event(state, e4)
      assert state.status == :frozen
      assert state.version == 4

      # 5. unfrozen
      e5 = %Event{
        account_id: "acc_1",
        version: 5,
        payload: %Ash.Union{type: :unfrozen, value: %Vault.Ledger.Payloads.Unfrozen{note: "cleared"}},
        recorded_at: DateTime.utc_now()
      }
      {:ok, state} = Fold.apply_event(state, e5)
      assert state.status == :open
      assert state.version == 5
    end

    test "apply_event rejects on mismatches with exact precedence" do
      state = %AccountState{account_id: "acc_1", version: 1, status: :open}

      # 1. account mismatch
      e_wrong_acc = %Event{account_id: "acc_2", version: 2, payload: %Ash.Union{type: :deposited, value: %{amount_cents: 10}}}
      assert {:error, {:account_mismatch, "acc_1", "acc_2"}} = Fold.apply_event(state, e_wrong_acc)

      # 2. version gap
      e_wrong_ver = %Event{account_id: "acc_1", version: 3, payload: %Ash.Union{type: :deposited, value: %{amount_cents: 10}}}
      assert {:error, {:version_gap, 2, 3}} = Fold.apply_event(state, e_wrong_ver)

      # 3. unknown event type
      e_wrong_type = %Event{account_id: "acc_1", version: 2, payload: %Ash.Union{type: :unknown, value: %{}}}
      assert {:error, {:unknown_event_type, :unknown}} = Fold.apply_event(state, e_wrong_type)
    end

    test "replay stops at first failure and rejects out of order input" do
      state = Fold.initial("acc_1")

      e1 = %Event{sequence: 1, account_id: "acc_1", version: 1, payload: %Ash.Union{type: :account_opened, value: %Vault.Ledger.Payloads.AccountOpened{owner: "Alice", opening_balance_cents: 100}}}
      e2 = %Event{sequence: 2, account_id: "acc_1", version: 2, payload: %Ash.Union{type: :deposited, value: %Vault.Ledger.Payloads.Deposited{amount_cents: 50}}}
      e3_out_of_order = %Event{sequence: 2, account_id: "acc_1", version: 3, payload: %Ash.Union{type: :deposited, value: %Vault.Ledger.Payloads.Deposited{amount_cents: 50}}}

      # Replay out of order list
      assert {:error, {:out_of_order, 2}} = Fold.replay(state, [e1, e2, e3_out_of_order])

      # Stop at first business rule failure
      e3_fail = %Event{sequence: 3, account_id: "acc_1", version: 3, payload: %Ash.Union{type: :withdrawn, value: %Vault.Ledger.Payloads.Withdrawn{amount_cents: 500}}}
      assert {:error, :insufficient_funds} = Fold.replay(state, [e1, e2, e3_fail])
    end
  end

  describe "4. Commands" do
    test "open_account creates account and updates read model" do
      {:ok, result} = Ledger.open_account("acc_1", "Alice", %{opening_balance_cents: 1000})

      assert result.command == :open_account
      assert result.account_id == "acc_1"
      assert length(result.appended) == 1
      assert result.state.owner == "Alice"
      assert result.state.balance_cents == 1000

      # Verify read model is updated
      projection = Ash.get!(AccountProjection, "acc_1", authorize?: false)
      assert projection.owner == "Alice"
      assert projection.balance_cents == 1000
      assert projection.last_event_sequence == 1

      # Verify checkpoint is updated
      checkpoint = Ash.get!(Checkpoint, "account_projection", authorize?: false)
      assert checkpoint.sequence == 1
    end

    test "transfer appends consecutive sequence events" do
      {:ok, _} = Ledger.open_account("acc_src", "Alice", %{opening_balance_cents: 1000})
      {:ok, _} = Ledger.open_account("acc_dst", "Bob", %{opening_balance_cents: 0})

      {:ok, result} = Ledger.transfer("acc_src", "acc_dst", 300)

      assert result.command == :transfer
      assert result.account_id == "acc_src"
      assert length(result.appended) == 2

      [e1, e2] = result.appended
      assert e1.account_id == "acc_src"
      assert e1.payload.type == :withdrawn
      assert e1.sequence == 3

      assert e2.account_id == "acc_dst"
      assert e2.payload.type == :deposited
      assert e2.sequence == 4

      # Check state of source after transfer
      assert result.state.balance_cents == 700

      # Verify read model of destination
      dst_projection = Ash.get!(AccountProjection, "acc_dst", authorize?: false)
      assert dst_projection.balance_cents == 300
      assert dst_projection.last_event_sequence == 4

      checkpoint = Ash.get!(Checkpoint, "account_projection", authorize?: false)
      assert checkpoint.sequence == 4
    end

    test "validates command invariants in exact order" do
      # 1. amount not positive
      assert {:error, %Ash.Error.Invalid{errors: [err]}} = Ledger.deposit("acc_1", 0)
      assert %Ash.Error.Action.InvalidArgument{field: :amount_cents, message: "amount must be positive"} = err

      # 2. opening balance negative
      assert {:error, %Ash.Error.Invalid{errors: [err]}} = Ledger.open_account("acc_1", "Alice", %{opening_balance_cents: -50})
      assert %Ash.Error.Action.InvalidArgument{field: :opening_balance_cents, message: "opening balance must not be negative"} = err

      # 3. transfer to same account
      assert {:error, %Ash.Error.Invalid{errors: [err]}} = Ledger.transfer("acc_1", "acc_1", 100)
      assert %Ash.Error.Action.InvalidArgument{field: :to_account_id, message: "cannot transfer to the same account"} = err

      # 4. open_account for existing account
      {:ok, _} = Ledger.open_account("acc_1", "Alice", %{opening_balance_cents: 100})
      assert {:error, %Ash.Error.Invalid{errors: [err]}} = Ledger.open_account("acc_1", "Alice", %{opening_balance_cents: 100})
      assert %Ash.Error.Action.InvalidArgument{field: :account_id, message: "account already exists"} = err

      # 5. account does not exist
      assert {:error, %Ash.Error.Invalid{errors: [err]}} = Ledger.deposit("acc_nonexistent", 100)
      assert %Ash.Error.Action.InvalidArgument{field: :account_id, message: "account does not exist"} = err

      # 6. account is frozen
      {:ok, _} = Ledger.freeze_account("acc_1", :fraud_review)
      assert {:error, %Ash.Error.Invalid{errors: [err]}} = Ledger.deposit("acc_1", 100)
      assert %Ash.Error.Action.InvalidArgument{field: :account_id, message: "account is frozen"} = err

      # 7. freeze on account not open
      assert {:error, %Ash.Error.Invalid{errors: [err]}} = Ledger.freeze_account("acc_nonexistent", :fraud_review)
      assert %Ash.Error.Action.InvalidArgument{field: :account_id, message: "account does not exist"} = err

      # 8. unfreeze on account not frozen
      {:ok, _} = Ledger.open_account("acc_unfrozen", "Bob")
      assert {:error, %Ash.Error.Invalid{errors: [err]}} = Ledger.unfreeze_account("acc_unfrozen")
      assert %Ash.Error.Action.InvalidArgument{field: :account_id, message: "account is not frozen"} = err

      # 9. insufficient funds
      assert {:error, %Ash.Error.Invalid{errors: [err]}} = Ledger.withdraw("acc_unfrozen", 500)
      assert %Ash.Error.Action.InvalidArgument{field: :amount_cents, message: "insufficient funds"} = err
    end
  end

  describe "5. Snapshots" do
    test "writes snapshots on multiples of 5" do
      {:ok, _} = Ledger.open_account("acc_1", "Alice", %{opening_balance_cents: 100})

      # Add up to 5 events
      {:ok, _} = Ledger.deposit("acc_1", 10) # v2
      {:ok, _} = Ledger.deposit("acc_1", 10) # v3
      {:ok, _} = Ledger.deposit("acc_1", 10) # v4

      # No snapshots should exist yet
      assert [] = Ash.read!(Snapshot, authorize?: false)

      {:ok, _} = Ledger.deposit("acc_1", 10) # v5

      # Snapshot at v5 should exist
      assert [snap] = Ash.read!(Snapshot, authorize?: false)
      assert snap.account_id == "acc_1"
      assert snap.version == 5

      # Verify verify/1 and latest/1
      assert {:ok, ^snap} = Snapshots.latest("acc_1")
      assert :ok = Snapshots.verify(snap)
    end

    test "ignores corrupted snapshots during verification" do
      {:ok, _} = Ledger.open_account("acc_1", "Alice", %{opening_balance_cents: 100})
      {:ok, _} = Ledger.deposit("acc_1", 10) # v2
      {:ok, _} = Ledger.deposit("acc_1", 10) # v3
      {:ok, _} = Ledger.deposit("acc_1", 10) # v4
      {:ok, _} = Ledger.deposit("acc_1", 10) # v5

      [snap] = Ash.read!(Snapshot, authorize?: false)

      # Corrupt the checksum
      corrupted_snap = %{snap | checksum: "wrong_checksum"}
      assert {:error, :checksum_mismatch} = Snapshots.verify(corrupted_snap)

      # Corrupt the version
      corrupted_version = %{snap | version: 4}
      assert {:error, :version_mismatch} = Snapshots.verify(corrupted_version)
    end
  end

  describe "6. Aggregate reconstruction" do
    test "current uses valid snapshot to fold only subsequent events" do
      {:ok, _} = Ledger.open_account("acc_1", "Alice", %{opening_balance_cents: 100})
      {:ok, _} = Ledger.deposit("acc_1", 10) # v2
      {:ok, _} = Ledger.deposit("acc_1", 10) # v3
      {:ok, _} = Ledger.deposit("acc_1", 10) # v4
      {:ok, _} = Ledger.deposit("acc_1", 10) # v5 (snapshot created)
      {:ok, _} = Ledger.deposit("acc_1", 10) # v6

      # Verify current/1 returns correct state
      {:ok, state} = Aggregate.current("acc_1")
      assert state.version == 6
      assert state.balance_cents == 150

      # Now corrupt the v5 snapshot
      [snap] = Ash.read!(Snapshot, authorize?: false)
      snap
      |> Ash.Changeset.for_update(:update, %{checksum: "corrupted"})
      |> Ash.update!(authorize?: false)

      # current/1 should still succeed by falling back to fold_all
      {:ok, state2} = Aggregate.current("acc_1")
      assert state2.version == 6
      assert state2.balance_cents == 150
    end
  end

  describe "7. Read model, checkpoint and rebuild" do
    test "catch_up consumes only new events and advances checkpoint" do
      # Set up events directly through append_event (which does not update projection)
      {:ok, e1} = Ledger.append_event(%{
        account_id: "acc_1",
        version: 1,
        payload: %{"type" => "account_opened", "owner" => "Alice", "opening_balance_cents" => 100},
        recorded_at: DateTime.utc_now()
      })

      assert Projector.checkpoint() == 0

      # Run catch_up
      assert {:ok, %{applied: 1, checkpoint: 1}} = Projector.catch_up()
      assert Projector.checkpoint() == 1

      # Verify projection row is created
      proj = Ash.get!(AccountProjection, "acc_1", authorize?: false)
      assert proj.balance_cents == 100

      # Running catch_up again does nothing
      assert {:ok, %{applied: 0, checkpoint: 1}} = Projector.catch_up()
    end

    test "rebuild_all discards and rebuilds projection from log alone" do
      {:ok, _} = Ledger.open_account("acc_1", "Alice", %{opening_balance_cents: 100})

      # Manually corrupt projection row
      proj = Ash.get!(AccountProjection, "acc_1", authorize?: false)
      proj
      |> Ash.Changeset.for_update(:update, %{balance_cents: 9999})
      |> Ash.update!(authorize?: false)

      # Rebuild
      assert {:ok, %{rows: 1, checkpoint: 1}} = Projector.rebuild_all()

      # Verify projection row is restored
      proj_restored = Ash.get!(AccountProjection, "acc_1", authorize?: false)
      assert proj_restored.balance_cents == 100
    end

    test "state_at retrieves state at version or timestamp" do
      dt1 = DateTime.utc_now()
      {:ok, _} = Ledger.open_account("acc_1", "Alice", %{opening_balance_cents: 100, recorded_at: dt1})

      Process.sleep(10)
      dt2 = DateTime.utc_now()
      {:ok, _} = Ledger.deposit("acc_1", 50, %{recorded_at: dt2})

      # state_at by version
      assert {:ok, %{version: 1, balance_cents: 100}} = Projector.state_at("acc_1", {:version, 1})
      assert {:ok, %{version: 2, balance_cents: 150}} = Projector.state_at("acc_1", {:version, 2})
      assert {:ok, %{version: 0, balance_cents: 0}} = Projector.state_at("acc_1", {:version, 0})

      # state_at by timestamp
      assert {:ok, %{version: 1, balance_cents: 100}} = Projector.state_at("acc_1", {:timestamp, dt1})
      assert {:ok, %{version: 2, balance_cents: 150}} = Projector.state_at("acc_1", {:timestamp, dt2})
    end

    test "audit returns per-event diff list" do
      {:ok, _} = Ledger.open_account("acc_1", "Alice", %{opening_balance_cents: 100})
      {:ok, _} = Ledger.deposit("acc_1", 50)

      assert [diff1, diff2] = Projector.audit("acc_1")

      assert diff1.version == 1
      assert diff1.type == :account_opened
      assert diff1.balance_before == 0
      assert diff1.balance_after == 100
      assert diff1.delta_cents == 100

      assert diff2.version == 2
      assert diff2.type == :deposited
      assert diff2.balance_before == 100
      assert diff2.balance_after == 150
      assert diff2.delta_cents == 50
    end
  end

  describe "8. Rebuild must be a real rebuild" do
    test "rebuild_all calls Hook.run exactly once" do
      {:ok, _} = Ledger.open_account("acc_1", "Alice", %{opening_balance_cents: 100})

      Hook.clear(:after_load)
      Hook.set(:after_load, fn ->
        # Append an event during the hook
        # This event should NOT be folded in the current rebuild, but in the next catch_up
        {:ok, _} = Ledger.append_event(%{
          account_id: "acc_1",
          version: 2,
          payload: %{"type" => "deposited", "amount_cents" => 50},
          recorded_at: DateTime.utc_now()
        })
      end)

      # Run rebuild
      assert {:ok, %{rows: 1, checkpoint: 1}} = Projector.rebuild_all()

      # Hook should have been called exactly once
      assert Hook.count(:after_load) == 1

      # The projection should NOT include the event appended in the hook yet (checkpoint remains 1)
      proj = Ash.get!(AccountProjection, "acc_1", authorize?: false)
      assert proj.balance_cents == 100
      assert proj.version == 1

      # Run catch_up to process the event appended during the hook
      assert {:ok, %{applied: 1, checkpoint: 2}} = Projector.catch_up()

      # Projection should now be updated to version 2
      proj_updated = Ash.get!(AccountProjection, "acc_1", authorize?: false)
      assert proj_updated.balance_cents == 150
      assert proj_updated.version == 2
    end
  end
end
