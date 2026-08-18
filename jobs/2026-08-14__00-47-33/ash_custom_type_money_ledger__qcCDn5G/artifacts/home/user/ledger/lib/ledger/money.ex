defmodule Ledger.Money do
  @moduledoc """
  A first-class money type.
  """
  @enforce_keys [:currency, :amount]
  defstruct [:currency, :amount]

  @currencies [:bhd, :eur, :jpy, :usd]
  @exponents %{bhd: 3, eur: 2, jpy: 0, usd: 2}

  def currencies, do: @currencies

  def exponent(currency) when currency in @currencies, do: Map.fetch!(@exponents, currency)

  def new(amount, currency) do
    cond do
      currency not in @currencies ->
        {:error, :unknown_currency}

      not is_integer(amount) ->
        {:error, :invalid_amount}

      true ->
        {:ok, %__MODULE__{currency: currency, amount: amount}}
    end
  end

  def new!(amount, currency) do
    case new(amount, currency) do
      {:ok, money} -> money
      {:error, reason} -> raise ArgumentError, "invalid money: #{inspect(reason)}"
    end
  end

  def zero(currency) do
    new!(0, currency)
  end

  def add(%__MODULE__{currency: cur, amount: amt1}, %__MODULE__{currency: cur, amount: amt2}) do
    {:ok, %__MODULE__{currency: cur, amount: amt1 + amt2}}
  end
  def add(%__MODULE__{}, %__MODULE__{}) do
    {:error, :currency_mismatch}
  end

  def subtract(%__MODULE__{currency: cur, amount: amt1}, %__MODULE__{currency: cur, amount: amt2}) do
    {:ok, %__MODULE__{currency: cur, amount: amt1 - amt2}}
  end
  def subtract(%__MODULE__{}, %__MODULE__{}) do
    {:error, :currency_mismatch}
  end

  def multiply(%__MODULE__{currency: cur, amount: amt}, factor) when is_integer(factor) do
    {:ok, %__MODULE__{currency: cur, amount: amt * factor}}
  end
  def multiply(%__MODULE__{}, _factor) do
    {:error, :invalid_factor}
  end

  def sum(list_of_money, currency) do
    if currency not in @currencies do
      {:error, :unknown_currency}
    else
      Enum.reduce_while(list_of_money, {:ok, zero(currency)}, fn
        %__MODULE__{currency: ^currency, amount: amt}, {:ok, acc} ->
          {:cont, {:ok, %__MODULE__{currency: currency, amount: acc.amount + amt}}}

        _, _ ->
          {:halt, {:error, :currency_mismatch}}
      end)
    end
  end

  def compare(%__MODULE__{currency: cur, amount: amt1}, %__MODULE__{currency: cur, amount: amt2}) do
    cond do
      amt1 < amt2 -> :lt
      amt1 == amt2 -> :eq
      amt1 > amt2 -> :gt
    end
  end
  def compare(%__MODULE__{}, %__MODULE__{}) do
    raise ArgumentError, "cannot compare money in different currencies"
  end

  def to_string(%__MODULE__{currency: currency, amount: amount}) do
    code = String.upcase("#{currency}")
    exp = exponent(currency)
    if exp == 0 do
      "#{code} #{amount}"
    else
      abs_amount = abs(amount)
      divisor = case exp do
        2 -> 100
        3 -> 1000
      end
      major = div(abs_amount, divisor)
      minor = rem(abs_amount, divisor)
      minor_str = String.pad_leading("#{minor}", exp, "0")
      sign = if amount < 0, do: "-", else: ""
      "#{code} #{sign}#{major}.#{minor_str}"
    end
  end
end

defimpl String.Chars, for: Ledger.Money do
  def to_string(money), do: Ledger.Money.to_string(money)
end

defimpl Jason.Encoder, for: Ledger.Money do
  def encode(money, opts) do
    Jason.Encode.map(%{"currency" => Atom.to_string(money.currency), "amount" => money.amount}, opts)
  end
end
