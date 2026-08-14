defmodule Ledger.Money.Type do
  @moduledoc """
  An Ash.Type representing a Money value.
  """
  use Ash.Type

  @constraints [
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
      type: :pos_integer,
      doc: "Must be a multiple of this value"
    ]
  ]

  @impl true
  def storage_type(_), do: :map

  @impl true
  def constraints, do: @constraints

  @impl true
  def matches_type?(%Ledger.Money{}, _), do: true
  @impl true
  def matches_type?(_, _), do: false

  @impl true
  def cast_input(nil, _), do: {:ok, nil}
  @impl true
  def cast_input(%Ledger.Money{} = money, _), do: {:ok, money}

  @impl true
  def cast_input(map, _) when is_map(map) do
    case extract_map_fields(map) do
      {:ok, currency, amount} ->
        case parse_currency(currency) do
          {:ok, parsed_currency} ->
            case parse_amount(amount) do
              {:ok, parsed_amount} ->
                {:ok, %Ledger.Money{currency: parsed_currency, amount: parsed_amount}}

              {:error, reason} ->
                {:error, amount_error(reason)}
            end

          {:error, rejected_currency} ->
            {:error, [message: "unknown currency", reason: :unknown_currency, currency: rejected_currency]}
        end

      :error ->
        {:error, [message: "invalid money format", reason: :invalid_format]}
    end
  end

  @impl true
  def cast_input(str, _) when is_binary(str) do
    case parse_canonical_string(str) do
      {:ok, money} ->
        {:ok, money}

      {:error, :unknown_currency, rejected_currency} ->
        {:error, [message: "unknown currency", reason: :unknown_currency, currency: rejected_currency]}

      {:error, _reason} ->
        {:error, [message: "invalid money format", reason: :invalid_format]}
    end
  end

  @impl true
  def cast_input(_, _) do
    {:error, [message: "invalid money format", reason: :invalid_format]}
  end

  @impl true
  def cast_stored(nil, _), do: {:ok, nil}

  @impl true
  def cast_stored(map, _) when is_map(map) do
    if Map.has_key?(map, "currency") and Map.has_key?(map, "amount") and map_size(map) == 2 do
      currency = Map.get(map, "currency")
      amount = Map.get(map, "amount")
      if is_binary(currency) and is_integer(amount) do
        case parse_currency(currency) do
          {:ok, parsed_currency} ->
            {:ok, %Ledger.Money{currency: parsed_currency, amount: amount}}

          _ ->
            {:error, [message: "invalid money format", reason: :invalid_format]}
        end
      else
        {:error, [message: "invalid money format", reason: :invalid_format]}
      end
    else
      {:error, [message: "invalid money format", reason: :invalid_format]}
    end
  end

  @impl true
  def cast_stored(_, _) do
    {:error, [message: "invalid money format", reason: :invalid_format]}
  end

  @impl true
  def dump_to_native(nil, _), do: {:ok, nil}

  @impl true
  def dump_to_native(%Ledger.Money{} = money, _) do
    {:ok, %{"currency" => Atom.to_string(money.currency), "amount" => money.amount}}
  end

  @impl true
  def dump_to_native(_, _) do
    {:error, [message: "invalid money format", reason: :invalid_format]}
  end

  @impl true
  def dump_to_embedded(nil, _), do: {:ok, nil}

  @impl true
  def dump_to_embedded(%Ledger.Money{} = money, _) do
    {:ok, %{"currency" => Atom.to_string(money.currency), "amount" => money.amount}}
  end

  @impl true
  def dump_to_embedded(_, _), do: {:error, [message: "invalid money format", reason: :invalid_format]}

  @impl true
  def cast_from_embedded(nil, _), do: {:ok, nil}

  @impl true
  def cast_from_embedded(map, constraints) when is_map(map) do
    # When loading from embedded, keys could be atoms or strings. Let's support both.
    case cast_input(map, constraints) do
      {:ok, money} -> {:ok, money}
      {:error, reason} -> {:error, reason}
    end
  end

  @impl true
  def cast_from_embedded(_, _), do: {:error, [message: "invalid money format", reason: :invalid_format]}

  @impl true
  def equal?(%Ledger.Money{currency: cur, amount: amt}, %Ledger.Money{currency: cur, amount: amt}), do: true
  @impl true
  def equal?(_, _), do: false

  @impl true
  def to_simple_equality_comparable(value), do: value

  @impl true
  def apply_constraints(nil, _), do: {:ok, nil}

  @impl true
  def apply_constraints(%Ledger.Money{} = value, constraints) do
    case check_currencies_constraint(value, constraints[:currencies]) do
      {:error, err} ->
        {:error, err}

      :ok ->
        case check_multiple_of_constraint(value, constraints[:multiple_of]) do
          {:error, err} ->
            {:error, err}

          :ok ->
            case check_min_constraint(value, constraints[:min]) do
              {:error, err} ->
                {:error, err}

              :ok ->
                case check_max_constraint(value, constraints[:max]) do
                  {:error, err} ->
                    {:error, err}

                  :ok ->
                    {:ok, value}
                end
            end
        end
    end
  end

  # Helpers

  defp extract_map_fields(map) do
    cond do
      Map.has_key?(map, :currency) and Map.has_key?(map, :amount) ->
        {:ok, Map.get(map, :currency), Map.get(map, :amount)}

      Map.has_key?(map, "currency") and Map.has_key?(map, "amount") ->
        {:ok, Map.get(map, "currency"), Map.get(map, "amount")}

      true ->
        :error
    end
  end

  defp parse_currency(currency) do
    cond do
      is_atom(currency) ->
        if currency in [:bhd, :eur, :jpy, :usd] do
          {:ok, currency}
        else
          {:error, currency}
        end

      is_binary(currency) ->
        downcased = String.downcase(currency)
        if downcased in ["bhd", "eur", "jpy", "usd"] do
          {:ok, String.to_existing_atom(downcased)}
        else
          {:error, currency}
        end

      true ->
        {:error, currency}
    end
  end

  defp parse_amount(amount) do
    cond do
      is_integer(amount) ->
        {:ok, amount}

      is_float(amount) ->
        {:error, :fractional_minor_units}

      is_binary(amount) ->
        cond do
          amount =~ ~r/^-?[0-9]+$/ ->
            {:ok, String.to_integer(amount)}

          amount =~ ~r/^-?[0-9]+\.[0-9]+$/ ->
            {:error, :fractional_minor_units}

          true ->
            {:error, :invalid_format}
        end

      true ->
        {:error, :invalid_format}
    end
  end

  defp amount_error(:fractional_minor_units) do
    [message: "amount must be a whole number of minor units", reason: :fractional_minor_units]
  end

  defp amount_error(:invalid_format) do
    [message: "invalid money format", reason: :invalid_format]
  end

  defp parse_canonical_string(str) do
    case String.split(str, " ") do
      [code, rest] ->
        norm_code = String.downcase(code)
        if norm_code in ["bhd", "eur", "jpy", "usd"] do
          currency_atom = String.to_existing_atom(norm_code)
          exp = Ledger.Money.exponent(currency_atom)
          if exp == 0 do
            if rest =~ ~r/^-?[0-9]+$/ do
              {:ok, %Ledger.Money{currency: currency_atom, amount: String.to_integer(rest)}}
            else
              {:error, :invalid_format}
            end
          else
            case Regex.run(~r/^(-?)([0-9]+)\.([0-9]+)$/, rest) do
              [_, sign, major_str, minor_str] ->
                if String.length(minor_str) == exp do
                  major = String.to_integer(major_str)
                  minor = String.to_integer(minor_str)
                  divisor = case exp do
                    2 -> 100
                    3 -> 1000
                  end
                  amount = major * divisor + minor
                  amount = if sign == "-", do: -amount, else: amount
                  {:ok, %Ledger.Money{currency: currency_atom, amount: amount}}
                else
                  {:error, :invalid_format}
                end

              _ ->
                {:error, :invalid_format}
            end
          end
        else
          {:error, :unknown_currency, code}
        end

      _ ->
        {:error, :invalid_format}
    end
  end

  # Constraint checks

  defp check_currencies_constraint(value, allowed_currencies) do
    if allowed_currencies do
      if value.currency in allowed_currencies do
        :ok
      else
        {:error, [message: "currency is not allowed", reason: :currency_not_allowed, currency: value.currency]}
      end
    else
      :ok
    end
  end

  defp check_multiple_of_constraint(value, multiple_of) do
    if multiple_of do
      if rem(value.amount, multiple_of) == 0 do
        :ok
      else
        {:error, [message: "must be a multiple of %{multiple_of} minor units", reason: :not_multiple_of, multiple_of: multiple_of]}
      end
    else
      :ok
    end
  end

  defp check_min_constraint(value, min_bound) do
    if min_bound do
      case cast_input(min_bound, []) do
        {:ok, min_money} ->
          if min_money.currency != value.currency do
            {:error, [message: "cannot compare money in different currencies", reason: :currency_mismatch]}
          else
            if Ledger.Money.compare(value, min_money) == :lt do
              {:error, [message: "must be greater than or equal to %{min}", reason: :below_min, min: Ledger.Money.to_string(min_money)]}
            else
              :ok
            end
          end

        _ ->
          :ok
      end
    else
      :ok
    end
  end

  defp check_max_constraint(value, max_bound) do
    if max_bound do
      case cast_input(max_bound, []) do
        {:ok, max_money} ->
          if max_money.currency != value.currency do
            {:error, [message: "cannot compare money in different currencies", reason: :currency_mismatch]}
          else
            if Ledger.Money.compare(value, max_money) == :gt do
              {:error, [message: "must be less than or equal to %{max}", reason: :above_max, max: Ledger.Money.to_string(max_money)]}
            else
              :ok
            end
          end

        _ ->
          :ok
      end
    else
      :ok
    end
  end
end
