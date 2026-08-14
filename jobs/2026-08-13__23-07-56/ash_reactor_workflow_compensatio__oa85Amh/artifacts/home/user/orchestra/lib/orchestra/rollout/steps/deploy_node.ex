defmodule Orchestra.Rollout.Steps.DeployNode do
  use Reactor.Step

  def run(arguments, _context, _options) do
    target = arguments.target
    node_name = target.node_name || target["node_name"]
    rollout_id = arguments.rollout_id

    placement =
      Orchestra.Fleet.list_placements!()
      |> Enum.find(&(&1.rollout_id == rollout_id and &1.node_name == node_name))

    node = Orchestra.Fleet.get_node!(node_name)
    failures_remaining = node.deploy_failures_remaining

    # Update placement
    _placement =
      placement
      |> Ash.Changeset.for_update(:update, %{attempts: placement.attempts + 1, status: :deploying})
      |> Ash.update!()

    Orchestra.Rollout.Trace.record(:deploy_enter, node_name)

    Process.sleep(50)

    if failures_remaining > 0 do
      node
      |> Ash.Changeset.for_update(:update, %{deploy_failures_remaining: failures_remaining - 1})
      |> Ash.update!()

      Orchestra.Rollout.Trace.record(:deploy_exit, node_name)

      {:error, {:deploy_failed, node_name}}
    else
      placement =
        placement
        |> Ash.Changeset.for_update(:update, %{status: :deployed})
        |> Ash.update!()

      node
      |> Ash.Changeset.for_update(:update, %{state: :live})
      |> Ash.update!()

      Orchestra.Rollout.Trace.record(:deploy_exit, node_name)

      {:ok, placement}
    end
  end

  def compensate(_reason, arguments, _context, _options) do
    target = arguments.target
    node_name = target.node_name || target["node_name"]
    rollout_id = arguments.rollout_id

    placement =
      Orchestra.Fleet.list_placements!()
      |> Enum.find(&(&1.rollout_id == rollout_id and &1.node_name == node_name))

    placement
    |> Ash.Changeset.for_update(:update, %{compensations: placement.compensations + 1, status: :reserved})
    |> Ash.update!()

    Orchestra.Rollout.Trace.record(:deploy_compensate, node_name)

    :retry
  end

  def undo(_value, arguments, _context, _options) do
    target = arguments.target
    node_name = target.node_name || target["node_name"]
    rollout_id = arguments.rollout_id

    placement =
      Orchestra.Fleet.list_placements!()
      |> Enum.find(&(&1.rollout_id == rollout_id and &1.node_name == node_name))

    placement
    |> Ash.Changeset.for_update(:update, %{undos: placement.undos + 1, status: :released})
    |> Ash.update!()

    Orchestra.Rollout.Trace.record(:deploy_undo, node_name)

    :ok
  end
end
