defmodule SlaLab.Expressions.PenaltyPoints do
  use Ash.Query.Function, name: :penalty_points

  def args, do: [[:integer, :integer]]
  def returns, do: [:integer]

  def evaluate(%{arguments: [late_hours, weight]}) do
    cond do
      is_nil(late_hours) or is_nil(weight) ->
        {:known, nil}

      is_integer(late_hours) and is_integer(weight) ->
        if weight >= 0 do
          val =
            cond do
              late_hours <= 0 -> 0
              late_hours <= 24 -> late_hours * weight
              true -> 24 * weight + (late_hours - 24) * weight * 2
            end
          {:known, val}
        else
          {:error, "penalty weight must not be negative"}
        end

      true ->
        :unknown
    end
  end
end
