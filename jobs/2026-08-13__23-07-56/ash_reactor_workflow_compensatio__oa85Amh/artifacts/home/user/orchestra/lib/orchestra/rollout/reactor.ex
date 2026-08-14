defmodule Orchestra.Rollout.Reactor do
  use Ash.Reactor

  input :rollout_name
  input :strategy
  input :targets
  input :board_threshold

  return :build_result

  middlewares do
    middleware Orchestra.Rollout.ReactorMiddleware
  end

  # 1. Action step to plan the rollout
  action :plan, Orchestra.Fleet.Rollout, :plan_rollout do
    inputs %{
      targets: input(:targets)
    }
  end

  # 2. Create Lease
  create :create_lease, Orchestra.Fleet.Lease, :create do
    undo_action :release
    undo :always
    inputs %{
      rollout_name: input(:rollout_name),
      status: value(:held)
    }
  end

  # 3. Create Rollout
  create :create_rollout, Orchestra.Fleet.Rollout, :create do
    undo_action :rollback
    undo :always
    inputs %{
      name: input(:rollout_name),
      strategy: input(:strategy),
      status: value(:running)
    }
  end

  # 4. Compose Approval Reactor
  compose :approval, Orchestra.Rollout.ApprovalReactor do
    argument :rollout_id, result(:create_rollout, [:id])
    argument :total_slots, result(:plan, [:total_slots])
    argument :board_threshold, input(:board_threshold)
  end

  # 5. Reserve Nodes
  step :reserve_nodes, Orchestra.Rollout.Steps.ReserveTargets do
    argument :rollout_id, result(:create_rollout, [:id])
    argument :targets, input(:targets)
  end

  # 6. Deploy Nodes (Map Step)
  map :deploy_all_nodes do
    source input(:targets)
    batch_size 2
    allow_async? true
    wait_for [:reserve_nodes, :approval]

    step :deploy_node, Orchestra.Rollout.Steps.DeployNode do
      argument :target, element(:deploy_all_nodes)
      argument :rollout_id, result(:create_rollout, [:id])
      max_retries 3
    end
  end

  # 7. Update Rollout on success
  update :succeed_rollout, Orchestra.Fleet.Rollout, :succeed do
    initial result(:create_rollout)
    inputs %{
      deployed_node_count: result(:plan, [:target_count])
    }
    wait_for :deploy_all_nodes
  end

  # 8. Update Lease on success
  update :release_lease, Orchestra.Fleet.Lease, :release do
    initial result(:create_lease)
    wait_for :succeed_rollout
  end

  # 9. Read step to satisfy the "read step" requirement
  read :read_all_rollouts, Orchestra.Fleet.Rollout, :read do
    wait_for [:succeed_rollout, :release_lease]
  end

  # 10. Build the final result map
  step :build_result do
    argument :rollout_id, result(:create_rollout, [:id])
    argument :rollout_name, input(:rollout_name)
    argument :strategy, input(:strategy)
    argument :deployed_nodes, result(:plan, [:node_names])
    argument :total_slots, result(:plan, [:total_slots])
    argument :target_count, result(:plan, [:target_count])
    argument :approval_level, result(:approval, [:level])
    wait_for :read_all_rollouts

    run fn args, _context ->
      summary = "Rollout #{args.rollout_name} deployed #{args.target_count} node(s) in #{args.strategy} mode with #{args.approval_level} approval."
      {:ok, %{
        rollout_id: args.rollout_id,
        status: :succeeded,
        deployed_nodes: args.deployed_nodes,
        total_slots: args.total_slots,
        approval_level: args.approval_level,
        summary: summary
      }}
    end
  end
end
