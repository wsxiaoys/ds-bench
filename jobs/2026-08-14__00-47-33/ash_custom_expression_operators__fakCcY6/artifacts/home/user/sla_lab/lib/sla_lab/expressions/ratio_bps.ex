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
  def ratio_bps(numerator, denominator) when is_integer(numerator) and is_integer(denominator) and denominator > 0 do
    val = (numerator * 10_000) / denominator
    rounded = floor(val + 0.5)
    max(0, min(20_000, rounded))
  end
end
