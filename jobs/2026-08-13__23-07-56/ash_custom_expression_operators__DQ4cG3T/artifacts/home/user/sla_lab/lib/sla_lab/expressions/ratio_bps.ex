defmodule SlaLab.Expressions.RatioBps do
  use Ash.CustomExpression,
    name: :ratio_bps,
    arguments: [
      [:integer, :integer]
    ]

  def expression(data_layer, [numerator, denominator]) when data_layer in [
    Ash.DataLayer.Ets,
    Ash.DataLayer.Simple
  ] do
    {:ok, expr(fragment(&__MODULE__.ratio_bps/2, ^numerator, ^denominator))}
  end

  def expression(_data_layer, _args), do: :unknown

  def ratio_bps(nil, _denominator), do: nil
  def ratio_bps(_numerator, nil), do: nil
  def ratio_bps(_numerator, 0), do: nil
  def ratio_bps(numerator, denominator) do
    numerator = if is_integer(numerator), do: numerator, else: to_integer(numerator)
    denominator = if is_integer(denominator), do: denominator, else: to_integer(denominator)
    if numerator == nil or denominator == nil or denominator == 0 do
      nil
    else
      val = (numerator * 10_000) / denominator
      rounded = floor(val + 0.5)
      cond do
        rounded < 0 -> 0
        rounded > 20_000 -> 20_000
        true -> rounded
      end
    end
  end

  defp to_integer(nil), do: nil
  defp to_integer(val) when is_integer(val), do: val
  defp to_integer(val) when is_float(val), do: trunc(val)
  defp to_integer(val) when is_binary(val) do
    case Integer.parse(val) do
      {int, _} -> int
      _ -> nil
    end
  end
  defp to_integer(_), do: nil
end
