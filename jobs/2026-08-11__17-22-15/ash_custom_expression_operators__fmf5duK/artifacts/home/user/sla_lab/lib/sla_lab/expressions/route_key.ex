defmodule SlaLab.Expressions.RouteKey do
  use Ash.CustomExpression,
    name: :route_key,
    arguments: [
      [:string, :string]
    ]

  def expression(data_layer, [left, right]) when data_layer in [
    Ash.DataLayer.Ets,
    Ash.DataLayer.Simple
  ] do
    {:ok, expr(fragment(&__MODULE__.route_key/2, ^left, ^right))}
  end

  def expression(_data_layer, _args), do: :unknown

  def route_key(nil, _), do: nil
  def route_key(_, nil), do: nil
  def route_key(left, right) do
    left_str = left |> to_string() |> String.upcase()
    right_str = right |> to_string() |> String.upcase()
    if left_str <= right_str do
      left_str <> "|" <> right_str
    else
      right_str <> "|" <> left_str
    end
  end
end
