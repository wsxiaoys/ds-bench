defmodule SlaLab.Expressions.PenaltyPoints do
  use Ash.Query.Function, name: :penalty_points

  @impl Ash.Query.Function
  def args, do: [[:integer, :integer]]

  @impl Ash.Query.Function
  def returns, do: [:integer]

  @impl Ash.Query.Function
  def evaluate(%__MODULE__{arguments: [late_hours, weight]}) do
    cond do
      not is_integer(late_hours) or not is_integer(weight) ->
        :unknown

      weight < 0 ->
        {:error, "penalty weight must not be negative"}

      late_hours <= 0 ->
        {:known, 0}

      late_hours in 1..24 ->
        {:known, late_hours * weight}

      late_hours > 24 ->
        {:known, 24 * weight + (late_hours - 24) * weight * 2}
    end
  end
end
