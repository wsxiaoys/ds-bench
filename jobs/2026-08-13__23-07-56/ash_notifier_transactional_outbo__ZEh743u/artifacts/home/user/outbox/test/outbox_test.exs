defmodule OutboxTest do
  use ExUnit.Case

  alias Outbox.Ledger.Account
  alias Outbox.Ledger.BulkOps
  alias Outbox.Eventing
  alias Outbox.Eventing.Dispatcher

  setup do
    # Warm up ETS tables to prevent race conditions in table creation
    _ = Ash.read(Outbox.Ledger.Account)
    _ = Ash.read(Outbox.Eventing.Event)

    # Reset the entire outbox subsystem before each test
    :ok = Dispatcher.reset()
    :ok
  end

  test "1. Outbox capture on successful create write" do
    # Open an account
    {:ok, account} = Ash.create(Account, %{owner_id: "owner_123", name: "Alice", balance: 100}, action: :open)

    # Verify that exactly one outbox entry is appended
    events = Eventing.list_events!()
    assert length(events) == 1

    [event] = events
    assert event.sequence == 1
    assert event.aggregate_sequence == 1
    assert event.topic == "ledger.account.open"
    assert event.resource == "Outbox.Ledger.Account"
    assert event.aggregate_type == "account"
    assert event.aggregate_id == account.id
    assert event.action == :open
    assert event.actor_id == nil

    # Verify changes map
    assert event.changes == %{
             "owner_id" => %{"from" => nil, "to" => "owner_123"},
             "name" => %{"from" => nil, "to" => "Alice"},
             "balance" => %{"from" => nil, "to" => 100},
             "status" => %{"from" => nil, "to" => "active"}
           }

    assert event.dedup_key == "account:#{account.id}:open:1"
  end

  test "2. Actor ID capture" do
    actor = %{id: "actor_abc"}
    {:ok, account} = Ash.create(Account, %{owner_id: "owner_123", name: "Alice", balance: 100}, action: :open, actor: actor)

    [event] = Eventing.list_events!()
    assert event.actor_id == "actor_abc"
    assert account.owner_id == "owner_123"
  end

  test "3. No capture on failure" do
    # Invalid open (missing owner_id)
    assert {:error, _} = Ash.create(Account, %{name: "Alice", balance: 100}, action: :open)

    # Verify no outbox entry is created
    assert Eventing.list_events!() == []
  end

  test "4. No capture when return_notifications?: true is passed" do
    # Open account and ask to return notifications instead of dispatching them
    {:ok, _account, notifications} =
      Ash.create(Account, %{owner_id: "owner_123", name: "Alice", balance: 100}, action: :open, return_notifications?: true)

    # Notifications are handed back
    assert length(notifications) == 1

    # No outbox entry is created
    assert Eventing.list_events!() == []
  end

  test "5. Capture on single update write (diffing)" do
    {:ok, account} = Ash.create(Account, %{owner_id: "owner_123", name: "Alice", balance: 100}, action: :open)

    # Rename account
    {:ok, _updated} = Ash.update(account, %{name: "Bob"}, action: :rename)

    events = Eventing.list_events!()
    assert length(events) == 2

    # Second event is the rename
    [_open_event, rename_event] = events
    assert rename_event.sequence == 2
    assert rename_event.aggregate_sequence == 2
    assert rename_event.topic == "ledger.account.rename"
    assert rename_event.action == :rename

    # Verify changes has only the name attribute as it changed
    assert rename_event.changes == %{
             "name" => %{"from" => "Alice", "to" => "Bob"}
           }
  end

  test "6. Capture on batch writes" do
    inputs = [
      %{owner_id: "owner_1", name: "Alice", balance: 100},
      %{owner_id: "owner_2", name: "Bob", balance: 200}
    ]

    {:ok, accounts} = BulkOps.open_many(inputs)
    assert length(accounts) == 2

    # Verify outbox entries
    events = Eventing.list_events!()
    assert length(events) == 2

    # Verify freeze many (batch update)
    {:ok, frozen_accounts} = BulkOps.freeze_many(accounts)
    assert length(frozen_accounts) == 2

    # Verify total outbox entries
    all_events = Eventing.list_events!()
    assert length(all_events) == 4

    # The last two are freeze events
    freeze_events = Enum.slice(all_events, 2..3)
    for event <- freeze_events do
      assert event.topic == "ledger.account.freeze"
      assert event.action == :freeze
      # Batch update only needs to have the "to" value correct
      assert event.changes == %{
               "status" => %{"from" => nil, "to" => "frozen"}
             }
    end
  end

  test "7. Capture on destroy write" do
    {:ok, account} = Ash.create(Account, %{owner_id: "owner_123", name: "Alice", balance: 100}, action: :open)

    # Close account
    :ok = Ash.destroy!(account, action: :close)

    events = Eventing.list_events!()
    assert length(events) == 2

    [_open_event, destroy_event] = events
    assert destroy_event.topic == "ledger.account.close"
    assert destroy_event.action == :close
    # Destroy changes must always be the empty map
    assert destroy_event.changes == %{}
  end

  test "8. Concurrent writes correctness" do
    # Perform concurrent writes to verify sequence counters
    tasks =
      for i <- 1..30 do
        Task.async(fn ->
          # Alternate between two account names to create some concurrency
          owner_id = "owner_#{rem(i, 2)}"
          Ash.create!(Account, %{owner_id: owner_id, name: "Account #{i}", balance: 10}, action: :open)
        end)
      end

    _records = Task.await_many(tasks)

    events = Eventing.list_events!()
    assert length(events) == 30

    # Global sequence must be strictly 1..30
    sequences = Enum.map(events, & &1.sequence)
    assert sequences == Enum.to_list(1..30)

    # For each aggregate, aggregate_sequence must be strictly increasing from 1
    events_by_agg = Enum.group_by(events, & &1.aggregate_id)
    for {_agg_id, agg_events} <- events_by_agg do
      agg_seqs = Enum.map(agg_events, & &1.aggregate_sequence)
      assert agg_seqs == Enum.to_list(1..length(agg_events))
    end
  end

  test "9. Local dispatcher: async delivery and flush" do
    parent = self()

    # Subscribe with async mode (default)
    :ok =
      Dispatcher.subscribe(:sub_async, "ledger.account.*", fn event ->
        send(parent, {:async_received, event})
        :ok
      end)

    # Perform a write
    {:ok, _account} = Ash.create(Account, %{owner_id: "owner_1", name: "Alice", balance: 10}, action: :open)

    # Async handler should NOT have run yet
    refute_received {:async_received, _}

    # Call flush to drain
    :ok = Dispatcher.flush()

    # Handler should have run now
    assert_received {:async_received, %Eventing.Event{sequence: 1}}

    # Flush again should not repeat delivery
    :ok = Dispatcher.flush()
    refute_received {:async_received, _}
  end

  test "10. Local dispatcher: sync delivery" do
    parent = self()

    # Subscribe with sync mode
    :ok =
      Dispatcher.subscribe(
        :sub_sync,
        "ledger.account.open",
        fn event ->
          send(parent, {:sync_received, event})
          :ok
        end,
        mode: :sync
      )

    # Perform write
    {:ok, _account} = Ash.create(Account, %{owner_id: "owner_1", name: "Alice", balance: 10}, action: :open)

    # Sync handler should have run IMMEDIATELY inside the write process
    assert_received {:sync_received, %Eventing.Event{sequence: 1}}

    # Flush should not repeat delivery
    :ok = Dispatcher.flush()
    refute_received {:sync_received, _}
  end

  test "11. Local dispatcher: sync failure and retry" do
    parent = self()
    # A sync subscriber that fails on the first attempt
    Agent.start_link(fn -> 0 end, name: :fail_counter)

    :ok =
      Dispatcher.subscribe(
        :sub_sync_fail,
        "ledger.account.open",
        fn event ->
          attempts = Agent.get_and_update(:fail_counter, fn val -> {val + 1, val + 1} end)

          if attempts == 1 do
            {:error, :temporary_failure}
          else
            send(parent, {:sync_retry_success, event})
            :ok
          end
        end,
        mode: :sync
      )

    # Perform write
    {:ok, _account} = Ash.create(Account, %{owner_id: "owner_1", name: "Alice", balance: 10}, action: :open)

    # Since it failed on the first attempt, it should not have succeeded
    refute_received {:sync_retry_success, _}

    # Now flush (2nd attempt)
    :ok = Dispatcher.flush()

    # It should succeed on retry!
    assert_received {:sync_retry_success, %Eventing.Event{sequence: 1}}
  end

  test "12. Local dispatcher: bounded retries and dead letters" do
    # Async subscriber that always fails
    :ok =
      Dispatcher.subscribe(:sub_always_fail, "ledger.account.open", fn _event ->
        {:error, :permanent_failure}
      end)

    # Perform write
    {:ok, _account} = Ash.create(Account, %{owner_id: "owner_1", name: "Alice", balance: 10}, action: :open)

    # Flush 1
    :ok = Dispatcher.flush()
    assert Dispatcher.dead_letters() == []

    # Flush 2
    :ok = Dispatcher.flush()
    assert Dispatcher.dead_letters() == []

    # Flush 3 (fails on 3rd attempt, moves to dead letters)
    :ok = Dispatcher.flush()

    # Verify dead letters
    [dl] = Dispatcher.dead_letters()
    assert dl.subscriber_id == :sub_always_fail
    assert dl.sequence == 1
    assert dl.attempts == 3
    assert dl.reason == :permanent_failure

    # Flush 4 should not retry
    :ok = Dispatcher.flush()
    assert length(Dispatcher.dead_letters()) == 1
  end

  test "13. Local dispatcher: handler raises are contained" do
    # Async subscriber that raises
    :ok =
      Dispatcher.subscribe(:sub_raises, "ledger.account.open", fn _event ->
        raise "kaboom!"
      end)

    # Perform write
    {:ok, _account} = Ash.create(Account, %{owner_id: "owner_1", name: "Alice", balance: 10}, action: :open)

    # Flush 1 (fails, doesn't crash dispatcher)
    :ok = Dispatcher.flush()
    # Flush 2 (fails)
    :ok = Dispatcher.flush()
    # Flush 3 (fails, dead-letters)
    :ok = Dispatcher.flush()

    [dl] = Dispatcher.dead_letters()
    assert dl.subscriber_id == :sub_raises
    assert dl.sequence == 1
    assert dl.attempts == 3
    assert dl.reason == {:raised, "kaboom!"}
  end

  test "14. Unsubscribe discards pending deliveries" do
    parent = self()

    :ok =
      Dispatcher.subscribe(:sub_unsub, "ledger.account.open", fn event ->
        send(parent, {:received, event})
        :ok
      end)

    # Perform write
    {:ok, _account} = Ash.create(Account, %{owner_id: "owner_1", name: "Alice", balance: 10}, action: :open)

    # Unsubscribe
    :ok = Dispatcher.unsubscribe(:sub_unsub)

    # Flush
    :ok = Dispatcher.flush()

    # Should not receive anything
    refute_received {:received, _}
  end

  test "15. Replay" do
    parent = self()

    # Open account 1
    {:ok, _account1} = Ash.create(Account, %{owner_id: "owner_1", name: "Alice", balance: 10}, action: :open)
    # Open account 2
    {:ok, _account2} = Ash.create(Account, %{owner_id: "owner_2", name: "Bob", balance: 20}, action: :open)

    # Subscribe after these events were created
    :ok =
      Dispatcher.subscribe(:sub_replay, "ledger.account.open", fn event ->
        send(parent, {:replay_received, event.sequence})
        :ok
      end)

    # Normal flush should deliver nothing because subscriber subscribed AFTER events were created
    :ok = Dispatcher.flush()
    refute_received {:replay_received, _}

    # Now trigger replay for events after sequence 0
    {:ok, delivered} = Eventing.replay(0, :sub_replay)
    assert delivered == [1, 2]

    # Handler should have run synchronously in caller process
    assert_received {:replay_received, 1}
    assert_received {:replay_received, 2}
  end

  test "16. Reset" do
    # Subscribe and write
    :ok = Dispatcher.subscribe(:sub_reset, "ledger.account.open", fn _event -> :ok end)
    {:ok, _account} = Ash.create(Account, %{owner_id: "owner_1", name: "Alice", balance: 10}, action: :open)

    assert length(Eventing.list_events!()) == 1

    # Reset
    :ok = Dispatcher.reset()

    # Verify pristine state
    assert Eventing.list_events!() == []
    assert Dispatcher.dead_letters() == []

    # Write again, sequence must rewind to 1
    {:ok, _account2} = Ash.create(Account, %{owner_id: "owner_2", name: "Bob", balance: 20}, action: :open)
    [event] = Eventing.list_events!()
    assert event.sequence == 1
    assert event.aggregate_sequence == 1
  end
end
