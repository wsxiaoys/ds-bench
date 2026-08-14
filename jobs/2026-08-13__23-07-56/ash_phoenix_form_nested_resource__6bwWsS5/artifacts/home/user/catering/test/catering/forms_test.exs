defmodule Catering.FormsTest do
  use ExUnit.Case, async: true

  alias Catering.Forms
  alias Catering.Orders.Order
  alias Catering.Orders.LineItem

  setup do
    # Clear ETS tables before each test to ensure a clean state
    :ets.delete_all_objects(Order)
    :ets.delete_all_objects(LineItem)
    :ok
  end

  test "new_order_form/0 returns a blank create form for the order graph" do
    form = Forms.new_order_form()
    assert %AshPhoenix.Form{} = form
    assert form.name == "order"
    assert form.id == "order"
    assert form.type == :create
    assert form.resource == Order

    # Check nested-form keys
    keys = Keyword.keys(form.form_keys)
    assert :customer in keys
    assert :delivery_windows in keys
    assert :fulfillment in keys
    assert :line_items in keys
    assert length(keys) == 4
  end

  test "to_phoenix_form/1 returns a Phoenix.HTML.Form" do
    form = Forms.new_order_form()
    phx_form = Forms.to_phoenix_form(form)
    assert %Phoenix.HTML.Form{} = phx_form
    assert phx_form.name == "order"
    assert phx_form.id == "order"
  end

  test "change/2 and change/3 revalidates form against fresh parameters" do
    form = Forms.new_order_form()

    # Invalid change (reference is required)
    form1 = Forms.change(form, %{})
    refute form1.valid?

    # Valid change
    form2 = Forms.change(form, %{"reference" => "REF-123"})
    assert form2.valid?
  end

  test "add_nested/2 and add_nested/3 adds a nested form" do
    form = Forms.new_order_form()

    # Add a line item
    form = Forms.add_nested(form, "order[line_items]", params: %{"dish" => "Pizza"})
    assert length(form.forms[:line_items]) == 1

    line_item_form = hd(form.forms[:line_items])
    assert line_item_form.name == "order[line_items][0]"
    assert line_item_form.resource == LineItem
  end

  test "remove_nested/2 removes a nested form" do
    form = Forms.new_order_form()
    form = Forms.add_nested(form, "order[line_items]", params: %{"dish" => "Pizza"})
    form = Forms.add_nested(form, "order[line_items]", params: %{"dish" => "Burger"})
    assert length(form.forms[:line_items]) == 2

    # Remove the first item
    form = Forms.remove_nested(form, "order[line_items][0]")
    assert length(form.forms[:line_items]) == 1
    remaining = hd(form.forms[:line_items])
    assert remaining.name == "order[line_items][0]"
  end

  test "reorder/3 reorders the nested list" do
    form = Forms.new_order_form()
    form = Forms.add_nested(form, "order[line_items]", params: %{"dish" => "Dish 0"})
    form = Forms.add_nested(form, "order[line_items]", params: %{"dish" => "Dish 1"})
    form = Forms.add_nested(form, "order[line_items]", params: %{"dish" => "Dish 2"})

    # Reorder to [2, 0, 1]
    form = Forms.reorder(form, "order[line_items]", [2, 0, 1])
    dishes = Enum.map(form.forms[:line_items], &AshPhoenix.Form.value(&1, :dish))
    assert dishes == ["Dish 2", "Dish 0", "Dish 1"]
  end

  test "move/3 moves a nested form up or down" do
    form = Forms.new_order_form()
    form = Forms.add_nested(form, "order[line_items]", params: %{"dish" => "Dish 0"})
    form = Forms.add_nested(form, "order[line_items]", params: %{"dish" => "Dish 1"})
    form = Forms.add_nested(form, "order[line_items]", params: %{"dish" => "Dish 2"})

    # Move Dish 1 up
    form_up = Forms.move(form, "order[line_items][1]", :up)
    dishes_up = Enum.map(form_up.forms[:line_items], &AshPhoenix.Form.value(&1, :dish))
    assert dishes_up == ["Dish 1", "Dish 0", "Dish 2"]

    # Move Dish 1 down
    form_down = Forms.move(form, "order[line_items][1]", :down)
    dishes_down = Enum.map(form_down.forms[:line_items], &AshPhoenix.Form.value(&1, :dish))
    assert dishes_down == ["Dish 0", "Dish 2", "Dish 1"]

    # Boundary up is a no-op
    form_boundary_up = Forms.move(form, "order[line_items][0]", :up)
    dishes_boundary_up = Enum.map(form_boundary_up.forms[:line_items], &AshPhoenix.Form.value(&1, :dish))
    assert dishes_boundary_up == ["Dish 0", "Dish 1", "Dish 2"]

    # Boundary down is a no-op
    form_boundary_down = Forms.move(form, "order[line_items][2]", :down)
    dishes_boundary_down = Enum.map(form_boundary_down.forms[:line_items], &AshPhoenix.Form.value(&1, :dish))
    assert dishes_boundary_down == ["Dish 0", "Dish 1", "Dish 2"]
  end

  test "submitted_params/1 returns the parameter map" do
    form = Forms.new_order_form()
    form = Forms.change(form, %{"reference" => "REF-123", "note" => "My Note"})
    params = Forms.submitted_params(form)
    assert params["reference"] == "REF-123"
    assert params["note"] == "My Note"
  end

  test "hidden_inputs/2 returns correct hidden fields" do
    form = Forms.new_order_form()
    inputs = Forms.hidden_inputs(form, "order")
    assert inputs["_form_type"] == "create"
    assert Map.has_key?(inputs, "_touched")
  end

  test "error_map/1 and raw_error_list/2 return errors correctly" do
    form = Forms.new_order_form()
    form = Forms.add_nested(form, "order[customer]")
    form = Forms.validate(form, %{"reference" => "", "customer" => %{"name" => "", "email" => ""}})

    # Check error_map/1
    errs = Forms.error_map(form)
    assert Map.has_key?(errs, "order")
    assert Map.has_key?(errs, "order[customer]")
    assert errs["order"] == [["reference", "is required"]]
    assert errs["order[customer]"] == [["email", "is required"], ["name", "is required"]]

    # Check raw_error_list/2
    raw_errs = Forms.raw_error_list(form, "order[customer]")
    assert [
             {:email, "is required", _},
             {:name, "is required", _}
           ] = raw_errs
  end

  test "serialize/1 returns a complete snapshot" do
    form = Forms.new_order_form()
    form = Forms.add_nested(form, "order[customer]", params: %{"name" => "John", "email" => "john@example.com"})
    snapshot = Forms.serialize(form)

    assert snapshot["name"] == "order"
    assert snapshot["id"] == "order"
    assert snapshot["type"] == "create"
    assert snapshot["resource"] == "Catering.Orders.Order"
    assert snapshot["valid"] == false # because reference is missing
    assert snapshot["hidden"]["_form_type"] == "create"
    refute Map.has_key?(snapshot["hidden"], "_touched")

    assert snapshot["values"] == %{"reference" => nil, "note" => nil}

    customer_snapshot = snapshot["nested"]["customer"]
    assert customer_snapshot["name"] == "order[customer]"
    assert customer_snapshot["resource"] == "Catering.Orders.Customer"
    assert customer_snapshot["values"] == %{"name" => "John", "email" => "john@example.com"}
  end

  test "save/2 and edit_order_form/1 manage graph lifecycle" do
    # 1. Save blank form (fails)
    form = Forms.new_order_form()
    assert {:error, %AshPhoenix.Form{}} = Forms.save(form)

    # 2. Save valid form with nested line items and modifiers
    form = Forms.new_order_form()
    form = Forms.change(form, %{"reference" => "REF-100", "note" => "Order Note"})
    form = Forms.add_nested(form, "order[customer]", params: %{"name" => "Alice", "email" => "alice@example.com"})
    form = Forms.add_nested(form, "order[line_items]", params: %{"dish" => "Dish B", "quantity" => 2})
    form = Forms.add_nested(form, "order[line_items]", params: %{"dish" => "Dish A", "quantity" => 1})

    # Add modifier to Dish B (index 0 initially)
    form = Forms.add_nested(form, "order[line_items][0][modifiers]", params: %{"label" => "Extra Cheese", "surcharge_cents" => 150})

    assert {:ok, order} = Forms.save(form)
    assert order.reference == "REF-100"
    assert order.customer.name == "Alice"

    # Line items should be loaded and sorted by position (Dish B was added first, so position 0; Dish A second, so position 1)
    assert [
             %LineItem{dish: "Dish B", position: 0, modifiers: [%{label: "Extra Cheese"}]},
             %LineItem{dish: "Dish A", position: 1}
           ] = order.line_items

    # 3. Load order into edit form
    edit_form = Forms.edit_order_form(order.id)
    assert edit_form.type == :update
    assert edit_form.name == "order"

    # Verify initial edit form ordering is correct
    dishes = Enum.map(edit_form.forms[:line_items], &AshPhoenix.Form.value(&1, :dish))
    assert dishes == ["Dish B", "Dish A"]

    # 4. Remove Dish B (index 0) and save
    edit_form = Forms.remove_nested(edit_form, "order[line_items][0]")
    assert {:ok, updated_order} = Forms.save(edit_form)

    # Dish B should be deleted from the database
    assert [%LineItem{dish: "Dish A"}] = updated_order.line_items
    assert [%LineItem{dish: "Dish A"}] = Ash.read!(LineItem)
  end
end
