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

  def ratio_bps(numerator, denominator) do
    numerator = to_int(numerator)
    denominator = to_int(denominator)
    if is_nil(numerator) or is_nil(denominator) or denominator == 0 do
      nil
    else
      val = floor((numerator * 10_000 / denominator) + 0.5)
      max(0, min(20_000, val))
    end
  end

  defp to_int(nil), do: nil
  defp to_int(val) when is_integer(val), do: val
  defp to_int(val) when is_float(val), do: round(val)
  defp to_int(%Decimal{} = val), do: Decimal.to_integer(val)
  defp to_int(_), do: nil
end
