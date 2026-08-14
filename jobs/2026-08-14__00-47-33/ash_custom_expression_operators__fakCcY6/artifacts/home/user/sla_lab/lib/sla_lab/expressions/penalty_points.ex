defmodule SlaLab.Expressions.PenaltyPoints do
  use Ash.Query.Function, name: :penalty_points

  @impl true
  def args, do: [[:integer, :integer]]

  @impl true
  def returns, do: [:integer]

  @impl true
  def evaluate(%__MODULE__{arguments: [late_hours, weight]}) do
    cond do
      is_integer(late_hours) and is_integer(weight) ->
        cond do
          weight >= 0 ->
            cond do
              late_hours <= 0 ->
                {:known, 0}

              late_hours in 1..24 ->
                {:known, late_hours * weight}

              late_hours > 24 ->
                {:known, 24 * weight + (late_hours - 24) * weight * 2}
            end

          weight < 0 ->
            {:error, "penalty weight must not be negative"}
        end

      true ->
        :unknown
    end
  end
end
