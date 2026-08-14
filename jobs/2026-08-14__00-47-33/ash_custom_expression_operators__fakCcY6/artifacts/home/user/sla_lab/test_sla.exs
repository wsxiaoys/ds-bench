# test_sla.exs
defmodule TestSla do
  import Ash.Expr
  require Ash.Query

  def run do
    IO.puts("=== Running SLA Lab Tests ===")

    # 1. Seed fixtures
    IO.puts("Seeding fixtures...")
    fixtures = SlaLab.Ops.Seed.seed!()

    # 2. Test Custom Expressions directly via Ash.Expr.eval/2
    IO.puts("Testing route_key custom expression...")
    assert_eval(expr(route_key("ams", "jfk")), "AMS|JFK")
    assert_eval(expr(route_key("jfk", "ams")), "AMS|JFK")
    assert_eval(expr(route_key("AMS", "ams")), "AMS|AMS")
    assert_eval(expr(route_key(nil, "ams")), nil)
    assert_eval(expr(route_key("ams", nil)), nil)

    # NoSuchFunction test for route_key
    assert_no_such_function(fn ->
      # route_key with map arguments must raise Ash.Error.Query.NoSuchFunction
      Ash.Expr.eval!(expr(route_key(%{a: 1}, "ams")))
    end)

    IO.puts("Testing ratio_bps custom expression...")
    assert_eval(expr(ratio_bps(1, 3)), 3333)
    assert_eval(expr(ratio_bps(2, 3)), 6667)
    assert_eval(expr(ratio_bps(1, 32)), 313)
    assert_eval(expr(ratio_bps(3, 32)), 938)
    assert_eval(expr(ratio_bps(3, 1)), 20_000)
    assert_eval(expr(ratio_bps(-1, 4)), 0)
    assert_eval(expr(ratio_bps(1, 0)), nil)
    assert_eval(expr(ratio_bps(nil, 4)), nil)
    assert_eval(expr(ratio_bps(1, nil)), nil)

    # NoSuchFunction test for ratio_bps
    assert_no_such_function(fn ->
      # ratio_bps with string arguments must raise Ash.Error.Query.NoSuchFunction
      Ash.Expr.eval!(expr(ratio_bps("abc", "def")))
    end)

    # 3. Test Shipment calculations
    IO.puts("Testing Shipment calculations...")
    # S01: {"S01", "NORDIC", "ams", "jfk", 48, 24, :standard}
    s01 = Ash.get!(SlaLab.Ops.Shipment, fixtures.shipments["S01"].id, load: [:route_key, :sla_ratio_bps, :status_label], authorize?: false)
    assert(s01.route_key == "AMS|JFK", "S01 route_key")
    assert(s01.sla_ratio_bps == 5000, "S01 sla_ratio_bps") # 24 * 10000 / 48 = 5000
    assert(s01.status_label == "met", "S01 status_label")

    # S02: {"S02", "NORDIC", "jfk", "ams", 48, 96, :express}
    s02 = Ash.get!(SlaLab.Ops.Shipment, fixtures.shipments["S02"].id, load: [:route_key, :sla_ratio_bps, :status_label], authorize?: false)
    assert(s02.route_key == "AMS|JFK", "S02 route_key")
    assert(s02.sla_ratio_bps == 20000, "S02 sla_ratio_bps") # 96 * 10000 / 48 = 20000
    assert(s02.status_label == "breached", "S02 status_label")

    # S03: {"S03", "NORDIC", "ams", "lhr", 24, nil, :critical}
    s03 = Ash.get!(SlaLab.Ops.Shipment, fixtures.shipments["S03"].id, load: [:route_key, :sla_ratio_bps, :status_label], authorize?: false)
    assert(s03.route_key == "AMS|LHR", "S03 route_key")
    assert(s03.sla_ratio_bps == nil, "S03 sla_ratio_bps")
    assert(s03.status_label == "pending", "S03 status_label")

    # Test filtering and sorting by calculations on Shipment
    IO.puts("Testing Shipment filtering and sorting by calculations...")
    # Filter status_label == "pending"
    pending_shipments =
      SlaLab.Ops.Shipment
      |> Ash.Query.filter(status_label == "pending")
      |> Ash.read!(authorize?: false)
    assert(Enum.count(pending_shipments) == 3, "pending shipments count")

    # Sort by sla_ratio_bps
    sorted_shipments =
      SlaLab.Ops.Shipment
      |> Ash.Query.filter(not is_nil(sla_ratio_bps))
      |> Ash.Query.sort(sla_ratio_bps: :asc)
      |> Ash.read!(authorize?: false)
    # Check that the first has the smallest bps and last has the largest
    sorted_bps = Enum.map(sorted_shipments, fn s ->
      # Load calculation first
      Ash.load!(s, :sla_ratio_bps, authorize?: false).sla_ratio_bps
    end)
    assert(sorted_bps == Enum.sort(sorted_bps), "sorted by sla_ratio_bps")

    # 4. Test read action :on_route and shipments_on_route interface
    IO.puts("Testing read action :on_route and shipments_on_route interface...")
    {:ok, res} = SlaLab.Ops.shipments_on_route("AMS|JFK", authorize?: false)
    assert(Enum.count(res) == 2, "shipments on AMS|JFK count")
    assert(Enum.all?(res, &(&1.reference in ["S01", "S02"])), "shipments on AMS|JFK references")

    # 5. Test update action :record_delivery with RatioWithin validation
    IO.puts("Testing record_delivery action and RatioWithin validation...")
    s01_loaded = fixtures.shipments["S01"]

    # Allowed update: actual_hours = 48 -> ratio = 10_000 <= 15_000
    {:ok, updated_s01} =
      s01_loaded
      |> Ash.Changeset.for_update(:record_delivery, %{actual_hours: 48})
      |> Ash.update(authorize?: false)
    assert(updated_s01.actual_hours == 48, "allowed update actual_hours")

    # Disallowed update: actual_hours = 73 -> ratio = 73 * 10_000 / 48 = 15_208 > 15_000
    res_disallowed =
      s01_loaded
      |> Ash.Changeset.for_update(:record_delivery, %{actual_hours: 73})
      |> Ash.update(authorize?: false)

    case res_disallowed do
      {:error, %Ash.Error.Invalid{errors: [invalid_attr = %Ash.Error.Changes.InvalidAttribute{}]}} ->
        assert(invalid_attr.field == :actual_hours, "error field is :actual_hours")
        assert(invalid_attr.message == "delivery ratio exceeds the allowed maximum", "error message is correct")
        IO.puts("  Disallowed single update successfully rejected with correct error!")

      other ->
        flunk("Expected Ash.Error.Invalid wrapping InvalidAttribute, got: #{inspect(other)}")
    end

    # Test bulk update
    IO.puts("Testing bulk update atomic validation...")
    bulk_res =
      Ash.bulk_update(
        [s01_loaded],
        :record_delivery,
        %{actual_hours: 73},
        strategy: [:atomic],
        authorize?: false,
        return_errors?: true
      )
    assert(bulk_res.status == :error, "bulk update status is :error")
    case bulk_res.errors do
      [%Ash.Error.Invalid{errors: [invalid_attr = %Ash.Error.Changes.InvalidAttribute{}]}] ->
        assert(invalid_attr.field == :actual_hours, "bulk error field is :actual_hours")
        assert(invalid_attr.message == "delivery ratio exceeds the allowed maximum", "bulk error message is correct")
        IO.puts("  Disallowed bulk update successfully rejected with correct error!")

      other ->
        flunk("Expected bulk update to return specific InvalidAttribute error, got: #{inspect(other)}")
    end

    # 6. Test Carrier aggregates and calculations
    IO.puts("Testing Carrier aggregates and calculations...")
    # NORDIC:
    # S01: actual 24, promised 48 (sla ratio 5000, met)
    # S02: actual 96, promised 48 (sla ratio 20000, breached)
    # S03: actual nil, promised 24 (pending)
    # S04: actual 1, promised 32 (sla ratio 313, met)
    # S10: actual 40, promised 8 (sla ratio 20000, breached)
    # Delivered count = 4 (S01, S02, S04, S10)
    # Breach count = 2 (S02, S10)
    # Breach rate bps = 2 * 10_000 / 4 = 5000
    nordic =
      SlaLab.Ops.Carrier
      |> Ash.Query.filter(code == "NORDIC")
      |> Ash.read_one!(authorize?: false)
      |> Ash.load!([:delivered_count, :breach_count, :breach_rate_bps], authorize?: false)

    assert(nordic.delivered_count == 4, "NORDIC delivered_count")
    assert(nordic.breach_count == 2, "NORDIC breach_count")
    assert(nordic.breach_rate_bps == 5000, "NORDIC breach_rate_bps")

    # ARCTIC:
    # S08: actual nil
    # S09: actual nil
    # Delivered count = 0
    # Breach count = 0
    # Breach rate bps = nil
    arctic =
      SlaLab.Ops.Carrier
      |> Ash.Query.filter(code == "ARCTIC")
      |> Ash.read_one!(authorize?: false)
      |> Ash.load!([:delivered_count, :breach_count, :breach_rate_bps], authorize?: false)

    assert(arctic.delivered_count == 0, "ARCTIC delivered_count")
    assert(arctic.breach_count == 0, "ARCTIC breach_count")
    assert(arctic.breach_rate_bps == nil, "ARCTIC breach_rate_bps")

    # Test custom expressions applied directly to aggregates inside Ash.Query.filter/2
    IO.puts("Testing custom expressions on aggregates inside filter/2...")
    carriers_high_breach_rate =
      SlaLab.Ops.Carrier
      |> Ash.Query.filter(ratio_bps(breach_count, delivered_count) >= 5000)
      |> Ash.read!(authorize?: false)
    assert(Enum.any?(carriers_high_breach_rate, &(&1.code == "NORDIC")), "NORDIC has high breach rate")
    refute(Enum.any?(carriers_high_breach_rate, &(&1.code == "ARCTIC")), "ARCTIC does not have high breach rate")

    # Test custom expressions inside exists/2
    IO.puts("Testing custom expressions inside exists/2...")
    carriers_with_ams_jfk =
      SlaLab.Ops.Carrier
      |> Ash.Query.filter(exists(shipments, route_key(origin_zone, destination_zone) == "AMS|JFK"))
      |> Ash.read!(authorize?: false)
    assert(Enum.any?(carriers_with_ams_jfk, &(&1.code == "NORDIC")), "NORDIC has AMS|JFK shipments")
    refute(Enum.any?(carriers_with_ams_jfk, &(&1.code == "PACIFIC")), "PACIFIC does not have AMS|JFK shipments")

    # 7. Test Policies on Shipment
    IO.puts("Testing Shipment policies...")
    # Reads are authorized only when actor's :home_route == shipment's route key.
    # S01 route_key is "AMS|JFK".
    # Actor with home_route: "AMS|JFK", role: :user -> Can read S01
    actor_user_ams_jfk = %{home_route: "AMS|JFK", role: :user}
    s01_read = Ash.get!(SlaLab.Ops.Shipment, fixtures.shipments["S01"].id, actor: actor_user_ams_jfk)
    assert(s01_read.reference == "S01", "authorized user read")

    # Actor with home_route: "SIN|HKG", role: :user -> Cannot read S01
    actor_user_sin_hkg = %{home_route: "SIN|HKG", role: :user}
    assert_forbidden(fn ->
      Ash.get!(SlaLab.Ops.Shipment, fixtures.shipments["S01"].id, actor: actor_user_sin_hkg, authorize_with: :error)
    end)

    # Actor with role: :admin -> Can read anything
    actor_admin = %{role: :admin}
    s01_admin = Ash.get!(SlaLab.Ops.Shipment, fixtures.shipments["S01"].id, actor: actor_admin)
    assert(s01_admin.reference == "S01", "admin read S01")
    s05_admin = Ash.get!(SlaLab.Ops.Shipment, fixtures.shipments["S05"].id, actor: actor_admin)
    assert(s05_admin.reference == "S05", "admin read S05")

    # nil actor is refused with Ash.Error.Forbidden
    assert_forbidden(fn ->
      Ash.get!(SlaLab.Ops.Shipment, fixtures.shipments["S01"].id, actor: nil)
    end)

    # 8. Test PenaltyPoints query function module
    IO.puts("Testing PenaltyPoints query function module...")
    # args/0, returns/0, name/0, predicate?/0
    assert(SlaLab.Expressions.PenaltyPoints.args() == [[:integer, :integer]], "PenaltyPoints args")
    assert(SlaLab.Expressions.PenaltyPoints.returns() == [:integer], "PenaltyPoints returns")
    assert(SlaLab.Expressions.PenaltyPoints.name() == :penalty_points, "PenaltyPoints name")
    assert(SlaLab.Expressions.PenaltyPoints.predicate?() == false, "PenaltyPoints predicate?")

    # Construct programmatically and evaluate via Ash.Expr.eval/2
    {:ok, node1} = Ash.Query.Function.new(SlaLab.Expressions.PenaltyPoints, [10, 5])
    assert_eval_node(node1, 50) # 10 * 5 = 50

    {:ok, node2} = Ash.Query.Function.new(SlaLab.Expressions.PenaltyPoints, [30, 5])
    assert_eval_node(node2, 24 * 5 + 6 * 5 * 2) # 120 + 60 = 180

    {:ok, node3} = Ash.Query.Function.new(SlaLab.Expressions.PenaltyPoints, [-5, 5])
    assert_eval_node(node3, 0)

    {:ok, node4} = Ash.Query.Function.new(SlaLab.Expressions.PenaltyPoints, [10, nil])
    assert_eval_node(node4, nil)

    # Check negative weight error
    assert(match?({:error, "penalty weight must not be negative"}, Ash.Query.Function.new(SlaLab.Expressions.PenaltyPoints, [10, -5])), "negative weight error")

    # Check non-integer :unknown
    assert(SlaLab.Expressions.PenaltyPoints.evaluate(%SlaLab.Expressions.PenaltyPoints{arguments: ["abc", 5]}) == :unknown, "non-integer evaluated to :unknown")

    IO.puts("\n=== ALL TESTS PASSED SUCCESSFULLY! ===")
  end

  defp assert_eval(expression, expected) do
    actual = Ash.Expr.eval!(expression)
    assert(actual == expected, "Expected #{inspect(expression)} to evaluate to #{inspect(expected)}, got: #{inspect(actual)}")
  end

  defp assert_eval_node(node, expected) do
    actual = Ash.Expr.eval!(node)
    assert(actual == expected, "Expected node to evaluate to #{inspect(expected)}, got: #{inspect(actual)}")
  end

  defp assert_no_such_function(fun) do
    try do
      fun.()
      flunk("Expected Ash.Error.Query.NoSuchFunction to be raised")
    rescue
      e in [Ash.Error.Query.NoSuchFunction] ->
        IO.puts("  NoSuchFunction correctly raised: #{Exception.message(e)}")
      e ->
        flunk("Expected Ash.Error.Query.NoSuchFunction, but got: #{inspect(e)}")
    end
  end

  defp assert_forbidden(fun) do
    try do
      fun.()
      flunk("Expected Ash.Error.Forbidden to be raised")
    rescue
      e in [Ash.Error.Forbidden] ->
        IO.puts("  Forbidden correctly raised: #{Exception.message(e)}")
      e ->
        flunk("Expected Ash.Error.Forbidden, but got: #{inspect(e)}")
    end
  end

  defp assert(cond, msg) do
    if cond do
      IO.puts("  [PASS] #{msg}")
    else
      flunk("Assertion failed: #{msg}")
    end
  end

  defp refute(cond, msg) do
    if not cond do
      IO.puts("  [PASS] #{msg}")
    else
      flunk("Assertion failed (refuted): #{msg}")
    end
  end

  defp flunk(msg) do
    IO.puts("  [FAIL] #{msg}")
    exit({:shutdown, 1})
  end
end

TestSla.run()
