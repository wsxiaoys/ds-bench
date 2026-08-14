defmodule Orchestra.Rollout.Reactor do
  use Ash.Reactor

  middlewares do
    middleware Orchestra.Rollout.Middleware
  end

  ash do
    default_domain Orchestra.Fleet
  end

  input :rollout_name
  input :strategy
  input :targets
  input :board_threshold

  # 1. Create Lease
  create :create_lease, Orchestra.Fleet.Lease, :create do
    inputs %{
      rollout_name: input(:rollout_name),
      status: value(:held)
    }
    undo :always
    undo_action :release_lease
  end

  # 2. Create Rollout
  create :create_rollout, Orchestra.Fleet.Rollout, :create do
    inputs %{
      name: input(:rollout_name),
      strategy: input(:strategy),
      status: value(:pending),
      deployed_node_count: value(0)
    }
    undo :always
    undo_action :rollback_rollout
  end

  # 3. Plan Rollout (Generic Action)
  action :plan, Orchestra.Fleet.Rollout, :plan_rollout do
    inputs %{
      targets: input(:targets)
    }
  end

  # 4. Reserve Targets (Map step)
  map :reserve_targets do
    source input(:targets)
    return :create_placement

    # We need to make sure this step runs sequentially after create_rollout and plan
    wait_for [:create_rollout, :plan]

    # Inside reservation, for each target:
    # Get Node
    read_one :get_node, Orchestra.Fleet.Node, :read_by_name do
      inputs %{
        name: element(:reserve_targets, [:node_name])
      }
    end

    # Reserve Node (slots_used and state)
    update :reserve_node, Orchestra.Fleet.Node, :reserve do
      initial result(:get_node)
      inputs %{
        slots: element(:reserve_targets, [:slots])
      }
    end

    # Create Placement
    create :create_placement, Orchestra.Fleet.Placement, :create do
      wait_for :reserve_node
      inputs %{
        rollout_id: result(:create_rollout, [:id]),
        node_name: element(:reserve_targets, [:node_name]),
        slots: element(:reserve_targets, [:slots]),
        status: value(:reserved)
      }
      undo :always
      undo_action :reverse_placement
    end
  end

  # 5. Compose Approval (Calls ApprovalReactor)
  compose :approval, Orchestra.Rollout.ApprovalReactor do
    argument :rollout_id, result(:create_rollout, [:id])
    argument :total_slots, result(:plan, [:total_slots])
    argument :board_threshold, input(:board_threshold)

    # Wait for reservation to succeed
    wait_for :reserve_targets
  end

  # 6. Deploy Targets (Map step with bounded parallelism)
  map :deploy_targets do
    source input(:targets)
    batch_size 2
    allow_async? true
    return :deploy_node

    # Wait for reservation and approval to succeed
    wait_for [:reserve_targets, :approval]

    step :deploy_node, Orchestra.Rollout.Steps.DeployNode do
      argument :target, element(:deploy_targets)
      argument :rollout_id, result(:create_rollout, [:id])
    end
  end

  # Plain step to wait for deploy_targets to completely finish
  step :wait_deploy_done do
    argument :deploy_results, result(:deploy_targets)
    run fn %{deploy_results: results}, _ ->
      {:ok, results}
    end
  end

  # 7. Update Rollout Succeeded
  update :success_rollout, Orchestra.Fleet.Rollout, :mark_succeeded do
    initial result(:create_rollout)
    wait_for :wait_deploy_done
    inputs %{
      deployed_node_count: result(:plan, [:target_count])
    }
  end

  # 8. Release Lease on Success
  update :release_lease_success, Orchestra.Fleet.Lease, :release_lease do
    initial result(:create_lease)
    wait_for :success_rollout
  end

  # 9. Return Result
  step :return_result do
    argument :rollout, result(:success_rollout)
    argument :approval, result(:approval)
    argument :plan, result(:plan)
    argument :lease, result(:release_lease_success)

    run fn %{rollout: rollout, approval: approval, plan: plan}, _ ->
      summary = "Rollout #{rollout.name} deployed #{plan.target_count} node(s) in #{rollout.strategy} mode with #{approval.level} approval."
      {:ok, %{
        rollout_id: rollout.id,
        status: :succeeded,
        deployed_nodes: plan.node_names,
        total_slots: plan.total_slots,
        approval_level: approval.level,
        summary: summary
      }}
    end
  end

  return :return_result
end
