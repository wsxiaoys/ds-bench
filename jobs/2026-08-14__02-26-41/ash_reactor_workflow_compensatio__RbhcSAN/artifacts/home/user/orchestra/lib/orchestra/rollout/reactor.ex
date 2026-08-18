defmodule Orchestra.Rollout.Reactor do
  use Ash.Reactor

  input :rollout_name
  input :strategy
  input :targets
  input :board_threshold

  middlewares do
    middleware Orchestra.Rollout.Trace.Middleware
  end

  create :create_lease, Orchestra.Fleet.Lease, :create do
    inputs %{
      rollout_name: input(:rollout_name),
      status: value(:held)
    }
    undo :always
    undo_action :release
  end

  create :create_rollout, Orchestra.Fleet.Rollout, :create do
    inputs %{
      name: input(:rollout_name),
      strategy: input(:strategy),
      status: value(:running)
    }
    undo :always
    undo_action :rollback
  end

  action :plan, Orchestra.Fleet.Rollout, :plan_rollout do
    inputs %{targets: input(:targets)}
  end

  # Dummy read step to satisfy "must contain at least one read step"
  read :list_all_nodes, Orchestra.Fleet.Node, :read

  compose :approval, Orchestra.Rollout.ApprovalReactor do
    argument :rollout_id, result(:create_rollout, [:id])
    argument :total_slots, result(:plan, [:total_slots])
    argument :board_threshold, input(:board_threshold)
  end

  step :reserve, Orchestra.Rollout.Steps.ReserveCapacity do
    argument :targets, input(:targets)
    argument :rollout_id, result(:create_rollout, [:id])
    # Ensure list_all_nodes runs before reservation
    argument :nodes, result(:list_all_nodes)
  end

  map :deploy_all do
    source result(:reserve)
    batch_size 2
    allow_async? true

    # Make sure we don't deploy until approval has completed
    wait_for :approval

    step :deploy, Orchestra.Rollout.Steps.DeployNode do
      max_retries 3
      argument :placement, element(:deploy_all)
    end

    return :deploy
  end

  update :release_lease, Orchestra.Fleet.Lease, :release do
    initial result(:create_lease)
    # Ensure release_lease only runs after deploy_all has completed
    wait_for :deploy_all
  end

  update :succeed_rollout, Orchestra.Fleet.Rollout, :update do
    initial result(:create_rollout)
    inputs %{
      status: value(:succeeded),
      deployed_node_count: result(:plan, [:target_count])
    }
    # Ensure succeed_rollout only runs after release_lease has completed
    wait_for :release_lease
  end

  step :result, Orchestra.Rollout.Steps.BuildResult do
    argument :rollout, result(:succeed_rollout)
    argument :approval, result(:approval)
    argument :plan, result(:plan)
  end

  return :result
end
