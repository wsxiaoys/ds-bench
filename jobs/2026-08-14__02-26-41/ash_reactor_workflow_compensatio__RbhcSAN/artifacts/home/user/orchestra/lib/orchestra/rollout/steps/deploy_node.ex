defmodule Orchestra.Rollout.Steps.DeployNode do
  use Reactor.Step

  @impl true
  def run(arguments, _context, _options) do
    placement = arguments.placement
    node_name = placement.node_name

    # 1. Record deploy_enter
    Orchestra.Rollout.Trace.record(:deploy_enter, node_name)

    # 2. Sleep for 50 ms
    Process.sleep(50)

    # 3. Raise attempts and set status to deploying
    {:ok, current_placement} = Ash.get(Orchestra.Fleet.Placement, placement.id)
    {:ok, current_placement} = Ash.update(current_placement, %{}, action: :increment_attempts)

    # 4. Fetch the node to check deploy_failures_remaining
    {:ok, node} = Orchestra.Fleet.get_node(node_name)

    if node.deploy_failures_remaining > 0 do
      # Fail!
      # Decrement deploy_failures_remaining
      Ash.update!(node, %{}, action: :decrement_deploy_failures)

      # Record deploy_exit
      Orchestra.Rollout.Trace.record(:deploy_exit, node_name)

      {:error, :deploy_failed}
    else
      # Succeed!
      {:ok, updated_placement} = Ash.update(current_placement, %{}, action: :set_deployed)
      Ash.update!(node, %{}, action: :set_live)

      # Record deploy_exit
      Orchestra.Rollout.Trace.record(:deploy_exit, node_name)

      {:ok, updated_placement}
    end
  end

  @impl true
  def compensate(_reason, arguments, _context, _options) do
    placement = arguments.placement
    node_name = placement.node_name

    {:ok, current_placement} = Ash.get(Orchestra.Fleet.Placement, placement.id)
    Ash.update!(current_placement, %{}, action: :increment_compensations)

    Orchestra.Rollout.Trace.record(:deploy_compensate, node_name)

    :retry
  end

  @impl true
  def undo(placement, _arguments, _context, _options) do
    node_name = placement.node_name

    {:ok, current_placement} = Ash.get(Orchestra.Fleet.Placement, placement.id)
    Ash.update!(current_placement, %{}, action: :increment_undos)

    Orchestra.Rollout.Trace.record(:deploy_undo, node_name)

    :ok
  end
end
