defmodule OutboxTest do
  use ExUnit.Case, async: false

  alias Outbox.Ledger.Account
  alias Outbox.Ledger.BulkOps
  alias Outbox.Eventing.Event
  alias Outbox.Eventing.Dispatcher

  setup do
    # Reset the subsystem before each test
    Dispatcher.reset()
    :ok
  end

  test "outbox capture on successful create, update, and destroy" do
    # 1. Successful Create
    {:ok, account} =
      Ash.Changeset.for_create(Account, :open, %{owner_id: "user_1", name: "Main Account", balance: 100})
      |> Ash.create()

    # Verify event was captured
    events = Outbox.Eventing.list_events!()
    assert length(events) == 1
    [event] = events

    assert event.sequence == 1
    assert event.aggregate_sequence == 1
    assert event.topic == "ledger.account.open"
    assert event.resource == "Outbox.Ledger.Account"
    assert event.aggregate_type == "account"
    assert event.aggregate_id == to_string(account.id)
    assert event.action == :open
    assert event.actor_id == nil
    assert event.changes == %{
             "owner_id" => %{"from" => nil, "to" => "user_1"},
             "name" => %{"from" => nil, "to" => "Main Account"},
             "balance" => %{"from" => nil, "to" => 100},
             "status" => %{"from" => nil, "to" => "active"}
           }

    # 2. Successful Update (Deposit)
    {:ok, updated_account} =
      Ash.Changeset.for_update(account, :deposit, %{amount: 50})
      |> Ash.update()

    events = Outbox.Eventing.list_events!()
    assert length(events) == 2
    [_, event2] = events

    assert event2.sequence == 2
    assert event2.aggregate_sequence == 2
    assert event2.topic == "ledger.account.deposit"
    assert event2.aggregate_id == to_string(account.id)
    assert event2.action == :deposit
    assert event2.changes == %{
             "balance" => %{"from" => 100, "to" => 150}
           }

    # 3. Successful Destroy (Close)
    :ok =
      Ash.Changeset.for_destroy(updated_account, :close)
      |> Ash.destroy()

    events = Outbox.Eventing.list_events!()
    assert length(events) == 3
    [_, _, event3] = events

    assert event3.sequence == 3
    assert event3.aggregate_sequence == 3
    assert event3.topic == "ledger.account.close"
    assert event3.aggregate_id == to_string(account.id)
    assert event3.action == :close
    assert event3.changes == %{}
  end

  test "failing writes leave no outbox entry" do
    # Try to open an account with invalid data (owner_id is missing/nil)
    assert {:error, _} =
             Ash.Changeset.for_create(Account, :open, %{name: "Invalid"})
             |> Ash.create()

    events = Outbox.Eventing.list_events!()
    assert length(events) == 0
  end

  test "reads never produce outbox entries" do
    {:ok, _account} =
      Ash.Changeset.for_create(Account, :open, %{owner_id: "user_1", name: "Main", balance: 100})
      |> Ash.create()

    # Read the account
    _ = Ash.read!(Account)

    events = Outbox.Eventing.list_events!()
    assert length(events) == 1
  end

  test "return_notifications?: true produces no outbox entry" do
    # Call with return_notifications?: true
    {:ok, _account, _notifications} =
      Ash.Changeset.for_create(Account, :open, %{owner_id: "user_1", name: "Main", balance: 100})
      |> Ash.create(return_notifications?: true)

    # Verify no outbox entry was produced for this write
    events = Outbox.Eventing.list_events!()
    assert length(events) == 0
  end

  test "batch writes produce exactly one entry per successfully written record" do
    inputs = [
      %{owner_id: "u1", name: "Acc 1", balance: 10},
      %{owner_id: "u2", name: "Acc 2", balance: 20}
    ]

    {:ok, accounts} = BulkOps.open_many(inputs)
    assert length(accounts) == 2

    events = Outbox.Eventing.list_events!()
    assert length(events) == 2

    [e1, e2] = events
    assert e1.sequence == 1
    assert e1.aggregate_sequence == 1
    assert e1.topic == "ledger.account.open"

    assert e2.sequence == 2
    assert e2.aggregate_sequence == 1
    assert e2.topic == "ledger.account.open"

    # Now freeze them using bulk update
    {:ok, frozen_accounts} = BulkOps.freeze_many(accounts)
    assert length(frozen_accounts) == 2

    events = Outbox.Eventing.list_events!()
    assert length(events) == 4

    [_, _, e3, e4] = events
    assert e3.sequence == 3
    assert e3.aggregate_sequence == 2
    assert e3.topic == "ledger.account.freeze"
    # Verify the "to" value is correct for batch update
    assert e3.changes["status"] == %{"from" => nil, "to" => "frozen"}

    assert e4.sequence == 4
    assert e4.aggregate_sequence == 2
    assert e4.topic == "ledger.account.freeze"
    assert e4.changes["status"] == %{"from" => nil, "to" => "frozen"}
  end

  test "dispatcher subscribe, unsubscribe, and pattern matching" do
    # Subscribe with literal pattern
    assert :ok == Dispatcher.subscribe(:sub1, "ledger.account.open", fn _ -> :ok end)
    # Already subscribed error
    assert {:error, :already_subscribed} == Dispatcher.subscribe(:sub1, "ledger.account.open", fn _ -> :ok end)

    # Subscribe with wildcards
    assert :ok == Dispatcher.subscribe(:sub2, "ledger.*.deposit", fn _ -> :ok end)
    assert :ok == Dispatcher.subscribe(:sub3, "ledger.account.#", fn _ -> :ok end)

    # Unsubscribe
    assert :ok == Dispatcher.unsubscribe(:sub1)
  end

  test "dispatcher delivery modes: :sync and :async" do
    parent = self()

    # Sync subscriber
    :ok =
      Dispatcher.subscribe(
        :sync_sub,
        "ledger.account.open",
        fn event ->
          send(parent, {:sync_delivered, event.sequence, self()})
          :ok
        end,
        mode: :sync
      )

    # Async subscriber
    :ok =
      Dispatcher.subscribe(
        :async_sub,
        "ledger.account.open",
        fn event ->
          send(parent, {:async_delivered, event.sequence, self()})
          :ok
        end,
        mode: :async
      )

    # Write record
    {:ok, _account} =
      Ash.Changeset.for_create(Account, :open, %{owner_id: "user_1", name: "Main", balance: 100})
      |> Ash.create()

    # Sync handler should have run immediately in the writer process (self())
    assert_received {:sync_delivered, 1, writer_pid}
    assert writer_pid == self()

    # Async handler should NOT have run yet
    refute_received {:async_delivered, 1, _}

    # Trigger flush (drain pass)
    :ok = Dispatcher.flush()

    # Async handler should run in the dispatcher process (not self())
    assert_received {:async_delivered, 1, dispatcher_pid}
    assert dispatcher_pid != self()
  end

  test "dispatcher bounded retries and dead-letter path" do
    parent = self()

    # A subscriber that always fails
    :ok =
      Dispatcher.subscribe(
        :failing_sub,
        "ledger.account.open",
        fn event ->
          send(parent, {:attempt, event.sequence})
          {:error, :database_offline}
        end,
        mode: :async
      )

    # Write record
    {:ok, _account} =
      Ash.Changeset.for_create(Account, :open, %{owner_id: "user_1", name: "Main", balance: 100})
      |> Ash.create()

    # First flush (Attempt 1)
    :ok = Dispatcher.flush()
    assert_received {:attempt, 1}

    # Verify not dead lettered yet
    assert Dispatcher.dead_letters() == []

    # Second flush (Attempt 2)
    :ok = Dispatcher.flush()
    assert_received {:attempt, 1}
    assert Dispatcher.dead_letters() == []

    # Third flush (Attempt 3)
    :ok = Dispatcher.flush()
    assert_received {:attempt, 1}

    # Should be dead-lettered after the third failed attempt
    dead = Dispatcher.dead_letters()
    assert length(dead) == 1
    [dl] = dead
    assert dl.subscriber_id == :failing_sub
    assert dl.sequence == 1
    assert dl.attempts == 3
    assert dl.reason == :database_offline

    # Subsequent flush shouldn't retry it
    :ok = Dispatcher.flush()
    refute_received {:attempt, 1}
  end

  test "dispatcher contains handler raises" do
    parent = self()

    # A subscriber that raises
    :ok =
      Dispatcher.subscribe(
        :raising_sub,
        "ledger.account.open",
        fn event ->
          send(parent, {:attempt, event.sequence})
          raise "Boom!"
        end,
        mode: :async
      )

    # Write record
    {:ok, _account} =
      Ash.Changeset.for_create(Account, :open, %{owner_id: "user_1", name: "Main", balance: 100})
      |> Ash.create()

    # Flush 3 times to exhaust attempts
    :ok = Dispatcher.flush()
    :ok = Dispatcher.flush()
    :ok = Dispatcher.flush()

    assert_received {:attempt, 1}
    assert_received {:attempt, 1}
    assert_received {:attempt, 1}

    dead = Dispatcher.dead_letters()
    assert length(dead) == 1
    [dl] = dead
    assert dl.subscriber_id == :raising_sub
    assert dl.sequence == 1
    assert dl.attempts == 3
    assert dl.reason == {:raised, "Boom!"}
  end

  test "replay generic action on outbox resource" do
    parent = self()

    # 1. Create two accounts to populate the outbox with sequence 1 and 2
    {:ok, _} = Ash.Changeset.for_create(Account, :open, %{owner_id: "u1", name: "Acc 1"}) |> Ash.create()
    {:ok, _} = Ash.Changeset.for_create(Account, :open, %{owner_id: "u2", name: "Acc 2"}) |> Ash.create()

    # 2. Register subscriber (only receives sequence > 2 normally)
    :ok =
      Dispatcher.subscribe(
        :replay_sub,
        "ledger.account.open",
        fn event ->
          send(parent, {:replay_delivered, event.sequence, self()})
          :ok
        end,
        mode: :async
      )

    # 3. Create a third account (sequence 3)
    {:ok, _} = Ash.Changeset.for_create(Account, :open, %{owner_id: "u3", name: "Acc 3"}) |> Ash.create()

    # Flush normally - should only deliver sequence 3
    :ok = Dispatcher.flush()
    assert_received {:replay_delivered, 3, dispatcher_pid}
    assert dispatcher_pid != self()

    # 4. Trigger replay for sequences after 0 (which includes 1, 2, and 3)
    {:ok, delivered} =
      Ash.ActionInput.for_action(Event, :replay, %{after_sequence: 0, subscriber_id: :replay_sub})
      |> Ash.run_action()

    assert delivered == [1, 2, 3]

    # Replay should have run synchronously in the caller process (self())
    assert_received {:replay_delivered, 1, caller_pid1}
    assert caller_pid1 == self()

    assert_received {:replay_delivered, 2, caller_pid2}
    assert caller_pid2 == self()

    assert_received {:replay_delivered, 3, caller_pid3}
    assert caller_pid3 == self()
  end
end
