defmodule Ledger.Money.Type do
  @moduledoc """
  An Ash.Type implementation for Ledger.Money.
  """
  use Ash.Type

  @impl true
  def storage_type(_constraints), do: :map

  @impl true
  def constraints do
    [
      currencies: [
        type: {:list, :atom},
        doc: "Allowed currencies"
      ],
      min: [
        type: :any,
        doc: "Minimum bound"
      ],
      max: [
        type: :any,
        doc: "Maximum bound"
      ],
      multiple_of: [
        type: :integer,
        doc: "Multiple of"
      ]
    ]
  end

  @impl true
  def cast_input(nil, _constraints), do: {:ok, nil}
  def cast_input(%Ledger.Money{} = money, _constraints), do: {:ok, money}
  def cast_input(string, _constraints) when is_binary(string) do
    parts = String.split(string, " ")
    first_part = hd(parts)
    case parse_currency(first_part) do
      {:ok, currency_atom} ->
        case parts do
          [^first_part, amount_str] ->
            case parse_canonical_amount(amount_str, currency_atom) do
              {:ok, amount_minor} ->
                {:ok, %Ledger.Money{amount: amount_minor, currency: currency_atom}}
              {:error, reason} ->
                {:error, reason}
            end
          _ ->
            {:error, [message: "invalid money format", reason: :invalid_format]}
        end
      {:error, reason} ->
        {:error, reason}
    end
  end
  def cast_input(map, _constraints) when is_map(map) do
    case extract_map_fields(map) do
      {:ok, raw_currency, raw_amount} ->
        case parse_currency(raw_currency) do
          {:ok, currency_atom} ->
            case parse_map_amount(raw_amount) do
              {:ok, amount_minor} ->
                {:ok, %Ledger.Money{amount: amount_minor, currency: currency_atom}}
              {:error, reason} ->
                {:error, reason}
            end
          {:error, reason} ->
            {:error, reason}
        end
      :error ->
        {:error, [message: "invalid money format", reason: :invalid_format]}
    end
  end
  def cast_input(_other, _constraints) do
    {:error, [message: "invalid money format", reason: :invalid_format]}
  end

  @impl true
  def cast_stored(nil, _constraints), do: {:ok, nil}
  def cast_stored(%{"amount" => amount, "currency" => currency_str}, _constraints) when is_integer(amount) and is_binary(currency_str) do
    case parse_currency(currency_str) do
      {:ok, currency_atom} ->
        {:ok, %Ledger.Money{amount: amount, currency: currency_atom}}
      _ ->
        {:error, [message: "invalid money format", reason: :invalid_format]}
    end
  end
  def cast_stored(_, _constraints) do
    {:error, [message: "invalid money format", reason: :invalid_format]}
  end

  @impl true
  def dump_to_native(nil, _constraints), do: {:ok, nil}
  def dump_to_native(%Ledger.Money{amount: amount, currency: currency}, _constraints) do
    {:ok, %{"amount" => amount, "currency" => Atom.to_string(currency)}}
  end
  def dump_to_native(_, _constraints), do: {:error, :invalid_format}

  @impl true
  def dump_to_embedded(value, constraints), do: dump_to_native(value, constraints)

  @impl true
  def cast_from_embedded(value, constraints), do: cast_stored(value, constraints)

  @impl true
  def apply_constraints(nil, _constraints), do: :ok
  def apply_constraints(money, constraints) do
    with :ok <- check_currency_constraint(money, constraints),
         :ok <- check_multiple_of_constraint(money, constraints),
         :ok <- check_min_constraint(money, constraints),
         :ok <- check_max_constraint(money, constraints) do
      {:ok, money}
    else
      {:error, keyword} -> {:error, keyword}
    end
  end

  defp check_currency_constraint(money, constraints) do
    case Keyword.fetch(constraints, :currencies) do
      {:ok, allowed_currencies} ->
        if money.currency in allowed_currencies do
          :ok
        else
          {:error, [message: "currency is not allowed", reason: :currency_not_allowed, currency: money.currency]}
        end
      :error ->
        :ok
    end
  end

  defp check_multiple_of_constraint(money, constraints) do
    case Keyword.fetch(constraints, :multiple_of) do
      {:ok, multiple_of} ->
        if rem(money.amount, multiple_of) == 0 do
          :ok
        else
          {:error, [message: "must be a multiple of %{multiple_of} minor units", reason: :not_multiple_of, multiple_of: multiple_of]}
        end
      :error ->
        :ok
    end
  end

  defp check_min_constraint(money, constraints) do
    case Keyword.fetch(constraints, :min) do
      {:ok, min_input} ->
        case cast_input(min_input, []) do
          {:ok, min_money} ->
            if min_money.currency == money.currency do
              if money.amount >= min_money.amount do
                :ok
              else
                {:error, [message: "must be greater than or equal to %{min}", reason: :below_min, min: Ledger.Money.to_string(min_money)]}
              end
            else
              {:error, [message: "cannot compare money in different currencies", reason: :currency_mismatch]}
            end
          _ ->
            raise ArgumentError, "Invalid min constraint value: #{inspect(min_input)}"
        end
      :error ->
        :ok
    end
  end

  defp check_max_constraint(money, constraints) do
    case Keyword.fetch(constraints, :max) do
      {:ok, max_input} ->
        case cast_input(max_input, []) do
          {:ok, max_money} ->
            if max_money.currency == money.currency do
              if money.amount <= max_money.amount do
                :ok
              else
                {:error, [message: "must be less than or equal to %{max}", reason: :above_max, max: Ledger.Money.to_string(max_money)]}
              end
            else
              {:error, [message: "cannot compare money in different currencies", reason: :currency_mismatch]}
            end
          _ ->
            raise ArgumentError, "Invalid max constraint value: #{inspect(max_input)}"
        end
      :error ->
        :ok
    end
  end

  defp parse_currency(nil), do: {:error, [message: "invalid money format", reason: :invalid_format]}
  defp parse_currency(atom) when is_atom(atom) do
    case atom do
      :bhd -> {:ok, :bhd}
      :eur -> {:ok, :eur}
      :jpy -> {:ok, :jpy}
      :usd -> {:ok, :usd}
      other -> {:error, [message: "unknown currency", reason: :unknown_currency, currency: other]}
    end
  end
  defp parse_currency(string) when is_binary(string) do
    case String.upcase(string) do
      "BHD" -> {:ok, :bhd}
      "EUR" -> {:ok, :eur}
      "JPY" -> {:ok, :jpy}
      "USD" -> {:ok, :usd}
      _ -> {:error, [message: "unknown currency", reason: :unknown_currency, currency: string]}
    end
  end
  defp parse_currency(other), do: {:error, [message: "unknown currency", reason: :unknown_currency, currency: other]}

  defp parse_canonical_amount(amount_str, currency_atom) do
    exp = Ledger.Money.exponent(currency_atom)
    if exp == 0 do
      cond do
        amount_str =~ ~r/^-?[0-9]+$/ ->
          {:ok, String.to_integer(amount_str)}
        amount_str =~ ~r/^-?[0-9]+\.[0-9]+$/ ->
          {:error, [message: "amount must be a whole number of minor units", reason: :fractional_minor_units]}
        true ->
          {:error, [message: "invalid money format", reason: :invalid_format]}
      end
    else
      cond do
        amount_str =~ ~r/^-?[0-9]+\.[0-9]+$/ ->
          [integer_part, fractional_part] = String.split(amount_str, ".")
          if String.length(fractional_part) == exp do
            int_val = String.to_integer(integer_part)
            fraction_val = String.to_integer(fractional_part)
            total_minor = if String.starts_with?(integer_part, "-") do
              int_val * pow10(exp) - fraction_val
            else
              int_val * pow10(exp) + fraction_val
            end
            {:ok, total_minor}
          else
            {:error, [message: "invalid money format", reason: :invalid_format]}
          end
        amount_str =~ ~r/^-?[0-9]+$/ ->
          {:error, [message: "invalid money format", reason: :invalid_format]}
        true ->
          {:error, [message: "invalid money format", reason: :invalid_format]}
      end
    end
  end

  defp parse_map_amount(amount) when is_integer(amount), do: {:ok, amount}
  defp parse_map_amount(amount) when is_float(amount) do
    {:error, [message: "amount must be a whole number of minor units", reason: :fractional_minor_units]}
  end
  defp parse_map_amount(amount) when is_binary(amount) do
    cond do
      amount =~ ~r/^-?[0-9]+$/ ->
        {:ok, String.to_integer(amount)}
      amount =~ ~r/^-?[0-9]+\.[0-9]+$/ ->
        {:error, [message: "amount must be a whole number of minor units", reason: :fractional_minor_units]}
      true ->
        {:error, [message: "invalid money format", reason: :invalid_format]}
    end
  end
  defp parse_map_amount(_other) do
    {:error, [message: "invalid money format", reason: :invalid_format]}
  end

  defp extract_map_fields(map) when is_map(map) do
    cond do
      Map.has_key?(map, :currency) and Map.has_key?(map, :amount) ->
        {:ok, Map.get(map, :currency), Map.get(map, :amount)}
      Map.has_key?(map, "currency") and Map.has_key?(map, "amount") ->
        {:ok, Map.get(map, "currency"), Map.get(map, "amount")}
      true ->
        :error
    end
  end

  defp pow10(0), do: 1
  defp pow10(1), do: 10
  defp pow10(2), do: 100
  defp pow10(3), do: 1000
end
