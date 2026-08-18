defmodule Orchestra.Rollout.Steps.IsBoardApproval do
  use Reactor.Step

  @impl true
  def run(arguments, _context, _options) do
    total_slots = Map.fetch!(arguments, :total_slots)
    board_threshold = Map.fetch!(arguments, :board_threshold)
    {:ok, total_slots >= board_threshold}
  end
end
