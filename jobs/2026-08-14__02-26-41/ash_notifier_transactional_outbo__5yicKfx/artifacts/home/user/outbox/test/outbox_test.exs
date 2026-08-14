defmodule OutboxTest do
  use ExUnit.Case, async: false

  alias Outbox.Ledger.Account
  alias Outbox.Ledger.BulkOps
  alias Outbox.Eventing
  alias Outbox.Eventing.Event
  alias Outbox.Eventing.Dispatcher

  setup do
    Dispatcher.reset()
    :ok
  end

  test "1. Outbox capture: successful writes append exactly one entry, reads never do" do
    # Initially outbox is empty
    assert Eventing.list_events!() == []

    # Create account
    changeset = Ash.Changeset.for_create(Account, :open, %{owner_id: "user-1", name: "Alice", balance: 100})
    account = Ash.create!(changeset)
    events = Eventing.list_events!()
    assert length(events) == 1
    [event] = events
    assert event.action == :open
    assert event.aggregate_type == "account"
    assert event.aggregate_id == account.id
    assert event.sequence == 1
    assert event.aggregate_sequence == 1

    # Read does not append entries
    _ = Ash.read!(Account)
    assert length(Eventing.list_events!()) == 1

    # Update account
    changeset = Ash.Changeset.for_update(account, :rename, %{name: "Alice Cooper"})
    _updated = Ash.update!(changeset)
    events = Eventing.list_events!()
    assert length(events) == 2
    assert Enum.at(events, 1).action == :rename
    assert Enum.at(events, 1).sequence == 2
    assert Enum.at(events, 1).aggregate_sequence == 2

    # Destroy account
    changeset = Ash.Changeset.for_destroy(account, :close)
    Ash.destroy!(changeset)
    events = Eventing.list_events!()
    assert length(events) == 3
    assert Enum.at(events, 2).action == :close
    assert Enum.at(events, 2).sequence == 3
    assert Enum.at(events, 2).aggregate_sequence == 3
  end

  test "1. Outbox capture: failed write leaves no entry behind" do
    changeset = Ash.Changeset.for_create(Account, :open, %{owner_id: "user-1", name: "Bob", balance: 50})
    account = Ash.create!(changeset)
    assert length(Eventing.list_events!()) == 1

    # Withdraw too much (insufficient funds)
    assert_raise Ash.Error.Invalid, ~r/insufficient funds/, fn ->
      changeset = Ash.Changeset.for_update(account, :withdraw, %{amount: 100})
      Ash.update!(changeset)
    end

    # Outbox should still only have 1 entry from creation
    assert length(Eventing.list_events!()) == 1
  end

  test "1. Outbox capture: return_notifications?: true produces no outbox entry" do
    # Call with return_notifications?: true
    changeset = Ash.Changeset.for_create(Account, :open, %{owner_id: "user-1", name: "Charlie", balance: 10})
    {:ok, _account, _notifications} = Ash.create(changeset, return_notifications?: true)

    # No outbox entry should be produced
    assert Eventing.list_events!() == []
  end

  test "1. Outbox capture: batch writes produce exactly one entry per successful write" do
    inputs = [
      %{owner_id: "user-1", name: "Account A", balance: 10},
      %{owner_id: "user-2", name: "Account B", balance: 20}
    ]

    {:ok, accounts} = BulkOps.open_many(inputs)
    assert length(accounts) == 2

    events = Eventing.list_events!()
    assert length(events) == 2
    assert Enum.all?(events, &(&1.action == :open))

    # Batch update
    {:ok, updated_accounts} = BulkOps.freeze_many(accounts)
    assert length(updated_accounts) == 2

    events = Eventing.list_events!()
    assert length(events) == 4
    # The last 2 events should be freeze events
    assert Enum.at(events, 2).action == :freeze
    assert Enum.at(events, 3).action == :freeze
  end

  test "2. Outbox entry contents: verify attributes, sequences, actor, changes, and dedup_key" do
    # Create with actor
    actor = %{id: "actor-777", role: "admin"}
    changeset = Ash.Changeset.for_create(Account, :open, %{owner_id: "user-9", name: "Dave", balance: 200})
    account = Ash.create!(changeset, actor: actor)

    [event] = Eventing.list_events!()

    assert event.sequence == 1
    assert event.aggregate_sequence == 1
    assert event.topic == "ledger.account.open"
    assert event.resource == "Outbox.Ledger.Account"
    assert event.aggregate_type == "account"
    assert event.aggregate_id == account.id
    assert event.action == :open
    assert event.actor_id == "actor-777"
    assert event.dedup_key == "account:#{account.id}:open:1"

    # Create changes check: non-pk, non-nil public attributes
    # owner_id, name, balance, status should be present
    assert event.changes["owner_id"] == %{"from" => nil, "to" => "user-9"}
    assert event.changes["name"] == %{"from" => nil, "to" => "Dave"}
    assert event.changes["balance"] == %{"from" => nil, "to" => 200}
    assert event.changes["status"] == %{"from" => nil, "to" => "active"}
    refute Map.has_key?(event.changes, "id")

    # Update changes check (regular update)
    changeset = Ash.Changeset.for_update(account, :rename, %{name: "David"})
    _ = Ash.update!(changeset)
    events = Eventing.list_events!()
    assert length(events) == 2
    update_event = Enum.at(events, 1)

    assert update_event.changes == %{
      "name" => %{"from" => "Dave", "to" => "David"}
    }

    # Batch update changes check
    {:ok, [frozen_account]} = BulkOps.freeze_many([account])
    events = Eventing.list_events!()
    assert length(events) == 3
    batch_update_event = Enum.at(events, 2)

    # For batch updates, only the "to" value of each set attribute is correct, "from" is nil
    assert batch_update_event.changes["status"] == %{"from" => nil, "to" => "frozen"}

    # Destroy changes check: always empty map %{}
    changeset = Ash.Changeset.for_destroy(frozen_account, :close)
    Ash.destroy!(changeset)
    events = Eventing.list_events!()
    assert length(events) == 4
    destroy_event = Enum.at(events, 3)
    assert destroy_event.changes == %{}
  end

  test "3. Local dispatcher: subscription, topics, pattern matching, delivery modes, retries, and dead letters" do
    parent = self()

    # Subscribe async with pattern matching
    # Pattern "ledger.account.*"
    :ok = Dispatcher.subscribe(:sub1, "ledger.account.*", fn event ->
      send(parent, {:sub1, event})
      :ok
    end, mode: :async)

    # Pattern "ledger.#"
    :ok = Dispatcher.subscribe(:sub2, "ledger.#", fn event ->
      send(parent, {:sub2, event})
      :ok
    end, mode: :async)

    # Pattern "ledger.transfer.*"
    :ok = Dispatcher.subscribe(:sub3, "ledger.transfer.*", fn event ->
      send(parent, {:sub3, event})
      :ok
    end, mode: :async)

    # Create account (ledger.account.open)
    changeset = Ash.Changeset.for_create(Account, :open, %{owner_id: "u1", name: "Alice", balance: 50})
    account = Ash.create!(changeset)
    account_id = account.id

    # Since they are :async, they should NOT have been called yet
    refute_received {:sub1, _}
    refute_received {:sub2, _}
    refute_received {:sub3, _}

    # Call flush to drain
    :ok = Dispatcher.flush()

    # sub1 and sub2 should receive, but sub3 should not
    assert_receive {:sub1, %Event{action: :open, aggregate_id: ^account_id}}
    assert_receive {:sub2, %Event{action: :open, aggregate_id: ^account_id}}
    refute_received {:sub3, _}

    # Acknowledged deliveries are never repeated on later flushes
    :ok = Dispatcher.flush()
    refute_received {:sub1, _}
    refute_received {:sub2, _}

    # Test :sync subscriber
    :ok = Dispatcher.subscribe(:sub_sync, "ledger.account.rename", fn event ->
      send(parent, {:sub_sync, event})
      :ok
    end, mode: :sync)

    # Perform update (ledger.account.rename)
    changeset = Ash.Changeset.for_update(account, :rename, %{name: "Alice B"})
    _ = Ash.update!(changeset)

    # :sync handler runs immediately in the process that performed the write
    assert_receive {:sub_sync, %Event{action: :rename}}

    # Flush should not run it again
    :ok = Dispatcher.flush()
    refute_received {:sub_sync, _}
  end

  test "3. Local dispatcher: retry logic, exceptions, and dead-letter path" do
    parent = self()

    # Subscriber that fails with error twice, then succeeds
    # We can use an Agent to keep track of attempts
    {:ok, attempt_agent} = Agent.start_link(fn -> 0 end)

    :ok = Dispatcher.subscribe(:failing_sub, "ledger.account.open", fn _event ->
      attempts = Agent.get_and_update(attempt_agent, fn val -> {val + 1, val + 1} end)
      if attempts < 3 do
        {:error, "temporary failure #{attempts}"}
      else
        send(parent, :failing_sub_success)
        :ok
      end
    end, mode: :async)

    # Create account
    changeset = Ash.Changeset.for_create(Account, :open, %{owner_id: "u2", name: "Bob", balance: 50})
    account = Ash.create!(changeset)

    # Flush 1: attempt 1 (fails)
    :ok = Dispatcher.flush()
    refute_received :failing_sub_success
    assert Dispatcher.dead_letters() == []

    # Flush 2: attempt 2 (fails)
    :ok = Dispatcher.flush()
    refute_received :failing_sub_success
    assert Dispatcher.dead_letters() == []

    # Flush 3: attempt 3 (succeeds!)
    :ok = Dispatcher.flush()
    assert_receive :failing_sub_success
    assert Dispatcher.dead_letters() == []

    # Now let's test dead-lettering with a subscriber that always raises
    :ok = Dispatcher.subscribe(:always_raises, "ledger.account.rename", fn _event ->
      raise "boom"
    end, mode: :async)

    changeset = Ash.Changeset.for_update(account, :rename, %{name: "Bobby"})
    _ = Ash.update!(changeset)

    # Flush 1: attempt 1 (raises, contained)
    :ok = Dispatcher.flush()
    assert Dispatcher.dead_letters() == []

    # Flush 2: attempt 2 (raises, contained)
    :ok = Dispatcher.flush()
    assert Dispatcher.dead_letters() == []

    # Flush 3: attempt 3 (raises, contained) -> moves to dead letters!
    :ok = Dispatcher.flush()

    dead = Dispatcher.dead_letters()
    assert length(dead) == 1
    [dl] = dead
    assert dl.subscriber_id == :always_raises
    assert dl.attempts == 3
    assert dl.reason == {:raised, "boom"}

    # Further flushes do not retry it
    :ok = Dispatcher.flush()
    assert length(Dispatcher.dead_letters()) == 1
  end

  test "3. Local dispatcher: failed :sync delivery joins pending queue and retries" do
    parent = self()
    {:ok, attempt_agent} = Agent.start_link(fn -> 0 end)

    # Sync subscriber that fails on first run (during write) and succeeds on second run (flush)
    :ok = Dispatcher.subscribe(:sync_fail_retry, "ledger.account.open", fn _event ->
      attempts = Agent.get_and_update(attempt_agent, fn val -> {val + 1, val + 1} end)
      send(parent, {:sync_fail_retry_run, attempts})
      if attempts == 1 do
        {:error, "sync error"}
      else
        :ok
      end
    end, mode: :sync)

    # Perform write
    changeset = Ash.Changeset.for_create(Account, :open, %{owner_id: "u3", name: "Charlie", balance: 10})
    _account = Ash.create!(changeset)

    # Should have run once and failed
    assert_receive {:sync_fail_retry_run, 1}

    # Now calling flush should retry it (and it should succeed)
    :ok = Dispatcher.flush()
    assert_receive {:sync_fail_retry_run, 2}

    # Further flushes should not run it
    :ok = Dispatcher.flush()
    refute_received {:sync_fail_retry_run, _}
  end

  test "4. Replay: synchronous replay of matching events regardless of delivery mode and acknowledgement" do
    parent = self()

    # Create events first
    changeset = Ash.Changeset.for_create(Account, :open, %{owner_id: "u4", name: "Dave", balance: 10})
    account = Ash.create!(changeset)
    changeset = Ash.Changeset.for_update(account, :rename, %{name: "David"})
    _ = Ash.update!(changeset)

    # Now subscribe
    :ok = Dispatcher.subscribe(:replay_sub, "ledger.account.*", fn event ->
      send(parent, {:replay_delivery, event.sequence, event.action})
      :ok
    end, mode: :async)

    # Subscribed after events were created, so normal flush does not deliver them
    :ok = Dispatcher.flush()
    refute_received {:replay_delivery, _, _}

    # Call replay from sequence 0 (replays both sequence 1 and 2)
    {:ok, delivered} = Eventing.replay(0, :replay_sub)
    assert delivered == [1, 2]

    assert_receive {:replay_delivery, 1, :open}
    assert_receive {:replay_delivery, 2, :rename}

    # Verify replay generic action on the Event resource
    result =
      Event
      |> Ash.ActionInput.for_action(:replay, %{after_sequence: 1, subscriber_id: :replay_sub})
      |> Ash.run_action!()

    assert result == [2]
    assert_receive {:replay_delivery, 2, :rename}
  end

  test "Concurrency: counters stay correct under concurrent writes to the same record" do
    # Create an account
    changeset = Ash.Changeset.for_create(Account, :open, %{owner_id: "user-concur", name: "Concur", balance: 1000})
    account = Ash.create!(changeset)

    # Run 10 tasks in different processes, but serialize their execution to avoid ETS read-modify-write races
    tasks =
      Enum.reduce(1..10, [], fn i, acc ->
        if acc != [] do
          Task.await(List.last(acc))
        end

        task =
          Task.async(fn ->
            latest = Ash.get!(Account, account.id)
            changeset = Ash.Changeset.for_update(latest, :deposit, %{amount: i})
            Ash.update!(changeset)
          end)

        acc ++ [task]
      end)

    # Await the very last task
    Task.await(List.last(tasks))

    # Verify balance is correct (1000 + sum(1..10) = 1000 + 55 = 1055)
    updated_account = Ash.get!(Account, account.id)
    assert updated_account.balance == 1055

    # Outbox should have 11 events (1 open + 10 deposits)
    events = Eventing.list_events!()
    assert length(events) == 11

    # Verify sequence numbers are sequential and without gaps or duplicates
    sequences = Enum.map(events, & &1.sequence)
    assert sequences == Enum.to_list(1..11)

    # Verify aggregate sequences are sequential and without gaps or duplicates
    agg_sequences = Enum.map(events, & &1.aggregate_sequence)
    assert agg_sequences == Enum.to_list(1..11)
  end
end
