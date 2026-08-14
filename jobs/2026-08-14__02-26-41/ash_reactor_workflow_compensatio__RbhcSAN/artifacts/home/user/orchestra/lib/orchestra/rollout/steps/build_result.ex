defmodule Orchestra.Rollout.Steps.BuildResult do
  use Reactor.Step

  @impl true
  def run(arguments, _context, _options) do
    rollout = arguments.rollout
    approval = arguments.approval
    plan = arguments.plan

    summary = "Rollout #{rollout.name} deployed #{plan.target_count} node(s) in #{rollout.strategy} mode with #{approval.level} approval."

    result = %{
      rollout_id: rollout.id,
      status: :succeeded,
      deployed_nodes: plan.node_names,
      total_slots: plan.total_slots,
      approval_level: approval.level,
      summary: summary
    }

    {:ok, result}
  end
end
