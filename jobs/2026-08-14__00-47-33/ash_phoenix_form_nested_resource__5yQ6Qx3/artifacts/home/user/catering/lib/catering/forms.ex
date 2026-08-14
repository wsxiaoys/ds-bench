defmodule Catering.Forms do
  @moduledoc """
  Facade that the LiveView layer uses to build, mutate, inspect and submit the
  nested catering order form.
  """

  @doc """
  1. new_order_form/0 — a blank create form for the order graph.
  """
  def new_order_form do
    AshPhoenix.Form.for_create(Catering.Orders.Order, :place,
      as: "order",
      id: "order",
      forms: [
        auto?: true,
        customer: [
          type: :single,
          resource: Catering.Orders.Customer,
          create_action: :register,
          update_action: :amend
        ]
      ]
    )
  end

  @doc """
  2. edit_order_form/1 — takes an order id and returns an update form for the stored order,
     including nested forms for its existing line items and their modifiers.
  """
  def edit_order_form(order_id) do
    line_items_query =
      Catering.Orders.LineItem
      |> Ash.Query.sort(position: :asc)
      |> Ash.Query.load(modifiers: Ash.Query.sort(Catering.Orders.Modifier, position: :asc))

    order =
      Catering.Orders.Order
      |> Ash.get!(order_id, domain: Catering.Orders)
      |> Ash.load!([:customer, line_items: line_items_query], domain: Catering.Orders)

    AshPhoenix.Form.for_update(order, :revise,
      as: "order",
      id: "order",
      forms: [
        auto?: true,
        customer: [
          type: :single,
          resource: Catering.Orders.Customer,
          create_action: :register,
          update_action: :amend,
          data: order.customer
        ]
      ]
    )
  end

  @doc """
  3. to_phoenix_form/1 — the `%Phoenix.HTML.Form{}` for a form.
  """
  def to_phoenix_form(form) do
    Phoenix.HTML.FormData.to_form(form, [])
  end

  @doc """
  4. change/2 and change/3 — revalidate a form against a fresh parameter map, with an optional
     keyword list of validation options.
  """
  def change(form, params, opts \\ []) do
    AshPhoenix.Form.validate(form, params, opts)
  end

  @doc """
  5. add_nested/2 and add_nested/3 — add a nested form at a path, with an optional keyword list
     of options.
  """
  def add_nested(form, path, opts \\ []) do
    AshPhoenix.Form.add_form(form, path, opts)
  end

  @doc """
  6. remove_nested/2 — remove the nested form at a path.
  """
  def remove_nested(form, path) do
    AshPhoenix.Form.remove_form(form, path)
  end

  @doc """
  7. reorder/3 — reorder the nested list at a path, given the new ordering as a list of the
     current zero-based indices.
  """
  def reorder(form, path, order) do
    parsed_path = AshPhoenix.Form.parse_path!(form, path)
    AshPhoenix.Form.sort_forms(form, parsed_path, order)
  end

  @doc """
  8. move/3 — move the single nested form at a path one slot earlier (`:up`) or later (`:down`).
  """
  def move(form, path, direction) do
    instruction =
      case direction do
        :up -> :decrement
        :down -> :increment
      end

    parsed_path = AshPhoenix.Form.parse_path!(form, path)
    AshPhoenix.Form.sort_forms(form, parsed_path, instruction)
  end

  @doc """
  9. submitted_params/1 — the parameter map that would be sent to the underlying action.
  """
  def submitted_params(form) do
    AshPhoenix.Form.params(form)
  end

  @doc """
  10. hidden_inputs/2 — the hidden inputs required to render the form at a path.
  """
  def hidden_inputs(form, path) do
    case AshPhoenix.Form.get_form(form, path) do
      nil ->
        %{}

      sub_form ->
        sub_form
        |> AshPhoenix.Form.hidden_fields()
        |> Map.new(fn {k, v} -> {to_string(k), to_string(v)} end)
    end
  end

  @doc """
  11. error_map/1 — the user-facing errors of the whole form tree.
  """
  def error_map(form) do
    form
    |> AshPhoenix.Form.errors(for_path: :all)
    |> Enum.reduce(%{}, fn {path, errors}, acc ->
      if Enum.empty?(errors) do
        acc
      else
        html_name = path_to_html_name(form, path)

        mapped_errors =
          errors
          |> Enum.map(fn {field, message} -> [to_string(field), to_string(message)] end)
          |> Enum.sort()

        Map.put(acc, html_name, mapped_errors)
      end
    end)
  end

  @doc """
  12. raw_error_list/2 — the untranslated errors of the form at a path.
  """
  def raw_error_list(form, path) do
    parsed_path = AshPhoenix.Form.parse_path!(form, path)

    form
    |> AshPhoenix.Form.errors(format: :raw, for_path: parsed_path)
    |> Enum.map(fn {field, {message, vars}} -> {field, message, vars} end)
    |> Enum.sort_by(fn {field, message, _vars} -> {field, message} end)
  end

  @doc """
  13. serialize/1 — a deterministic, plain-data snapshot of the whole form tree.
  """
  def serialize(form) do
    %{
      "name" => to_string(form.name),
      "id" => to_string(form.id),
      "type" => to_string(form.type),
      "resource" => inspect(form.resource),
      "valid" => form.valid?,
      "hidden" =>
        form
        |> AshPhoenix.Form.hidden_fields()
        |> Map.new(fn {k, v} -> {to_string(k), to_string(v)} end)
        |> Map.delete("_touched"),
      "values" =>
        fields_for_resource(form.resource)
        |> Map.new(fn field ->
          val = AshPhoenix.Form.value(form, field)
          {to_string(field), if(is_nil(val), do: nil, else: to_string(val))}
        end),
      "errors" =>
        form
        |> AshPhoenix.Form.errors(format: :simple, for_path: [])
        |> Enum.map(fn {field, message} -> [to_string(field), to_string(message)] end)
        |> Enum.sort(),
      "nested" =>
        form.form_keys
        |> Keyword.keys()
        |> Enum.uniq()
        |> Map.new(fn key ->
          config = form.form_keys[key]
          type = config[:type] || :single
          val = Map.get(form.forms, key)

          serialized_val =
            case type do
              :single ->
                if is_nil(val) do
                  nil
                else
                  serialize(val)
                end

              :list ->
                if is_nil(val) do
                  []
                else
                  Enum.map(val, &serialize/1)
                end
            end

          {to_string(key), serialized_val}
        end)
    }
  end

  @doc """
  14. save/2 — submit the form and persist the whole graph.
  """
  def save(form, params \\ nil) do
    form =
      if is_nil(params) do
        form
      else
        change(form, params)
      end

    case AshPhoenix.Form.submit(form, params: nil) do
      {:ok, order} ->
        line_items_query =
          Catering.Orders.LineItem
          |> Ash.Query.sort(position: :asc)
          |> Ash.Query.load(modifiers: Ash.Query.sort(Catering.Orders.Modifier, position: :asc))

        loaded_order =
          Ash.load!(order, [:customer, line_items: line_items_query], domain: Catering.Orders)

        {:ok, loaded_order}

      {:error, form} ->
        {:error, form}
    end
  end

  # Helper functions

  defp path_to_html_name(form, path) do
    root_name = form.name || "order"

    Enum.reduce(path, root_name, fn
      elem, acc -> acc <> "[#{elem}]"
    end)
  end

  defp fields_for_resource(resource) do
    case resource do
      Catering.Orders.Order -> [:reference, :note]
      Catering.Orders.LineItem -> [:dish, :quantity]
      Catering.Orders.Modifier -> [:label, :surcharge_cents]
      Catering.Orders.Customer -> [:name, :email]
      Catering.Orders.DeliveryWindow -> [:label, :starts_at_minute, :ends_at_minute]
      Catering.Orders.CourierDrop -> [:street, :postcode]
      Catering.Orders.CounterPickup -> [:counter]
      _ -> []
    end
  end
end
