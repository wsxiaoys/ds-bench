defmodule OrchestraTest do
  use ExUnit.Case, async: false

  setup do
    :ok = Orchestra.Rollout.Trace.reset()

    for table <- [
          Orchestra.Fleet.Node,
          Orchestra.Fleet.Rollout,
          Orchestra.Fleet.Placement,
          Orchestra.Fleet.Approval,
          Orchestra.Fleet.Lease
        ] do
      if :ets.whereis(table) != :undefined do
        :ets.delete_all_objects(table)
      end
    end
    :ok
  end

  test "successful rollout end-to-end" do
    _node1 = Orchestra.Fleet.register_node!("node1", :us_east, 10, %{deploy_failures_remaining: 0})
    _node2 = Orchestra.Fleet.register_node!("node2", :eu_west, 5, %{deploy_failures_remaining: 0})

    inputs = %{
      rollout_name: "test-rollout-1",
      strategy: :canary,
      targets: [
        %{node_name: "node1", slots: 3},
        %{node_name: "node2", slots: 2}
      ],
      board_threshold: 10
    }

    assert {:ok, result} = Reactor.run(Orchestra.Rollout.Reactor, inputs)

    # Verify result map
    assert is_binary(result.rollout_id)
    assert result.status == :succeeded
    assert result.deployed_nodes == ["node1", "node2"]
    assert result.total_slots == 5
    assert result.approval_level == :auto
    assert result.summary == "Rollout test-rollout-1 deployed 2 node(s) in canary mode with auto approval."

    # Verify lease is released
    [lease] = Orchestra.Fleet.list_leases!()
    assert lease.rollout_name == "test-rollout-1"
    assert lease.status == :released

    # Verify rollout is succeeded
    [rollout] = Orchestra.Fleet.list_rollouts!()
    assert rollout.name == "test-rollout-1"
    assert rollout.status == :succeeded
    assert rollout.deployed_node_count == 2

    # Verify placements are deployed
    placements = Orchestra.Fleet.list_placements!()
    assert length(placements) == 2
    assert Enum.all?(placements, &(&1.status == :deployed))
    assert Enum.all?(placements, &(&1.attempts == 1))

    # Verify nodes are live and slots are used
    n1 = Orchestra.Fleet.get_node!("node1")
    assert n1.slots_used == 3
    assert n1.state == :live

    n2 = Orchestra.Fleet.get_node!("node2")
    assert n2.slots_used == 2
    assert n2.state == :live

    # Verify trace
    entries = Orchestra.Rollout.Trace.entries()
    assert {:reactor_init, "reactor"} in entries
    assert {:reactor_complete, "reactor"} in entries
    assert {:deploy_enter, "node1"} in entries
    assert {:deploy_exit, "node1"} in entries
  end

  test "successful rollout with retry (deploy_failures_remaining: 3)" do
    _node1 = Orchestra.Fleet.register_node!("node-retry", :us_east, 10, %{deploy_failures_remaining: 3})

    inputs = %{
      rollout_name: "test-retry",
      strategy: :blast,
      targets: [
        %{node_name: "node-retry", slots: 4}
      ],
      board_threshold: 3
    }

    assert {:ok, result} = Reactor.run(Orchestra.Rollout.Reactor, inputs)
    assert result.approval_level == :board

    # Verify placement attempts and compensations
    [placement] = Orchestra.Fleet.list_placements!()
    assert placement.attempts == 4
    assert placement.compensations == 3
    assert placement.status == :deployed

    # Verify node is live
    n = Orchestra.Fleet.get_node!("node-retry")
    assert n.slots_used == 4
    assert n.state == :live
    assert n.deploy_failures_remaining == 0

    # Verify trace has compensations
    entries = Orchestra.Rollout.Trace.entries()
    assert Enum.count(entries, &match?({:deploy_compensate, "node-retry"}, &1)) == 3
  end

  test "failed rollout with rollback (deploy_failures_remaining: 4)" do
    _node1 = Orchestra.Fleet.register_node!("node-ok", :us_east, 10, %{deploy_failures_remaining: 0})
    _node2 = Orchestra.Fleet.register_node!("node-fail", :eu_west, 5, %{deploy_failures_remaining: 4})

    inputs = %{
      rollout_name: "test-fail",
      strategy: :canary,
      targets: [
        %{node_name: "node-ok", slots: 2},
        %{node_name: "node-fail", slots: 3}
      ],
      board_threshold: 10
    }

    assert {:error, _reason} = Reactor.run(Orchestra.Rollout.Reactor, inputs)

    # Verify lease is released
    [lease] = Orchestra.Fleet.list_leases!()
    assert lease.status == :released

    # Verify rollout is rolled_back with 0 deployed count
    [rollout] = Orchestra.Fleet.list_rollouts!()
    assert rollout.status == :rolled_back
    assert rollout.deployed_node_count == 0

    # Verify approval is revoked
    [approval] = Orchestra.Fleet.list_approvals!()
    assert approval.status == :revoked

    # Verify node-ok which succeeded was undone
    [p_ok] = Orchestra.Fleet.list_placements!() |> Enum.filter(&(&1.node_name == "node-ok"))
    assert p_ok.status == :released
    assert p_ok.undos == 1

    # Verify node-fail which never succeeded has undos 0
    [p_fail] = Orchestra.Fleet.list_placements!() |> Enum.filter(&(&1.node_name == "node-fail"))
    assert p_fail.status == :reserved
    assert p_fail.undos == 0

    # Verify reservations are reverted: node-ok slots_used is 0, state is :idle
    n_ok = Orchestra.Fleet.get_node!("node-ok")
    assert n_ok.slots_used == 0
    assert n_ok.state == :idle

    n_fail = Orchestra.Fleet.get_node!("node-fail")
    assert n_fail.slots_used == 0
    assert n_fail.state == :idle

    # Verify trace
    entries = Orchestra.Rollout.Trace.entries()
    assert {:reactor_error, "reactor"} in entries
    assert {:deploy_undo, "node-ok"} in entries
    assert {:reserve_undo, "node-ok"} in entries
    assert {:reserve_undo, "node-fail"} in entries
  end

  test "failed reservation rollback" do
    _node1 = Orchestra.Fleet.register_node!("node-small", :us_east, 2, %{deploy_failures_remaining: 0})
    _node2 = Orchestra.Fleet.register_node!("node-other", :eu_west, 5, %{deploy_failures_remaining: 0})

    inputs = %{
      rollout_name: "test-reserve-fail",
      strategy: :canary,
      targets: [
        %{node_name: "node-other", slots: 2},
        %{node_name: "node-small", slots: 3}
      ],
      board_threshold: 10
    }

    assert {:error, _reason} = Reactor.run(Orchestra.Rollout.Reactor, inputs)

    # Verify node-other reservation was rolled back
    n_other = Orchestra.Fleet.get_node!("node-other")
    assert n_other.slots_used == 0
    assert n_other.state == :idle

    # Verify trace has reserve_undo for node-other
    entries = Orchestra.Rollout.Trace.entries()
    assert {:reserve_undo, "node-other"} in entries
  end

  test "plan_rollout validation errors" do
    assert {:error, %Ash.Error.Invalid{errors: [err]}} = Orchestra.Fleet.plan_rollout([])
    assert err.field == :targets

    assert {:error, %Ash.Error.Invalid{}} = Orchestra.Fleet.plan_rollout([%{node_name: "node1", slots: -1}])
    assert {:error, %Ash.Error.Invalid{}} = Orchestra.Fleet.plan_rollout([%{node_name: "node1", slots: 2}, %{node_name: "node1", slots: 1}])
  end
end
