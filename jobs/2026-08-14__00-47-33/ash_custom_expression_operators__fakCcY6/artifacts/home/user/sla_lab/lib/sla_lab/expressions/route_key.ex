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

  def route_key(nil, _right), do: nil
  def route_key(_left, nil), do: nil
  def route_key(left, right) when is_binary(left) and is_binary(right) do
    left_upper = String.upcase(left)
    right_upper = String.upcase(right)
    if left_upper <= right_upper do
      left_upper <> "|" <> right_upper
    else
      right_upper <> "|" <> left_upper
    end
  end
end
