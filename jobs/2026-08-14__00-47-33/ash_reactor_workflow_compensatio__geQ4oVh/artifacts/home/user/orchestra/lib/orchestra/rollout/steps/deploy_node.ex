defmodule Orchestra.Rollout.Steps.DeployNode do
  use Reactor.Step

  @impl true
  def run(arguments, _context, _options) do
    target = arguments[:target]
    rollout_id = arguments[:rollout_id]
    node_name = target[:node_name] || Map.get(target, "node_name")

    # Record deploy_enter
    Orchestra.Rollout.Trace.record(:deploy_enter, node_name)

    # Every deployment attempt takes at least 50 ms of wall-clock time
    Process.sleep(50)

    # Read Placement record
    placement =
      Orchestra.Fleet.list_placements!()
      |> Enum.find(fn p -> p.rollout_id == rollout_id and p.node_name == node_name end)

    # Read Node record
    node = Orchestra.Fleet.get_node!(node_name)

    # Raise placement's attempts by one and set its status to :deploying
    new_attempts = placement.attempts + 1
    {:ok, placement} =
      placement
      |> Ash.Changeset.for_update(:update, %{attempts: new_attempts, status: :deploying})
      |> Ash.update()

    # Determine failure/success
    if node.deploy_failures_remaining > 0 do
      new_failures_remaining = node.deploy_failures_remaining - 1
      {:ok, _node} =
        node
        |> Ash.Changeset.for_update(:update, %{deploy_failures_remaining: new_failures_remaining})
        |> Ash.update()

      # Record deploy_exit
      Orchestra.Rollout.Trace.record(:deploy_exit, node_name)

      # Return error so compensate/4 is called
      {:error, :deploy_failed}
    else
      # A successful attempt sets the placement status to :deployed and the node state to :live
      {:ok, placement} =
        placement
        |> Ash.Changeset.for_update(:update, %{status: :deployed})
        |> Ash.update()

      {:ok, _node} =
        node
        |> Ash.Changeset.for_update(:update, %{state: :live})
        |> Ash.update()

      # Record deploy_exit
      Orchestra.Rollout.Trace.record(:deploy_exit, node_name)

      {:ok, placement}
    end
  end

  @impl true
  def compensate(_reason, arguments, _context, _options) do
    target = arguments[:target]
    rollout_id = arguments[:rollout_id]
    node_name = target[:node_name] || Map.get(target, "node_name")

    # Read Placement record
    placement =
      Orchestra.Fleet.list_placements!()
      |> Enum.find(fn p -> p.rollout_id == rollout_id and p.node_name == node_name end)

    # "the placement's compensations rises by one and its status returns to :reserved"
    new_compensations = placement.compensations + 1
    {:ok, placement} =
      placement
      |> Ash.Changeset.for_update(:update, %{compensations: new_compensations, status: :reserved})
      |> Ash.update()

    # Record deploy_compensate
    Orchestra.Rollout.Trace.record(:deploy_compensate, node_name)

    # Check attempts: a target is attempted at most four times in total
    if placement.attempts >= 4 do
      # Stop retrying and fail the run
      {:error, :max_attempts_exceeded}
    else
      # Retry the deployment
      :retry
    end
  end

  @impl true
  def undo(placement, arguments, _context, _options) do
    target = arguments[:target]
    node_name = target[:node_name] || Map.get(target, "node_name")

    # Read latest placement
    placement = Orchestra.Fleet.list_placements!() |> Enum.find(fn p -> p.id == placement.id end)

    if placement.status == :deployed do
      new_undos = placement.undos + 1
      {:ok, _placement} =
        placement
        |> Ash.Changeset.for_update(:update, %{undos: new_undos, status: :released})
        |> Ash.update()

      # Record deploy_undo
      Orchestra.Rollout.Trace.record(:deploy_undo, node_name)
    end

    :ok
  end
end
