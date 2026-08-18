defmodule Ledger.MoneyTest do
  use ExUnit.Case
  require Ash.Query

  alias Ledger.Money
  alias Ledger.Money.Type
  alias Ledger.Billing
  alias Ledger.Billing.Invoice

  setup do
    # Ensure Ets tables are cleared or clean before each test
    # Ets tables are process-private, so they should be clean for each test process.
    :ok
  end

  describe "1. Ledger.Money Basic API" do
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
      assert {:ok, %Money{amount: 1250, currency: :usd}} = Money.new(1250, :usd)
      assert {:ok, %Money{amount: 1250, currency: :usd}} = Money.new(1250, "usd")
      assert {:ok, %Money{amount: 1250, currency: :usd}} = Money.new(1250, "USD")

      assert {:error, :invalid_amount} = Money.new(12.5, :usd)
      assert {:error, :unknown_currency} = Money.new(1250, :invalid)
      # Currency is resolved before amount
      assert {:error, :unknown_currency} = Money.new(12.5, :invalid)

      assert %Money{amount: 1250, currency: :usd} = Money.new!(1250, :usd)
      assert_raise ArgumentError, fn ->
        Money.new!(12.5, :usd)
      end
    end

    test "zero/1" do
      assert %Money{amount: 0, currency: :usd} = Money.zero(:usd)
    end

    test "add/2 and subtract/2" do
      m1 = Money.new!(100, :usd)
      m2 = Money.new!(200, :usd)
      m3 = Money.new!(150, :eur)

      assert {:ok, %Money{amount: 300, currency: :usd}} = Money.add(m1, m2)
      assert {:error, :currency_mismatch} = Money.add(m1, m3)

      assert {:ok, %Money{amount: -100, currency: :usd}} = Money.subtract(m1, m2)
      assert {:error, :currency_mismatch} = Money.subtract(m1, m3)
    end

    test "multiply/2" do
      m = Money.new!(100, :usd)
      assert {:ok, %Money{amount: 300, currency: :usd}} = Money.multiply(m, 3)
      assert {:error, :invalid_factor} = Money.multiply(m, 2.5)
    end

    test "sum/2" do
      m1 = Money.new!(100, :usd)
      m2 = Money.new!(200, :usd)
      assert {:ok, %Money{amount: 300, currency: :usd}} = Money.sum([m1, m2], :usd)
      assert {:ok, %Money{amount: 0, currency: :usd}} = Money.sum([], :usd)
      assert {:error, :currency_mismatch} = Money.sum([m1, Money.new!(50, :eur)], :usd)
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

    test "to_string/1 and String.Chars protocol" do
      assert to_string(Money.new!(1250, :usd)) == "USD 12.50"
      assert to_string(Money.new!(-5, :usd)) == "USD -0.05"
      assert to_string(Money.new!(0, :usd)) == "USD 0.00"
      assert to_string(Money.new!(500, :jpy)) == "JPY 500"
      assert to_string(Money.new!(-7, :jpy)) == "JPY -7"
      assert to_string(Money.new!(1234, :bhd)) == "BHD 1.234"
      assert to_string(Money.new!(-1, :bhd)) == "BHD -0.001"
    end
  end

  describe "2. Ash Type - Ledger.Money.Type casting" do
    test "cast_input/2 nil" do
      assert {:ok, nil} = Ash.Type.cast_input(Type, nil)
    end

    test "cast_input/2 struct" do
      money = Money.new!(100, :usd)
      assert {:ok, ^money} = Ash.Type.cast_input(Type, money)
    end

    test "cast_input/2 map" do
      assert {:ok, %Money{amount: 100, currency: :usd}} = Ash.Type.cast_input(Type, %{amount: 100, currency: :usd})
      assert {:ok, %Money{amount: 100, currency: :usd}} = Ash.Type.cast_input(Type, %{"amount" => 100, "currency" => "usd"})
      assert {:ok, %Money{amount: 100, currency: :usd}} = Ash.Type.cast_input(Type, %{"amount" => "100", "currency" => "USD"})

      assert {:error, [message: "unknown currency", reason: :unknown_currency, currency: :invalid]} =
               Ash.Type.cast_input(Type, %{amount: 100, currency: :invalid})

      # Currency resolved before amount
      assert {:error, [message: "unknown currency", reason: :unknown_currency, currency: :invalid]} =
               Ash.Type.cast_input(Type, %{amount: 12.5, currency: :invalid})

      assert {:error, [message: "amount must be a whole number of minor units", reason: :fractional_minor_units]} =
               Ash.Type.cast_input(Type, %{amount: 12.5, currency: :usd})

      assert {:error, [message: "amount must be a whole number of minor units", reason: :fractional_minor_units]} =
               Ash.Type.cast_input(Type, %{amount: "12.5", currency: :usd})

      assert {:error, [message: "invalid money format", reason: :invalid_format]} =
               Ash.Type.cast_input(Type, %{currency: :usd})
    end

    test "cast_input/2 canonical string" do
      assert {:ok, %Money{amount: 1250, currency: :usd}} = Ash.Type.cast_input(Type, "USD 12.50")
      assert {:ok, %Money{amount: -5, currency: :usd}} = Ash.Type.cast_input(Type, "USD -0.05")
      assert {:ok, %Money{amount: 500, currency: :jpy}} = Ash.Type.cast_input(Type, "JPY 500")

      assert {:error, [message: "unknown currency", reason: :unknown_currency, currency: "INVALID"]} =
               Ash.Type.cast_input(Type, "INVALID 12.50")

      assert {:error, [message: "unknown currency", reason: :unknown_currency, currency: "INVALID"]} =
               Ash.Type.cast_input(Type, "INVALID")

      assert {:error, [message: "invalid money format", reason: :invalid_format]} =
               Ash.Type.cast_input(Type, "USD 12.5")

      assert {:error, [message: "invalid money format", reason: :invalid_format]} =
               Ash.Type.cast_input(Type, "USD")
    end

    test "round-trip storage and Jason" do
      money = Money.new!(1250, :usd)
      assert {:ok, stored} = Ash.Type.dump_to_native(Type, money)
      assert {:ok, json} = Jason.encode(stored)
      assert {:ok, decoded} = Jason.decode(json)
      assert {:ok, ^money} = Ash.Type.cast_stored(Type, decoded)
    end
  end

  describe "3. Constraints" do
    test "currencies constraint" do
      # allowed: :usd, :eur
      constraints = [currencies: [:usd, :eur]]
      money_usd = Money.new!(100, :usd)
      money_jpy = Money.new!(100, :jpy)

      assert {:ok, ^money_usd} = Ash.Type.apply_constraints(Type, money_usd, constraints)
      assert {:error, [message: "currency is not allowed", reason: :currency_not_allowed, currency: :jpy]} =
               Ash.Type.apply_constraints(Type, money_jpy, constraints)
    end

    test "multiple_of constraint" do
      constraints = [multiple_of: 5]
      m1 = Money.new!(10, :usd)
      m2 = Money.new!(12, :usd)

      assert {:ok, ^m1} = Ash.Type.apply_constraints(Type, m1, constraints)
      assert {:error, [message: "must be a multiple of %{multiple_of} minor units", reason: :not_multiple_of, multiple_of: 5]} =
               Ash.Type.apply_constraints(Type, m2, constraints)
    end

    test "min and max constraints" do
      constraints = [min: "USD 1.00", max: "USD 10.00"]
      m_ok = Money.new!(500, :usd)
      m_low = Money.new!(50, :usd)
      m_high = Money.new!(1200, :usd)
      m_diff = Money.new!(500, :eur)

      assert {:ok, ^m_ok} = Ash.Type.apply_constraints(Type, m_ok, constraints)

      assert {:error, [message: "must be greater than or equal to %{min}", reason: :below_min, min: "USD 1.00"]} =
               Ash.Type.apply_constraints(Type, m_low, constraints)

      assert {:error, [message: "must be less than or equal to %{max}", reason: :above_max, max: "USD 10.00"]} =
               Ash.Type.apply_constraints(Type, m_high, constraints)

      assert {:error, [message: "cannot compare money in different currencies", reason: :currency_mismatch]} =
               Ash.Type.apply_constraints(Type, m_diff, constraints)
    end
  end

  describe "4. Narrowed type Ledger.Money.Usd" do
    test "violating Usd bounds" do
      # Ledger.Money.Usd bakes in min: "USD 0.00", max: "USD 10000.00", currencies: [:usd]
      # Let's verify that applying constraints via Ledger.Money.Usd enforces these bounds
      m_ok = Money.new!(500, :usd)
      m_neg = Money.new!(-1, :usd)
      m_high = Money.new!(1000001, :usd)
      m_eur = Money.new!(500, :eur)

      # Ash.Type.apply_constraints/3 can be used with Ledger.Money.Usd
      # Wait, let's see: Ledger.Money.Usd is a NewType, so we get its constraints and type.
      # Let's check how NewType applies constraints.
      {:ok, constraints} = Ash.Type.init(Ledger.Money.Usd, [])
      assert {:ok, ^m_ok} = Ash.Type.apply_constraints(Ledger.Money.Usd, m_ok, constraints)

      assert {:error, [message: "must be greater than or equal to %{min}", reason: :below_min, min: "USD 0.00"]} =
               Ash.Type.apply_constraints(Ledger.Money.Usd, m_neg, constraints)

      assert {:error, [message: "must be less than or equal to %{max}", reason: :above_max, max: "USD 10000.00"]} =
               Ash.Type.apply_constraints(Ledger.Money.Usd, m_high, constraints)

      assert {:error, [message: "currency is not allowed", reason: :currency_not_allowed, currency: :eur]} =
               Ash.Type.apply_constraints(Ledger.Money.Usd, m_eur, constraints)
    end
  end

  describe "5. Domain code interface and billing resources" do
    test "issue_invoice and calculations" do
      # Create an invoice
      assert {:ok, invoice} = Billing.issue_invoice(%{
        reference: "INV-001",
        subtotal: "USD 100.00",
        adjustments: ["USD 5.00", "USD -10.00"],
        credit_limit: "USD 500.00"
      })

      assert invoice.reference == "INV-001"
      assert invoice.subtotal == Money.new!(10000, :usd)
      assert invoice.adjustments == [Money.new!(500, :usd), Money.new!(-1000, :usd)]
      assert invoice.credit_limit == Money.new!(50000, :usd)

      # Load calculations and aggregates
      assert {:ok, invoice} = Ash.load(invoice, [:total, :paid_minor, :balance])
      # subtotal 100.00 + 5.00 - 10.00 = 95.00
      assert invoice.total == Money.new!(9500, :usd)
      assert invoice.paid_minor == 0
      assert invoice.balance == Money.new!(9500, :usd)
    end

    test "mismatched adjustments currency on issue" do
      assert {:error, %Ash.Error.Invalid{errors: [err]}} = Billing.issue_invoice(%{
        reference: "INV-002",
        subtotal: "USD 100.00",
        adjustments: ["EUR 5.00"]
      })
      assert err.field == :adjustments
      assert err.message == "must all use the currency of the subtotal"
    end

    test "apply_adjustment action" do
      invoice = Billing.issue_invoice!(%{
        reference: "INV-003",
        subtotal: "USD 100.00",
        adjustments: []
      })

      # Valid adjustment
      {:ok, updated} = Billing.apply_adjustment(invoice, Money.new!(1500, :usd))
      assert updated.adjustments == [Money.new!(1500, :usd)]

      # Invalid adjustment currency
      assert {:error, %Ash.Error.Invalid{errors: [err]}} = Billing.apply_adjustment(invoice, Money.new!(1500, :eur))
      assert err.class == :invalid
      assert err.field == :adjustment
      assert err.message == "must use the currency of the subtotal"
    end

    test "price_for generic action" do
      assert {:ok, price} = Billing.price_for(Money.new!(1250, :usd), 3)
      assert price == Money.new!(3750, :usd)
    end

    test "record_payment and aggregate updates" do
      invoice = Billing.issue_invoice!(%{
        reference: "INV-004",
        subtotal: "USD 100.00",
        adjustments: []
      })

      assert {:ok, payment1} = Billing.record_payment(%{
        amount: "USD 30.00",
        invoice_id: invoice.id
      })

      assert payment1.amount_minor == 3000
      assert payment1.amount_currency == :usd

      assert {:ok, _payment2} = Billing.record_payment(%{
        amount: "USD 20.00",
        invoice_id: invoice.id
      })

      # Reload invoice and check aggregate and balance
      {:ok, invoice} = Billing.get_invoice(invoice.id)
      {:ok, invoice} = Ash.load(invoice, [:total, :paid_minor, :balance])

      assert invoice.total == Money.new!(10000, :usd)
      assert invoice.paid_minor == 5000
      assert invoice.balance == Money.new!(5000, :usd)
    end
  end

  describe "6. Querying and sorting" do
    test "ascending and descending sort on subtotal" do
      # Create invoices of the same currency with different subtotal amounts
      _inv1 = Billing.issue_invoice!(%{reference: "A", subtotal: "USD 100.00"})
      _inv2 = Billing.issue_invoice!(%{reference: "B", subtotal: "USD 9.00"})
      _inv3 = Billing.issue_invoice!(%{reference: "C", subtotal: "USD 150.00"})

      # Read sorted ascending
      query_asc = Ash.Query.sort(Invoice, subtotal: :asc)
      {:ok, results_asc} = Ash.read(query_asc)
      references_asc = Enum.map(results_asc, & &1.reference)
      # "USD 9.00" comes before "USD 100.00" and "USD 150.00"
      assert references_asc == ["B", "A", "C"]

      # Read sorted descending
      query_desc = Ash.Query.sort(Invoice, subtotal: :desc)
      {:ok, results_desc} = Ash.read(query_desc)
      references_desc = Enum.map(results_desc, & &1.reference)
      assert references_desc == ["C", "A", "B"]
    end

    test "equality filter on subtotal" do
      _inv1 = Billing.issue_invoice!(%{reference: "A", subtotal: "USD 100.00"})
      _inv2 = Billing.issue_invoice!(%{reference: "B", subtotal: "USD 9.00"})

      # Filter matches both currency and amount
      target_money = Money.new!(10000, :usd)
      query = Ash.Query.filter(Invoice, subtotal == ^target_money)
      {:ok, results} = Ash.read(query)
      assert length(results) == 1
      assert hd(results).reference == "A"

      # Mismatched currency does not match
      diff_money = Money.new!(10000, :eur)
      query_diff = Ash.Query.filter(Invoice, subtotal == ^diff_money)
      {:ok, results_diff} = Ash.read(query_diff)
      assert results_diff == []
    end
  end
end
