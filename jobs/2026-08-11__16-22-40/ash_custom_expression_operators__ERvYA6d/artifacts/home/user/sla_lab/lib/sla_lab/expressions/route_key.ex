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

  def route_key(left, right) do
    left = to_str(left)
    right = to_str(right)
    if is_nil(left) or is_nil(right) do
      nil
    else
      left_up = String.upcase(left)
      right_up = String.upcase(right)
      if left_up <= right_up do
        left_up <> "|" <> right_up
      else
        right_up <> "|" <> left_up
      end
    end
  end

  defp to_str(nil), do: nil
  defp to_str(val) when is_binary(val), do: val
  defp to_str(val) when is_atom(val), do: Atom.to_string(val)
  defp to_str(_), do: nil
end
