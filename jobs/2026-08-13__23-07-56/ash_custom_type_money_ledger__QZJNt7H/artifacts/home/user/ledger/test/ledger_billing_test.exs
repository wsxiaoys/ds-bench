defmodule LedgerBillingTest do
  use ExUnit.Case

  require Ash.Query

  alias Ledger.Money
  alias Ledger.Money.Type, as: MoneyType
  alias Ledger.Money.Usd, as: MoneyUsd
  alias Ledger.Billing
  alias Ledger.Billing.Invoice

  setup do
    # Ensure any background tables or processes are clean/started if needed.
    :ok
  end

  describe "1. Ledger.Money API" do
    test "currencies/0" do
      assert Money.currencies() == [:bhd, :eur, :jpy, :usd]
    end

    test "exponent/1" do
      assert Money.exponent(:bhd) == 3
      assert Money.exponent(:eur) == 2
      assert Money.exponent(:jpy) == 0
      assert Money.exponent(:usd) == 2

      assert_raise ArgumentError, fn ->
        Money.exponent(:invalid)
      end
    end

    test "new/2 and new!/2" do
      assert {:ok, %Money{amount: 1000, currency: :usd}} = Money.new(1000, :usd)
      assert {:error, :invalid_amount} = Money.new("1000", :usd)
      assert {:error, :unknown_currency} = Money.new(1000, :invalid)

      # Currency resolved before amount
      assert {:error, :unknown_currency} = Money.new("1000", :invalid)

      assert %Money{amount: 1000, currency: :usd} = Money.new!(1000, :usd)
      assert_raise ArgumentError, fn -> Money.new!(1000, :invalid) end
    end

    test "zero/1" do
      assert Money.zero(:usd) == %Money{amount: 0, currency: :usd}
    end

    test "add/2 and subtract/2" do
      m1 = Money.new!(100, :usd)
      m2 = Money.new!(50, :usd)
      m3 = Money.new!(50, :eur)

      assert {:ok, %Money{amount: 150, currency: :usd}} = Money.add(m1, m2)
      assert {:error, :currency_mismatch} = Money.add(m1, m3)

      assert {:ok, %Money{amount: 50, currency: :usd}} = Money.subtract(m1, m2)
      assert {:error, :currency_mismatch} = Money.subtract(m1, m3)
    end

    test "multiply/2" do
      m = Money.new!(100, :usd)
      assert {:ok, %Money{amount: 300, currency: :usd}} = Money.multiply(m, 3)
      assert {:error, :invalid_factor} = Money.multiply(m, 2.5)
    end

    test "sum/2" do
      list = [Money.new!(100, :usd), Money.new!(200, :usd)]
      assert {:ok, %Money{amount: 300, currency: :usd}} = Money.sum(list, :usd)
      assert {:ok, %Money{amount: 0, currency: :usd}} = Money.sum([], :usd)

      mismatched_list = [Money.new!(100, :usd), Money.new!(200, :eur)]
      assert {:error, :currency_mismatch} = Money.sum(mismatched_list, :usd)
    end

    test "compare/2" do
      m1 = Money.new!(100, :usd)
      m2 = Money.new!(200, :usd)
      m3 = Money.new!(100, :eur)

      assert Money.compare(m1, m2) == :lt
      assert Money.compare(m2, m1) == :gt
      assert Money.compare(m1, m1) == :eq

      assert_raise ArgumentError, fn ->
        Money.compare(m1, m3)
      end
    end

    test "to_string/1" do
      assert Money.to_string(Money.new!(1250, :usd)) == "USD 12.50"
      assert Money.to_string(Money.new!(-5, :usd)) == "USD -0.05"
      assert Money.to_string(Money.new!(0, :usd)) == "USD 0.00"
      assert Money.to_string(Money.new!(500, :jpy)) == "JPY 500"
      assert Money.to_string(Money.new!(-7, :jpy)) == "JPY -7"
      assert Money.to_string(Money.new!(1234, :bhd)) == "BHD 1.234"
      assert Money.to_string(Money.new!(-1, :bhd)) == "BHD -0.001"
    end
  end

  describe "2. Ledger.Money.Type casting and loading" do
    test "cast_input nil, struct, map, string" do
      # nil
      assert {:ok, nil} = Ash.Type.cast_input(MoneyType, nil)

      # struct
      m = Money.new!(100, :usd)
      assert {:ok, ^m} = Ash.Type.cast_input(MoneyType, m)

      # map atom keys
      assert {:ok, %Money{amount: 100, currency: :usd}} =
               Ash.Type.cast_input(MoneyType, %{currency: :usd, amount: 100})

      # map string keys
      assert {:ok, %Money{amount: 100, currency: :usd}} =
               Ash.Type.cast_input(MoneyType, %{"currency" => "usd", "amount" => 100})

      # map string keys with string amount
      assert {:ok, %Money{amount: 100, currency: :usd}} =
               Ash.Type.cast_input(MoneyType, %{"currency" => "usd", "amount" => "100"})

      # canonical string
      assert {:ok, %Money{amount: 1250, currency: :usd}} =
               Ash.Type.cast_input(MoneyType, "USD 12.50")

      assert {:ok, %Money{amount: -5, currency: :usd}} =
               Ash.Type.cast_input(MoneyType, "USD -0.05")

      assert {:ok, %Money{amount: 500, currency: :jpy}} =
               Ash.Type.cast_input(MoneyType, "JPY 500")

      # invalid formats
      assert {:error,
              [message: "unknown currency", reason: :unknown_currency, currency: :invalid]} =
               Ash.Type.cast_input(MoneyType, %{currency: :invalid, amount: 100})

      # Currency resolved first
      assert {:error,
              [message: "unknown currency", reason: :unknown_currency, currency: :invalid]} =
               Ash.Type.cast_input(MoneyType, %{currency: :invalid, amount: 1.5})

      assert {:error,
              [
                message: "amount must be a whole number of minor units",
                reason: :fractional_minor_units
              ]} =
               Ash.Type.cast_input(MoneyType, %{currency: :usd, amount: 1.5})

      assert {:error,
              [
                message: "amount must be a whole number of minor units",
                reason: :fractional_minor_units
              ]} =
               Ash.Type.cast_input(MoneyType, %{currency: :usd, amount: "1.5"})

      # Canonical string invalid fraction digits
      assert {:error, [message: "invalid money format", reason: :invalid_format]} =
               Ash.Type.cast_input(MoneyType, "USD 12.5")
    end

    test "cast_stored and dump_to_native" do
      m = Money.new!(1250, :usd)
      assert {:ok, stored} = Ash.Type.dump_to_native(MoneyType, m)
      assert stored == %{"currency" => "usd", "amount" => 1250}

      # round-trip
      assert {:ok, ^m} = Ash.Type.cast_stored(MoneyType, stored)

      # Jason round-trip
      encoded = Jason.encode!(stored)
      decoded = Jason.decode!(encoded)
      assert {:ok, ^m} = Ash.Type.cast_stored(MoneyType, decoded)

      # invalid stored format
      assert {:error, [message: "invalid money format", reason: :invalid_format]} =
               Ash.Type.cast_stored(MoneyType, %{"currency" => "usd", "amount" => "1250"})
    end

    test "apply_constraints" do
      # currencies
      m_usd = Money.new!(100, :usd)
      m_eur = Money.new!(100, :eur)
      assert {:ok, _} = Ash.Type.apply_constraints(MoneyType, m_usd, currencies: [:usd])

      assert {:error,
              [message: "currency is not allowed", reason: :currency_not_allowed, currency: :eur]} =
               Ash.Type.apply_constraints(MoneyType, m_eur, currencies: [:usd])

      # multiple_of
      assert {:ok, _} =
               Ash.Type.apply_constraints(MoneyType, Money.new!(10, :usd), multiple_of: 5)

      assert {:error,
              [
                message: "must be a multiple of %{multiple_of} minor units",
                reason: :not_multiple_of,
                multiple_of: 5
              ]} =
               Ash.Type.apply_constraints(MoneyType, Money.new!(12, :usd), multiple_of: 5)

      # min and max
      assert {:ok, _} =
               Ash.Type.apply_constraints(MoneyType, Money.new!(100, :usd),
                 min: "USD 0.50",
                 max: "USD 2.00"
               )

      assert {:error,
              [
                message: "must be greater than or equal to %{min}",
                reason: :below_min,
                min: "USD 0.50"
              ]} =
               Ash.Type.apply_constraints(MoneyType, Money.new!(40, :usd), min: "USD 0.50")

      assert {:error,
              [
                message: "must be less than or equal to %{max}",
                reason: :above_max,
                max: "USD 2.00"
              ]} =
               Ash.Type.apply_constraints(MoneyType, Money.new!(250, :usd), max: "USD 2.00")

      # currency mismatch on bound
      assert {:error,
              [
                message: "cannot compare money in different currencies",
                reason: :currency_mismatch
              ]} =
               Ash.Type.apply_constraints(MoneyType, Money.new!(100, :usd), min: "EUR 0.50")
    end
  end

  describe "3. Ledger.Money.Usd narrowed type" do
    test "USD constraints" do
      # valid
      assert {:ok, m} = Ash.Type.cast_input(MoneyUsd, "USD 100.00")
      assert m == Money.new!(10000, :usd)

      # currency not allowed
      assert {:error, _} = Ash.Type.cast_input(MoneyUsd, "EUR 100.00")

      # below min
      assert {:error, _} = Ash.Type.cast_input(MoneyUsd, "USD -1.00")

      # above max
      assert {:error, _} = Ash.Type.cast_input(MoneyUsd, "USD 10001.00")
    end
  end

  describe "4. Billing resources" do
    test "create invoice and record payment" do
      # issue invoice
      {:ok, inv} =
        Billing.issue_invoice(%{
          reference: "INV-001",
          subtotal: "USD 100.00",
          adjustments: ["USD 5.00", "USD -10.00"],
          credit_limit: "USD 500.00"
        })

      assert inv.reference == "INV-001"
      assert inv.subtotal == Money.new!(10000, :usd)
      assert inv.adjustments == [Money.new!(500, :usd), Money.new!(-1000, :usd)]
      assert inv.credit_limit == Money.new!(50000, :usd)

      # calculation :total
      inv = Ash.load!(inv, [:total, :balance])
      # 100.00 + 5.00 - 10.00 = 95.00
      assert inv.total == Money.new!(9500, :usd)
      assert inv.balance == Money.new!(9500, :usd)

      # record payments
      {:ok, _p1} =
        Billing.record_payment(%{
          amount: "USD 40.00",
          invoice_id: inv.id
        })

      {:ok, _p2} =
        Billing.record_payment(%{
          amount: "USD 15.00",
          invoice_id: inv.id
        })

      # reload invoice to check aggregate and calculations
      inv = Billing.get_invoice!(inv.id) |> Ash.load!([:paid_minor, :total, :balance])
      # 4000 + 1500
      assert inv.paid_minor == 5500
      assert inv.total == Money.new!(9500, :usd)
      # 9500 - 5500
      assert inv.balance == Money.new!(4000, :usd)
    end

    test "apply_adjustment action" do
      {:ok, inv} =
        Billing.issue_invoice(%{
          reference: "INV-002",
          subtotal: "EUR 50.00"
        })

      # apply adjustment
      {:ok, inv} = Billing.apply_adjustment(inv, Money.new!(500, :eur))
      assert inv.adjustments == [Money.new!(500, :eur)]

      # apply mismatched adjustment currency
      assert {:error, %Ash.Error.Invalid{errors: [err]}} =
               Billing.apply_adjustment(inv, Money.new!(500, :usd))

      assert err.field == :adjustment
      assert err.message == "must use the currency of the subtotal"

      # verify record untouched
      inv_after = Billing.get_invoice!(inv.id)
      assert inv_after.adjustments == [Money.new!(500, :eur)]
    end

    test "price_for generic action" do
      # 1.50
      unit_price = Money.new!(150, :usd)
      assert {:ok, result} = Billing.price_for(unit_price, 5)
      # 7.50
      assert result == Money.new!(750, :usd)
    end
  end

  describe "5. Querying, sorting, filtering" do
    test "sorting and filtering subtotal" do
      # Clean up existing invoices
      for inv <- Billing.list_invoices!() do
        Ash.destroy!(inv)
      end

      {:ok, _inv1} = Billing.issue_invoice(%{reference: "A", subtotal: "USD 100.00"})
      {:ok, _inv2} = Billing.issue_invoice(%{reference: "B", subtotal: "USD 9.00"})
      {:ok, _inv3} = Billing.issue_invoice(%{reference: "C", subtotal: "USD 50.00"})

      # Ascending sort
      sorted_asc =
        Invoice
        |> Ash.Query.sort(subtotal: :asc)
        |> Ash.read!()

      assert Enum.map(sorted_asc, & &1.reference) == ["B", "C", "A"]

      # Descending sort
      sorted_desc =
        Invoice
        |> Ash.Query.sort(subtotal: :desc)
        |> Ash.read!()

      assert Enum.map(sorted_desc, & &1.reference) == ["A", "C", "B"]

      # Equality filter
      usd_50 = Money.new!(5000, :usd)

      filtered =
        Invoice
        |> Ash.Query.filter(subtotal == ^usd_50)
        |> Ash.read!()

      assert Enum.map(filtered, & &1.reference) == ["C"]
    end
  end
end
