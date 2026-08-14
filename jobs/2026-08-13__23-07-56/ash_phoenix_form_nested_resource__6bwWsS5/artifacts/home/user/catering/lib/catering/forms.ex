defmodule Catering.Forms do
  @moduledoc """
  Facade that the LiveView layer uses to build, mutate, inspect and submit the
  nested catering order form.
  """

  @doc """
  Builds a blank create form for the order graph.
  """
  def new_order_form do
    AshPhoenix.Form.for_create(Catering.Orders.Order, :place, as: "order")
  end

  @doc """
  Takes an order id and returns an update form for the stored order,
  including nested forms for its existing line items and their modifiers.
  """
  def edit_order_form(order_id) do
    order =
      Catering.Orders.Order
      |> Ash.get!(order_id, load: [:customer, line_items: [:modifiers]])
      |> sort_order_relationships()

    AshPhoenix.Form.for_update(order, :revise, as: "order")
  end

  @doc """
  Returns the %Phoenix.HTML.Form{} for a form.
  """
  def to_phoenix_form(form) do
    Phoenix.HTML.FormData.to_form(form, [])
  end

  @doc """
  Revalidates a form against a fresh parameter map, with an optional keyword
  list of validation options.
  """
  def change(form, params, opts \\ []) do
    AshPhoenix.Form.validate(form, params, opts)
  end

  @doc """
  Adds a nested form at a path, with an optional keyword list of options.
  """
  def add_nested(form, path, opts \\ []) do
    AshPhoenix.Form.add_form(form, path, opts)
  end

  @doc """
  Removes the nested form at a path.
  """
  def remove_nested(form, path) do
    AshPhoenix.Form.remove_form(form, path)
  end

  @doc """
  Reorders the nested list at a path, given the new ordering as a list of
  the current zero-based indices.
  """
  def reorder(form, path, order) do
    parsed_path = AshPhoenix.Form.parse_path!(form, path)
    AshPhoenix.Form.sort_forms(form, parsed_path, order)
  end

  @doc """
  Moves the single nested form at a path one slot earlier (:up) or later (:down).
  """
  def move(form, path, direction) do
    parsed_path = AshPhoenix.Form.parse_path!(form, path)
    instruction =
      case direction do
        :up -> :decrement
        :down -> :increment
      end

    AshPhoenix.Form.sort_forms(form, parsed_path, instruction)
  end

  @doc """
  Returns the parameter map that would be sent to the underlying action.
  """
  def submitted_params(form) do
    AshPhoenix.Form.params(form)
  end

  @doc """
  Returns the hidden inputs required to render the form at a path.
  """
  def hidden_inputs(form, path) do
    case AshPhoenix.Form.get_form(form, path) do
      nil ->
        %{}

      nested_form ->
        nested_form
        |> AshPhoenix.Form.hidden_fields()
        |> Map.new(fn {k, v} -> {to_string(k), to_string(v)} end)
    end
  end

  @doc """
  Returns the user-facing errors of the whole form tree.
  """
  def error_map(form) do
    form
    |> AshPhoenix.Form.errors(for_path: :all)
    |> Enum.reduce(%{}, fn {path, errors}, acc ->
      case errors do
        [] ->
          acc

        _ ->
          html_name = html_name_for_path(form, path)
          formatted_errors =
            errors
            |> Enum.map(fn {field, message} ->
              [to_string(field), to_string(message)]
            end)
            |> Enum.sort()

          Map.put(acc, html_name, formatted_errors)
      end
    end)
  end

  @doc """
  Returns the untranslated errors of the form at a path.
  """
  def raw_error_list(form, path) do
    parsed_path = AshPhoenix.Form.parse_path!(form, path)
    raw_errors = AshPhoenix.Form.raw_errors(form, for_path: parsed_path) || []

    raw_errors
    |> Enum.flat_map(fn error ->
      case AshPhoenix.FormData.Error.to_form_error(error) do
        tuple when is_tuple(tuple) -> [tuple]
        list when is_list(list) -> list
        _ -> []
      end
    end)
    |> Enum.sort_by(fn {field, message, _vars} -> {field, message} end)
  end

  @doc """
  Returns a deterministic, plain-data snapshot of the whole form tree.
  """
  def serialize(form) do
    hidden_map =
      form
      |> AshPhoenix.Form.hidden_fields()
      |> Map.new(fn {k, v} -> {to_string(k), to_string(v)} end)
      |> Map.delete("_touched")

    fields =
      case form.resource do
        Catering.Orders.Order -> [:reference, :note]
        Catering.Orders.LineItem -> [:dish, :quantity]
        Catering.Orders.Modifier -> [:label, :surcharge_cents]
        Catering.Orders.Customer -> [:name, :email]
        Catering.Orders.DeliveryWindow -> [:label, :starts_at_minute, :ends_at_minute]
        Catering.Orders.CourierDrop -> [:street, :postcode]
        Catering.Orders.CounterPickup -> [:counter]
        _ -> []
      end

    values_map =
      Map.new(fields, fn field ->
        val = AshPhoenix.Form.value(form, field)
        str_val = if is_nil(val), do: nil, else: to_string(val)
        {to_string(field), str_val}
      end)

    errors =
      form
      |> AshPhoenix.Form.errors()
      |> Enum.map(fn {field, message} ->
        [to_string(field), to_string(message)]
      end)
      |> Enum.sort()

    nested_map =
      form.form_keys
      |> Keyword.keys()
      |> Map.new(fn key ->
        config = Keyword.get(form.form_keys, key)
        type = config[:type]
        nested_val = Map.get(form.forms, key)

        serialized_val =
          case type do
            :single ->
              if is_nil(nested_val) do
                nil
              else
                serialize(nested_val)
              end

            :list ->
              if is_nil(nested_val) do
                nil
              else
                Enum.map(nested_val, &serialize/1)
              end
          end

        {to_string(key), serialized_val}
      end)

    %{
      "name" => form.name,
      "id" => form.id,
      "type" => to_string(form.type),
      "resource" => inspect(form.resource),
      "valid" => form.valid?,
      "hidden" => hidden_map,
      "values" => values_map,
      "errors" => errors,
      "nested" => nested_map
    }
  end

  @doc """
  Submits the form and persists the whole graph.
  """
  def save(form, params \\ nil) do
    form = if is_nil(params), do: form, else: AshPhoenix.Form.validate(form, params)

    case AshPhoenix.Form.submit(form, params: nil) do
      {:ok, order} ->
        loaded_order =
          order
          |> Ash.load!([:customer, line_items: [:modifiers]])
          |> sort_order_relationships()

        {:ok, loaded_order}

      {:error, form} ->
        {:error, form}
    end
  end

  # Helper functions

  defp sort_order_relationships(order) do
    order =
      if Map.has_key?(order, :line_items) and is_list(order.line_items) do
        sorted_line_items =
          order.line_items
          |> Enum.sort_by(& &1.position)
          |> Enum.map(fn line_item ->
            if Map.has_key?(line_item, :modifiers) and is_list(line_item.modifiers) do
              Map.put(line_item, :modifiers, Enum.sort_by(line_item.modifiers, & &1.position))
            else
              line_item
            end
          end)

        Map.put(order, :line_items, sorted_line_items)
      else
        order
      end

    order
  end

  defp html_name_for_path(form, list_path) do
    case AshPhoenix.Form.get_form(form, list_path) do
      nil ->
        "order"

      nested_form ->
        nested_form.name
    end
  end
end
